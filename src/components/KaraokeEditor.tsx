import React, { useMemo, useRef, useState } from 'react';
import {
    Box,
    Button,
    Typography,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Paper,
    IconButton,
    Tooltip,
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, Delete as DeleteIcon, Timer as TimerIcon } from '@mui/icons-material';
import { LyricsFormat } from '../types/quiz';
import { useTranslation } from '../i18n/LanguageContext';
import KaraokeTimingEditor from './KaraokeTimingEditor';

// Same line-level LRC subset the game renders: "[mm:ss.xx] line"
// (multiple timestamps per line allowed, metadata tags like [ti:...] ignored)
const LRC_TIME_RE = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export const parseLrcLines = (text: string): { timeMs: number; text: string }[] => {
    const lines: { timeMs: number; text: string }[] = [];
    for (const raw of String(text || '').split(/\r?\n/)) {
        const times: number[] = [];
        let tailStart = 0;
        LRC_TIME_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = LRC_TIME_RE.exec(raw)) !== null) {
            if (match.index !== tailStart) break;
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const frac = match[3] || '';
            const fracMs = frac.length === 0 ? 0
                : frac.length === 1 ? parseInt(frac, 10) * 100
                    : frac.length === 2 ? parseInt(frac, 10) * 10
                        : parseInt(frac.slice(0, 3), 10);
            times.push((minutes * 60 + seconds) * 1000 + fracMs);
            tailStart = LRC_TIME_RE.lastIndex;
        }
        if (times.length === 0) continue;
        // Enhanced-LRC word stamps ("<mm:ss.xx>word") are display noise here
        const content = raw.slice(tailStart)
            .replace(/<(\d{1,2}):(\d{2})(?:[.:]\d{1,3})?>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        times.forEach(timeMs => lines.push({ timeMs, text: content }));
    }
    return lines.sort((a, b) => a.timeMs - b.timeMs);
};

const formatTime = (timeMs: number): string => {
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

interface KaraokeEditorProps {
    media?: string;
    lyrics: string;
    lyricsFormat: LyricsFormat;
    onMediaChange: (media: string) => void;
    onLyricsChange: (lyrics: string) => void;
    onLyricsFormatChange: (format: LyricsFormat) => void;
}

const KaraokeEditor: React.FC<KaraokeEditorProps> = ({
    media,
    lyrics,
    lyricsFormat,
    onMediaChange,
    onLyricsChange,
    onLyricsFormatChange,
}) => {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [timingOpen, setTimingOpen] = useState(false);

    const readFile = (file: File) => {
        if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                onMediaChange(event.target.result as string);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) readFile(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) readFile(file);
    };

    const isVideo = !!media && media.startsWith('data:video');
    // Decoded size of the base64 payload, for the size label
    const mediaSizeMb = useMemo(() => {
        if (!media) return 0;
        const payload = media.slice(media.indexOf(',') + 1);
        return (payload.length * 3) / 4 / (1024 * 1024);
    }, [media]);

    const lrcLines = useMemo(
        () => (lyricsFormat === 'lrc' ? parseLrcLines(lyrics) : []),
        [lyrics, lyricsFormat]
    );

    // Any singable word left after stripping the LRC tags?
    const hasWords = useMemo(() => lyrics
        .replace(/\[(\d{1,2}):(\d{2})(?:[.:]\d{1,3})?\]/g, ' ')
        .replace(/<(\d{1,2}):(\d{2})(?:[.:]\d{1,3})?>/g, ' ')
        .split(/\r?\n/)
        .some(line => !/^\s*\[[a-zA-Z#][^\]]*\]\s*$/.test(line) && line.trim().length > 0),
        [lyrics]);
    const canOpenTiming = !!media && hasWords;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Track upload */}
            <Box>
                <Typography variant="subtitle1" gutterBottom>
                    {t('karaoke.uploadTitle')}
                </Typography>
                {!media ? (
                    <Paper
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        sx={{
                            p: 4,
                            textAlign: 'center',
                            border: '2px dashed var(--glass-border)',
                            background: 'var(--input-bg)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                        }}
                    >
                        <Button
                            variant="contained"
                            startIcon={<CloudUploadIcon />}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {t('karaoke.uploadButton')}
                        </Button>
                        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                            {t('karaoke.dropHint')}
                        </Typography>
                    </Paper>
                ) : (
                    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {isVideo ? (
                            <video src={media} controls style={{ width: '100%', maxHeight: '320px' }} />
                        ) : (
                            <audio src={media} controls style={{ width: '100%' }} />
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                                {t('karaoke.fileSize', { size: mediaSizeMb.toFixed(1) })}
                            </Typography>
                            <IconButton
                                onClick={() => onMediaChange('')}
                                sx={{ color: 'var(--danger)' }}
                                title={t('karaoke.removeMedia')}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </Box>
                    </Paper>
                )}
                <input
                    type="file"
                    accept="audio/*,video/*"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
            </Box>

            {/* Lyrics */}
            <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="subtitle1">{t('karaoke.lyricsTitle')}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Tooltip title={canOpenTiming ? '' : t('karaoke.timingNeedsBoth')}>
                            <span>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<TimerIcon />}
                                    disabled={!canOpenTiming}
                                    onClick={() => setTimingOpen(true)}
                                >
                                    {t('karaoke.timingButton')}
                                </Button>
                            </span>
                        </Tooltip>
                        <ToggleButtonGroup
                            value={lyricsFormat}
                            exclusive
                            size="small"
                            onChange={(_, value) => { if (value) onLyricsFormatChange(value as LyricsFormat); }}
                        >
                            <ToggleButton value="plain">{t('karaoke.formatPlain')}</ToggleButton>
                            <ToggleButton value="lrc">{t('karaoke.formatLrc')}</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                </Box>
                <TextField
                    fullWidth
                    multiline
                    minRows={6}
                    maxRows={16}
                    value={lyrics}
                    onChange={(e) => onLyricsChange(e.target.value)}
                    placeholder={lyricsFormat === 'lrc'
                        ? t('karaoke.lyricsPlaceholderLrc')
                        : t('karaoke.lyricsPlaceholderPlain')}
                />
                {lyricsFormat === 'lrc' && lyrics.trim() && (
                    <Paper sx={{ p: 1.5, mt: 1.5 }}>
                        {lrcLines.length > 0 ? (
                            <>
                                <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 1 }}>
                                    {t('karaoke.lrcPreview', { count: lrcLines.length })}
                                </Typography>
                                <Box sx={{ maxHeight: '160px', overflowY: 'auto' }}>
                                    {lrcLines.slice(0, 50).map((line, i) => (
                                        <Typography key={i} variant="body2" sx={{ fontFamily: 'monospace' }}>
                                            <Box component="span" sx={{ color: 'var(--primary)', mr: 1 }}>
                                                {formatTime(line.timeMs)}
                                            </Box>
                                            {line.text || '♪'}
                                        </Typography>
                                    ))}
                                </Box>
                            </>
                        ) : (
                            <Typography variant="body2" color="error.main">
                                {t('karaoke.lrcNoLines')}
                            </Typography>
                        )}
                    </Paper>
                )}
            </Box>

            {media && (
                <KaraokeTimingEditor
                    open={timingOpen}
                    media={media}
                    lyrics={lyrics}
                    onClose={() => setTimingOpen(false)}
                    onSave={(newLyrics, anyTimed) => {
                        onLyricsChange(newLyrics);
                        onLyricsFormatChange(anyTimed ? 'lrc' : 'plain');
                        setTimingOpen(false);
                    }}
                />
            )}
        </Box>
    );
};

export default KaraokeEditor;
