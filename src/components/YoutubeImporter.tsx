import React, { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    LinearProgress,
    TextField,
    Typography,
} from '@mui/material';
import {
    Close as CloseIcon,
    Check as CheckIcon,
    Download as DownloadIcon,
    YouTube as YouTubeIcon,
} from '@mui/icons-material';
import { useTranslation } from '../i18n/LanguageContext';

interface YoutubeImporterProps {
    open: boolean;
    onClose: () => void;
    onApply: (media: string) => void;
}

// A YouTube/TikTok/etc. video can't be downloaded straight from the browser —
// CORS and signature protection block it — so the URL is routed through a
// downloader service that returns the actual bytes, which we then base64-encode.
//
// Primary: a self-hosted cobalt instance (JSON handshake → tunnel/stream URL).
// Fallback: a direct-download API that takes {url} and streams the mp4 back in
// the response body. The fallback is tried whenever cobalt is unreachable, times
// out, or fails to resolve the link.
const COBALT_API = (process.env.REACT_APP_COBALT_API || 'http://localhost:9000').replace(/\/$/, '');
const FALLBACK_API = (process.env.REACT_APP_FALLBACK_API || 'https://ytproxy.critfail.art').replace(/\/$/, '');
const COBALT_TIMEOUT_MS = 15000;

type Phase = 'idle' | 'resolving' | 'downloading' | 'ready' | 'error';

const fetchWithTimeout = async (url: string, opts: RequestInit, ms: number): Promise<Response> => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(url, { ...opts, signal: ctrl.signal });
    } finally {
        clearTimeout(id);
    }
};

// Stream a response body into a base64 video data URL, reporting progress when a
// Content-Length is present.
const streamToDataUrl = async (
    res: Response,
    onProgress: (pct: number | null) => void,
): Promise<string> => {
    const total = Number(res.headers.get('Content-Length')) || 0;
    let blob: Blob;

    if (res.body && total > 0) {
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
                chunks.push(value);
                received += value.length;
                onProgress(Math.min(100, Math.round((received / total) * 100)));
            }
        }
        const type = res.headers.get('Content-Type') || 'video/mp4';
        blob = new Blob(chunks as BlobPart[], { type });
    } else {
        onProgress(null);
        blob = await res.blob();
    }

    // Cobalt can answer 200 OK with an empty body when YouTube refuses the
    // actual media (e.g. PO-token / auth-gated videos): the tunnel resolves but
    // streams zero bytes. Treat that as a failure so the caller falls over to
    // the backup downloader instead of embedding an empty <video>.
    if (blob.size === 0) {
        throw new Error('empty-download');
    }

    if (!/^video\//.test(blob.type)) {
        // The fallback may send application/octet-stream; wrap as mp4 so the
        // editor's <video> blot plays it.
        blob = new Blob([blob], { type: 'video/mp4' });
    }

    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('encode-failed'));
        reader.readAsDataURL(blob);
    });
};

// Ask cobalt for a direct stream URL for the given page URL.
const resolveViaCobalt = async (pageUrl: string): Promise<string> => {
    const res = await fetchWithTimeout(COBALT_API, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            url: pageUrl,
            videoQuality: '720',
            downloadMode: 'auto',
            filenameStyle: 'basic',
        }),
    }, COBALT_TIMEOUT_MS);
    if (!res.ok) throw new Error(`cobalt-http-${res.status}`);
    const data = await res.json().catch(() => null) as any;
    if (!data) throw new Error('cobalt-bad-response');

    // v10: tunnel/redirect carry a `url`; `picker` offers several items; older
    // instances use `stream`/`redirect`.
    if (data.status === 'tunnel' || data.status === 'redirect' || data.status === 'stream') {
        return data.url as string;
    }
    if (data.status === 'picker' && Array.isArray(data.picker) && data.picker.length) {
        const vid = data.picker.find((p: any) => p.type === 'video') || data.picker[0];
        if (vid?.url) return vid.url as string;
    }
    throw new Error('cobalt-resolve-failed');
};

