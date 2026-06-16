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
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import {
    Close as CloseIcon,
    Check as CheckIcon,
    Download as DownloadIcon,
    Link as LinkIcon,
    MusicNote as MusicNoteIcon,
    Movie as MovieIcon,
} from '@mui/icons-material';
import { useTranslation } from '../i18n/LanguageContext';

export type MediaKind = 'audio' | 'video';

interface MediaImporterProps {
    open: boolean;
    onClose: () => void;
    onApply: (media: string, kind: MediaKind) => void;
    /** Lock the picker to audio (e.g. the karaoke track importer). */
    audioOnly?: boolean;
    /** Which kind is preselected when the dialog opens (ignored when audioOnly). */
    defaultKind?: MediaKind;
}

// A streaming-site link (YouTube, SoundCloud, TikTok, …) can't be fetched
// straight from the browser — CORS and signature protection block it — so the
// URL is routed through a downloader service that returns the actual bytes,
// which we then base64-encode. Several strategies are tried in order:
//   1. Direct file link (…/song.mp3, …/clip.mp4)  → fetched as-is.
//   2. Self-hosted yt-dlp service                 → POST {url,mode} → bytes.
//   3. Self-hosted cobalt instance                → JSON handshake → tunnel URL.
//   4. SoundCloud search (audio only)             → for DRM-locked tracks
//      (Spotify/Deezer): resolve title+artist, find the full track.
//   5. Direct-download fallback proxy             → streams the bytes back.
const YTDLP_API = (process.env.REACT_APP_YTDLP_API || 'http://localhost:9001').replace(/\/$/, '');
const COBALT_API = (process.env.REACT_APP_COBALT_API || 'http://localhost:9000').replace(/\/$/, '');
const FALLBACK_API = (process.env.REACT_APP_FALLBACK_API || 'https://ytproxy.critfail.art').replace(/\/$/, '');
const COBALT_TIMEOUT_MS = 15000;

// Links that already point straight at a media file we can fetch and embed
// without any downloader service in between.
const DIRECT_AUDIO_RE = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)(?:[?#]|$)/i;
const DIRECT_VIDEO_RE = /\.(mp4|webm|mov|m4v|ogv|mkv)(?:[?#]|$)/i;

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

// Stream a response body into a base64 data URL, reporting progress when a
// Content-Length is present. `kind` only decides the mime to assume when the
// server doesn't send a recognisable audio/* or video/* type.
const streamToDataUrl = async (
    res: Response,
    onProgress: (pct: number | null) => void,
    kind: MediaKind,
): Promise<string> => {
    const fallbackType = kind === 'audio' ? 'audio/mpeg' : 'video/mp4';
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
        const type = res.headers.get('Content-Type') || fallbackType;
        blob = new Blob(chunks as BlobPart[], { type });
    } else {
        onProgress(null);
        blob = await res.blob();
    }

    // Cobalt can answer 200 OK with an empty body when the source refuses the
    // actual media (e.g. PO-token / auth-gated videos): the tunnel resolves but
    // streams zero bytes. Treat that as a failure so the caller falls over to
    // the next strategy instead of embedding an empty player.
    if (blob.size === 0) {
        throw new Error('empty-download');
    }

    // Keep a recognised media type as-is (so the actual bytes drive whether we
    // embed <audio> or <video>); only octet-stream / unknown gets the assumed
    // type so the editor can still play it.
    if (!/^(audio|video)\//.test(blob.type)) {
        blob = new Blob([blob], { type: fallbackType });
    }

    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('encode-failed'));
        reader.readAsDataURL(blob);
    });
};

// Ask cobalt for a direct stream URL. `kind === 'audio'` extracts the audio
// track (mp3) instead of the muxed video.
const resolveViaCobalt = async (pageUrl: string, kind: MediaKind): Promise<string> => {
    const res = await fetchWithTimeout(COBALT_API, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            url: pageUrl,
            videoQuality: '720',
            downloadMode: kind === 'audio' ? 'audio' : 'auto',
            audioFormat: 'mp3',
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
        const wanted = kind === 'audio' ? 'audio' : 'video';
        const pick = data.picker.find((p: any) => p.type === wanted) || data.picker[0];
        if (pick?.url) return pick.url as string;
    }
    throw new Error('cobalt-resolve-failed');
};

