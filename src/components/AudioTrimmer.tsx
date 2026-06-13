import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Typography, CircularProgress } from '@mui/material';
import {
    PlayArrow as PlayArrowIcon,
    Stop as StopIcon,
    ContentCut as ContentCutIcon,
    Restore as RestoreIcon,
} from '@mui/icons-material';
import { useTranslation } from '../i18n/LanguageContext';
import { decodeAudioFromDataUrl, computePeaks } from '../utils/audioTrim';
import { trimMedia } from '../utils/mediaTrim';

interface AudioTrimmerProps {
    media: string;
    onChange: (media: string) => void;
}

const WAVE_HEIGHT = 96;
const WAVE_BUCKETS = 800;

const fmt = (sec: number): string => {
    const total = Math.max(0, sec);
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    const cs = Math.floor((total - Math.floor(total)) * 100);
    return `${m}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
};

const AudioTrimmer: React.FC<AudioTrimmerProps> = ({ media, onChange }) => {
    const { t } = useTranslation();
    const bufferRef = useRef<AudioBuffer | null>(null);
    const [peaks, setPeaks] = useState<number[]>([]);
    const [duration, setDuration] = useState(0);
    const [start, setStart] = useState(0);
    const [end, setEnd] = useState(0);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [applying, setApplying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [trimError, setTrimError] = useState(false);
    const [playing, setPlaying] = useState(false);

    const boxRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dragRef = useRef<'start' | 'end' | null>(null);
    // Live values for pointer math without re-binding listeners.
    const stateRef = useRef({ start: 0, end: 0, duration: 0 });
    stateRef.current = { start, end, duration };

    // Preview playback through a one-shot buffer source.
    const previewCtxRef = useRef<AudioContext | null>(null);
    const previewSrcRef = useRef<AudioBufferSourceNode | null>(null);
    const previewTimerRef = useRef<number | null>(null);

    const stopPreview = useCallback(() => {
        if (previewTimerRef.current !== null) {
            window.clearTimeout(previewTimerRef.current);
            previewTimerRef.current = null;
        }
        if (previewSrcRef.current) {
            try { previewSrcRef.current.onended = null; previewSrcRef.current.stop(); } catch { /* already stopped */ }
            previewSrcRef.current = null;
        }
        if (previewCtxRef.current) {
            previewCtxRef.current.close().catch(() => {});
            previewCtxRef.current = null;
        }
        setPlaying(false);
    }, []);

    // Decode whenever the source changes (incl. right after a trim).
    useEffect(() => {
        let cancelled = false;
        stopPreview();
        setLoading(true);
        setFailed(false);
        bufferRef.current = null;
        (async () => {
            const buffer = await decodeAudioFromDataUrl(media);
            if (cancelled) return;
            if (!buffer) {
                setFailed(true);
                setLoading(false);
                return;
            }
            bufferRef.current = buffer;
            setPeaks(computePeaks(buffer, WAVE_BUCKETS));
            setDuration(buffer.duration);
            setStart(0);
            setEnd(buffer.duration);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [media, stopPreview]);

    useEffect(() => stopPreview, [stopPreview]);

    // Draw waveform + shaded out-of-selection regions.
    useEffect(() => {
        const canvas = canvasRef.current;
        const box = boxRef.current;
        if (!canvas || !box) return;
        const draw = () => {
            const dpr = window.devicePixelRatio || 1;
            const w = box.clientWidth;
            const h = box.clientHeight;
            if (w === 0 || h === 0) return;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.scale(dpr, dpr);
            const css = getComputedStyle(document.documentElement);
            const waveColor = (css.getPropertyValue('--primary') || '#888').trim();
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = waveColor;
            if (peaks.length > 0) {
                for (let x = 0; x < w; x++) {
                    const p = peaks[Math.floor((x / w) * peaks.length)] || 0;
                    const inSel = duration > 0
                        && (x / w) * duration >= stateRef.current.start
                        && (x / w) * duration <= stateRef.current.end;
                    ctx.globalAlpha = inSel ? 0.7 : 0.18;
                    const barH = Math.max(2, p * (h - 8));
                    ctx.fillRect(x, (h - barH) / 2, 1, barH);
                }
            } else {
                ctx.globalAlpha = 0.4;
                ctx.fillRect(0, h / 2 - 3, w, 6);
            }
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        };
        draw();
        const observer = new ResizeObserver(draw);
        observer.observe(box);
        return () => observer.disconnect();
    }, [peaks, duration, start, end]);

    // ---- handle dragging ----
    const pointerToSec = (clientX: number): number => {
        const box = boxRef.current;
        if (!box || stateRef.current.duration <= 0) return 0;
        const rect = box.getBoundingClientRect();
        const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        return frac * stateRef.current.duration;
    };

    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            if (!dragRef.current) return;
            const sec = pointerToSec(e.clientX);
            const { start: s, end: en } = stateRef.current;
            if (dragRef.current === 'start') {
                setStart(Math.min(sec, en - 0.05));
            } else {
                setEnd(Math.max(sec, s + 0.05));
            }
        };
        const onUp = () => { dragRef.current = null; };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        // pointerToSec only reads live values via stateRef — safe to bind once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const beginDrag = (which: 'start' | 'end') => (e: React.PointerEvent) => {
        e.preventDefault();
        stopPreview();
        dragRef.current = which;
    };

    const previewSelection = () => {
        const buffer = bufferRef.current;
        if (!buffer) return;
        if (playing) { stopPreview(); return; }
        const AC: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AC();
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        const span = Math.max(0.05, end - start);
        src.onended = () => stopPreview();
        src.start(0, start, span);
        previewCtxRef.current = ctx;
        previewSrcRef.current = src;
        // Safety net in case onended doesn't fire on some browsers.
        previewTimerRef.current = window.setTimeout(stopPreview, (span + 0.2) * 1000);
        setPlaying(true);
    };

    const applyTrim = async () => {
        const isWholeClip = start <= 0.001 && end >= duration - 0.001;
        if (isWholeClip || !media) return;
        setApplying(true);
        setProgress(0);
        setTrimError(false);
        stopPreview();
        try {
            // ffmpeg.wasm re-encodes the selection to mp3 (small output)
            const dataUrl = await trimMedia(media, start, end, setProgress);
            onChange(dataUrl);
        } catch {
            setTrimError(true);
        } finally {
            setApplying(false);
        }
    };

    const resetSelection = () => {
        stopPreview();
        setStart(0);
        setEnd(duration);
    };

    if (failed) {
        return (
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                {t('karaoke.trimUndecodable')}
            </Typography>
        );
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                    {t('karaoke.trimDecoding')}
                </Typography>
            </Box>
        );
    }

    const startPct = duration > 0 ? (start / duration) * 100 : 0;
    const endPct = duration > 0 ? (end / duration) * 100 : 100;
    const selectionDirty = start > 0.001 || end < duration - 0.001;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box
                ref={boxRef}
                sx={{
                    position: 'relative',
                    height: WAVE_HEIGHT,
                    borderRadius: 1,
                    overflow: 'hidden',
                    background: 'var(--input-bg)',
                    touchAction: 'none',
                    userSelect: 'none',
                }}
            >
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
                {/* shaded regions outside the selection */}
                <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${startPct}%`, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }} />
                <Box sx={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: `${100 - endPct}%`, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }} />
                {/* draggable handles */}
                {(['start', 'end'] as const).map((which) => (
                    <Box
                        key={which}
                        onPointerDown={beginDrag(which)}
                        sx={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: `${which === 'start' ? startPct : endPct}%`,
                            width: 12,
                            ml: '-6px',
                            cursor: 'ew-resize',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            '&::before': {
                                content: '""',
                                width: 3,
                                height: '100%',
                                background: 'var(--primary)',
                            },
                            '&::after': {
                                content: '""',
                                position: 'absolute',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: 12,
                                height: 28,
                                borderRadius: 1,
                                background: 'var(--primary)',
                            },
                        }}
                    />
                ))}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    {fmt(start)} → {fmt(end)} ({t('karaoke.trimNewDuration', { dur: fmt(end - start) })})
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={playing ? <StopIcon /> : <PlayArrowIcon />}
                        onClick={previewSelection}
                    >
                        {playing ? t('karaoke.trimStop') : t('karaoke.trimPreview')}
                    </Button>
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<RestoreIcon />}
                        disabled={!selectionDirty || applying}
                        onClick={resetSelection}
                    >
                        {t('karaoke.trimReset')}
                    </Button>
                    <Button
                        size="small"
                        variant="contained"
                        startIcon={applying ? <CircularProgress size={16} color="inherit" /> : <ContentCutIcon />}
                        disabled={!selectionDirty || applying}
                        onClick={applyTrim}
                    >
                        {applying ? t('karaoke.trimProcessing', { pct: Math.round(progress * 100) }) : t('karaoke.trimApply')}
                    </Button>
                </Box>
            </Box>
            {trimError ? (
                <Typography variant="caption" color="error.main">
                    {t('karaoke.trimError')}
                </Typography>
            ) : (
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                    {t('karaoke.trimMp3Note')}
                </Typography>
            )}
        </Box>
    );
};

export default AudioTrimmer;
