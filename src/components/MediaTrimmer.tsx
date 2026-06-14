import React, { useEffect, useRef, useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    LinearProgress,
    Slider,
    Typography,
} from '@mui/material';
import {
    Close as CloseIcon,
    ContentCut as ContentCutIcon,
    PlayArrow as PlayArrowIcon,
    Stop as StopIcon,
} from '@mui/icons-material';
import { useTranslation } from '../i18n/LanguageContext';
import { isVideoMedia, trimMedia } from '../utils/mediaTrim';

interface MediaTrimmerProps {
    open: boolean;
    media: string;
    onClose: () => void;
    onApply: (media: string) => void;
}

const fmt = (sec: number): string => {
    const total = Math.max(0, sec);
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    const d = Math.floor((total - Math.floor(total)) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${d}`;
};

const MediaTrimmer: React.FC<MediaTrimmerProps> = ({ open, media, onClose, onApply }) => {
    const { t } = useTranslation();
    const isVideo = isVideoMedia(media);
    const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
    const [duration, setDuration] = useState(0);
    const [range, setRange] = useState<[number, number]>([0, 0]);
    const [playing, setPlaying] = useState(false);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(false);
    const stopAtRef = useRef<number | null>(null);

    // Reset whenever a new clip is opened
    useEffect(() => {
        if (!open) return;
        setDuration(0);
        setRange([0, 0]);
        setPlaying(false);
        setBusy(false);
        setProgress(0);
        setError(false);
        stopAtRef.current = null;
    }, [open, media]);

    const setFromDuration = (d: number) => {
        if (Number.isFinite(d) && d > 0) {
            setDuration(d);
            setRange([0, d]);
        }
    };

    const handleLoaded = () => {
        const el = mediaRef.current;
        if (!el) return;
        // MediaRecorder webm/ogg clips report Infinity until the element is
        // seeked past the end — force a seek, then read the real duration.
        if (!Number.isFinite(el.duration) || el.duration === 0) {
            const onSeeked = () => {
                el.removeEventListener('seeked', onSeeked);
                setFromDuration(el.duration);
                el.currentTime = 0;
            };
            el.addEventListener('seeked', onSeeked);
            try {
                el.currentTime = 1e7;
            } catch {
                /* ignore — some sources reject large seeks */
            }
            return;
        }
        setFromDuration(el.duration);
    };

    // Stop preview at the end of the selection
    const handleTimeUpdate = () => {
        const el = mediaRef.current;
        if (el && stopAtRef.current !== null && el.currentTime >= stopAtRef.current) {
            el.pause();
            stopAtRef.current = null;
            setPlaying(false);
        }
    };

    const previewSelection = () => {
        const el = mediaRef.current;
        if (!el) return;
        if (playing) {
            el.pause();
            stopAtRef.current = null;
            setPlaying(false);
            return;
        }
        el.currentTime = range[0];
        stopAtRef.current = range[1];
        el.play().then(() => setPlaying(true)).catch(() => {});
    };

    const apply = async () => {
        setBusy(true);
        setProgress(0);
        setError(false);
        try {
            const url = await trimMedia(media, range[0], range[1], setProgress);
            onApply(url);
            onClose();
        } catch {
            setError(true);
        } finally {
            setBusy(false);
        }
    };

    const selectionDirty = range[0] > 0.05 || range[1] < duration - 0.05;

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ContentCutIcon />
                {t('mediaTrim.title')}
                <Box sx={{ flex: 1 }} />
                <IconButton onClick={onClose} disabled={busy} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', background: 'var(--input-bg)', borderRadius: 1, p: 1 }}>
                    {isVideo ? (
                        <video
                            ref={mediaRef as React.RefObject<HTMLVideoElement>}
                            src={media}
                            onLoadedMetadata={handleLoaded}
                            onTimeUpdate={handleTimeUpdate}
                            controls
                            style={{ maxHeight: 320, maxWidth: '100%' }}
                        />
                    ) : (
                        <audio
                            ref={mediaRef as React.RefObject<HTMLAudioElement>}
                            src={media}
                            onLoadedMetadata={handleLoaded}
                            onTimeUpdate={handleTimeUpdate}
                            style={{ width: '100%' }}
                            controls
                        />
                    )}
                </Box>

                <Box sx={{ px: 1 }}>
                    <Slider
                        value={range}
                        min={0}
                        max={duration || 0}
                        step={0.05}
                        disabled={busy || duration === 0}
                        valueLabelDisplay="auto"
                        valueLabelFormat={fmt}
                        onChange={(_, v) => Array.isArray(v) && setRange([v[0], v[1]])}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                            {fmt(range[0])} → {fmt(range[1])}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                            {t('mediaTrim.newDuration', { dur: fmt(Math.max(0, range[1] - range[0])) })}
                        </Typography>
                    </Box>
                </Box>

                <Button
                    variant="outlined"
                    size="small"
                    startIcon={playing ? <StopIcon /> : <PlayArrowIcon />}
                    onClick={previewSelection}
                    disabled={busy || duration === 0}
                    sx={{ alignSelf: 'flex-start' }}
                >
                    {playing ? t('mediaTrim.stop') : t('mediaTrim.preview')}
                </Button>

                {busy && (
                    <Box>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                            {t('mediaTrim.processing', { pct: Math.round(progress * 100) })}
                        </Typography>
                        <LinearProgress variant={progress > 0 ? 'determinate' : 'indeterminate'} value={progress * 100} />
                        <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                            {t('mediaTrim.firstRunNote')}
                        </Typography>
                    </Box>
                )}
                {error && (
                    <Typography variant="body2" color="error.main">
                        {t('mediaTrim.error')}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
                <Button
                    variant="contained"
                    startIcon={<ContentCutIcon />}
                    onClick={apply}
                    disabled={busy || duration === 0 || !selectionDirty}
                >
                    {t('mediaTrim.apply')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default MediaTrimmer;