// Lets the author paste a video/audio link, downloads it through whichever
// strategy fits, and hands it back as a base64 data URL so it embeds exactly
// like an uploaded media file.
const MediaImporter: React.FC<MediaImporterProps> = ({ open, onClose, onApply, audioOnly, defaultKind }) => {
    const { t } = useTranslation();
    const [url, setUrl] = useState('');
    const [kind, setKind] = useState<MediaKind>(audioOnly ? 'audio' : (defaultKind || 'video'));
    const [phase, setPhase] = useState<Phase>('idle');
    const [progress, setProgress] = useState<number | null>(null);
    const [usingFallback, setUsingFallback] = useState(false);
    const [searchingSoundcloud, setSearchingSoundcloud] = useState(false);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [resultKind, setResultKind] = useState<MediaKind>('video');

    // Reset everything each time the dialog opens or closes
    useEffect(() => {
        setUrl('');
        setKind(audioOnly ? 'audio' : (defaultKind || 'video'));
        setPhase('idle');
        setProgress(null);
        setUsingFallback(false);
        setSearchingSoundcloud(false);
        setResultUrl(null);
    }, [open, audioOnly, defaultKind]);

    const busy = phase === 'resolving' || phase === 'downloading';
    const isValidUrl = /^https?:\/\/\S+$/i.test(url.trim());

    const finish = (dataUrl: string) => {
        setResultUrl(dataUrl);
        setResultKind(dataUrl.startsWith('data:audio') ? 'audio' : 'video');
        setPhase('ready');
    };

    const download = async () => {
        const pageUrl = url.trim();
        if (!pageUrl) return;
        setResultUrl(null);
        setProgress(null);
        setUsingFallback(false);
        setSearchingSoundcloud(false);

        // A direct file link tells us the kind for free; otherwise honour the toggle.
        const directKind: MediaKind | null = DIRECT_AUDIO_RE.test(pageUrl)
            ? 'audio'
            : DIRECT_VIDEO_RE.test(pageUrl)
                ? 'video'
                : null;
        const effKind: MediaKind = audioOnly ? 'audio' : (directKind || kind);

        // 1) Direct media file — fetch the bytes straight away.
        if (directKind) {
            try {
                setPhase('downloading');
                const res = await fetch(pageUrl);
                if (!res.ok) throw new Error(`direct-${res.status}`);
                finish(await streamToDataUrl(res, setProgress, effKind));
                return;
            } catch {
                // fall through to the downloader services
            }
        }

        // 2) Primary downloader: self-hosted yt-dlp service (returns the bytes).
        try {
            setPhase('resolving');
            const res = await fetch(`${YTDLP_API}/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: pageUrl, mode: effKind }),
            });
            if (!res.ok) throw new Error(`ytdlp-${res.status}`);
            setPhase('downloading');
            finish(await streamToDataUrl(res, setProgress, effKind));
            return;
        } catch {
            // fall through to cobalt
        }

        // 3) Self-hosted cobalt
        setPhase('resolving');
        try {
            const streamUrl = await resolveViaCobalt(pageUrl, effKind);
            setPhase('downloading');
            const res = await fetch(streamUrl);
            if (!res.ok) throw new Error(`cobalt-stream-${res.status}`);
            finish(await streamToDataUrl(res, setProgress, effKind));
            return;
        } catch {
            // fall through
        }

        // 4) Audio only: couldn't get the original audio (e.g. a DRM-locked
        // Spotify or Deezer track). Resolve the title/artist server-side and
        // pull the full track from SoundCloud instead.
        if (effKind === 'audio') {
            try {
                setSearchingSoundcloud(true);
                setProgress(null);
                setPhase('resolving');
                const res = await fetch(`${YTDLP_API}/soundcloud`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: pageUrl }),
                });
                if (res.ok) {
                    setSearchingSoundcloud(false);
                    setPhase('downloading');
                    finish(await streamToDataUrl(res, setProgress, 'audio'));
                    return;
                }
            } catch {
                // fall through
            } finally {
                setSearchingSoundcloud(false);
            }
        }

        // 5) Fallback: direct-download proxy that returns the bytes
        try {
            setUsingFallback(true);
            setProgress(null);
            setPhase('downloading');
            const res = await fetch(FALLBACK_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: pageUrl, mode: effKind }),
            });
            if (!res.ok) throw new Error(`fallback-http-${res.status}`);
            finish(await streamToDataUrl(res, setProgress, effKind));
        } catch {
            setPhase('error');
        }
    };

    const apply = () => {
        if (resultUrl) {
            onApply(resultUrl, resultKind);
            onClose();
        }
    };

    const statusText = searchingSoundcloud
        ? t('media.soundcloud')
        : phase === 'resolving'
            ? t('media.resolving')
            : usingFallback
                ? (progress !== null ? t('media.fallbackPct', { pct: progress }) : t('media.fallback'))
                : (progress !== null ? t('media.downloadingPct', { pct: progress }) : t('media.downloading'));

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LinkIcon sx={{ color: 'var(--primary)' }} />
                {t('media.title')}
                <Box sx={{ flex: 1 }} />
                <IconButton onClick={onClose} disabled={busy} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                    {t('media.hint')}
                </Typography>

                {!audioOnly && (
                    <ToggleButtonGroup
                        value={kind}
                        exclusive
                        size="small"
                        disabled={busy}
                        onChange={(_, value) => { if (value) setKind(value as MediaKind); }}
                    >
                        <ToggleButton value="video">
                            <MovieIcon fontSize="small" sx={{ mr: 0.5 }} />
                            {t('media.kindVideo')}
                        </ToggleButton>
                        <ToggleButton value="audio">
                            <MusicNoteIcon fontSize="small" sx={{ mr: 0.5 }} />
                            {t('media.kindAudio')}
                        </ToggleButton>
                    </ToggleButtonGroup>
                )}

                <TextField
                    fullWidth
                    autoFocus
                    label={t('media.urlLabel')}
                    placeholder="https://…"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && isValidUrl && !busy) download();
                    }}
                    disabled={busy}
                    error={url.trim().length > 0 && !isValidUrl}
                    helperText={url.trim().length > 0 && !isValidUrl ? t('media.invalid') : ' '}
                />

                {!busy && (
                    <Button
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        onClick={download}
                        disabled={!isValidUrl}
                        sx={{ alignSelf: 'flex-start' }}
                    >
                        {t('media.download')}
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
                        {t('media.error')}
                    </Typography>
                )}

                {resultUrl && phase === 'ready' && (
                    resultKind === 'audio'
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        ? <audio src={resultUrl} controls style={{ width: '100%' }} />
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        : <video src={resultUrl} controls style={{ width: '100%', maxHeight: 260, borderRadius: 8 }} />
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
                    {t('media.insert')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default MediaImporter;