// Lets the author paste a video link, downloads it (cobalt first, fallback API
// second), and hands it back as a base64 data URL so it embeds exactly like an
// uploaded video file.
const YoutubeImporter: React.FC<YoutubeImporterProps> = ({ open, onClose, onApply }) => {
    const { t } = useTranslation();
    const [url, setUrl] = useState('');
    const [phase, setPhase] = useState<Phase>('idle');
    const [progress, setProgress] = useState<number | null>(null);
    const [usingFallback, setUsingFallback] = useState(false);
    const [resultUrl, setResultUrl] = useState<string | null>(null);

    // Reset everything each time the dialog opens or closes
    useEffect(() => {
        setUrl('');
        setPhase('idle');
        setProgress(null);
        setUsingFallback(false);
        setResultUrl(null);
    }, [open]);

    const busy = phase === 'resolving' || phase === 'downloading';
    const isValidUrl = /^https?:\/\/\S+$/i.test(url.trim());

    const download = async () => {
        const pageUrl = url.trim();
        if (!pageUrl) return;
        setResultUrl(null);
        setProgress(null);
        setUsingFallback(false);

        // 1) Primary: self-hosted cobalt
        setPhase('resolving');
        try {
            const streamUrl = await resolveViaCobalt(pageUrl);
            setPhase('downloading');
            const res = await fetch(streamUrl);
            if (!res.ok) throw new Error(`cobalt-stream-${res.status}`);
            const dataUrl = await streamToDataUrl(res, setProgress);
            setResultUrl(dataUrl);
            setPhase('ready');
            return;
        } catch {
            // fall through to the fallback API
        }

        // 2) Fallback: direct-download API that returns the mp4 bytes
        try {
            setUsingFallback(true);
            setProgress(null);
            setPhase('downloading');
            const res = await fetch(FALLBACK_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: pageUrl }),
            });
            if (!res.ok) throw new Error(`fallback-http-${res.status}`);
            const dataUrl = await streamToDataUrl(res, setProgress);
            setResultUrl(dataUrl);
            setPhase('ready');
        } catch {
            setPhase('error');
        }
    };

    const apply = () => {
        if (resultUrl) {
            onApply(resultUrl);
            onClose();
        }
    };

    const statusText = phase === 'resolving'
        ? t('youtube.resolving')
        : usingFallback
            ? (progress !== null ? t('youtube.fallbackPct', { pct: progress }) : t('youtube.fallback'))
            : (progress !== null ? t('youtube.downloadingPct', { pct: progress }) : t('youtube.downloading'));

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <YouTubeIcon sx={{ color: '#FF0000' }} />
                {t('youtube.title')}
                <Box sx={{ flex: 1 }} />
                <IconButton onClick={onClose} disabled={busy} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                    {t('youtube.hint')}
                </Typography>

                <TextField
                    fullWidth
                    autoFocus
                    label={t('youtube.urlLabel')}
                    placeholder="https://www.youtube.com/watch?v=…"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && isValidUrl && !busy) download();
                    }}
                    disabled={busy}
                    error={url.trim().length > 0 && !isValidUrl}
                    helperText={url.trim().length > 0 && !isValidUrl ? t('youtube.invalid') : ' '}
                />

                {!busy && (
                    <Button
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        onClick={download}
                        disabled={!isValidUrl}
                        sx={{ alignSelf: 'flex-start' }}
                    >
                        {t('youtube.download')}
                    </Button>
                )}

                {busy && (
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                            {statusText}
                        </Typography>
                        <LinearProgress
                            variant={phase === 'downloading' && progress !== null ? 'determinate' : 'indeterminate'}
                            value={progress ?? undefined}
                        />
                    </Box>
                )}

                {phase === 'error' && (
                    <Typography variant="body2" color="error.main">
                        {t('youtube.error')}
                    </Typography>
                )}

                {resultUrl && phase === 'ready' && (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={resultUrl} controls style={{ width: '100%', maxHeight: 260, borderRadius: 8 }} />
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
                <Button
                    variant="contained"
                    startIcon={<CheckIcon />}
                    onClick={apply}
                    disabled={!resultUrl || busy}
                >
                    {t('youtube.insert')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default YoutubeImporter;
