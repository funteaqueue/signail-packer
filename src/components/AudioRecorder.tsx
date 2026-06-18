import React, { useEffect, useRef, useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    Switch,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    Close as CloseIcon,
    Mic as MicIcon,
    Stop as StopIcon,
    Replay as ReplayIcon,
    Check as CheckIcon,
} from '@mui/icons-material';
import { useTranslation } from '../i18n/LanguageContext';

interface AudioRecorderProps {
    open: boolean;
    onClose: () => void;
    onApply: (media: string) => void;
}

const PROCESSING_KEY = 'packer:audio-rec-processing';

// Whether the browser's voice-call DSP (echo cancellation, noise suppression,
// auto gain) is applied. Off captures the raw mic, which sounds far better when
// audio is playing through the speakers. The last choice is remembered.
const getProcessingEnabled = (): boolean => {
    try {
        return localStorage.getItem(PROCESSING_KEY) === 'on';
    } catch {
        return false;
    }
};

const rememberProcessingEnabled = (enabled: boolean) => {
    try {
        localStorage.setItem(PROCESSING_KEY, enabled ? 'on' : 'off');
    } catch {
        // localStorage unavailable (private mode etc.) — choice just won't persist
    }
};

const fmt = (sec: number): string => {
    const total = Math.max(0, Math.floor(sec));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// Records microphone audio via the MediaRecorder API and hands the result back
// as a base64 data URL, so it embeds in the editor the same way an uploaded
// audio file does.
const AudioRecorder: React.FC<AudioRecorderProps> = ({ open, onClose, onApply }) => {
    const { t } = useTranslation();
    const recorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [recording, setRecording] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const [processingEnabled, setProcessingEnabled] = useState(getProcessingEnabled);

    const handleProcessingChange = (enabled: boolean) => {
        setProcessingEnabled(enabled);
        rememberProcessingEnabled(enabled);
    };

    const stopTracks = () => {
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
    };

    const clearTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    // Tear down whenever the dialog opens or closes so each session starts clean
    useEffect(() => {
        if (!open) {
            if (recorderRef.current && recorderRef.current.state !== 'inactive') {
                recorderRef.current.stop();
            }
            clearTimer();
            stopTracks();
            recorderRef.current = null;
            chunksRef.current = [];
        }
        setRecording(false);
        setElapsed(0);
        setRecordedUrl(null);
        setError(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => () => {
        clearTimer();
        stopTracks();
    }, []);

    const startRecording = async () => {
        setError(false);
        setRecordedUrl(null);
        chunksRef.current = [];
        try {
            // The browser's voice-call DSP (echo cancellation, noise
            // suppression, auto gain) is tuned for speech and badly mangles the
            // signal when audio is playing through the speakers. The user
            // chooses per recording whether to keep it on or capture the raw mic.
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: processingEnabled,
                    noiseSuppression: processingEnabled,
                    autoGainControl: processingEnabled,
                },
            });
            streamRef.current = stream;
            const recorder = new MediaRecorder(stream);
            recorderRef.current = recorder;
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
                // Drop the ";codecs=…" parameter so the resulting data URL is a
                // plain "data:audio/webm;base64,…" that the editor's trim
                // detection recognises.
                const baseType = (recorder.mimeType || 'audio/webm').split(';')[0];
                const blob = new Blob(chunksRef.current, { type: baseType });
                const reader = new FileReader();
                reader.onload = () => setRecordedUrl(reader.result as string);
                reader.readAsDataURL(blob);
                stopTracks();
            };
            recorder.start();
            setRecording(true);
            setElapsed(0);
            timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
        } catch {
            setError(true);
            stopTracks();
        }
    };

    const stopRecording = () => {
        clearTimer();
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
        }
        setRecording(false);
    };

    const reset = () => {
        setRecordedUrl(null);
        setElapsed(0);
        setError(false);
    };

    const apply = () => {
        if (recordedUrl) {
            onApply(recordedUrl);
            onClose();
        }
    };

    return (
        <Dialog open={open} onClose={recording ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MicIcon />
                {t('audioRec.title')}
                <Box sx={{ flex: 1 }} />
                <IconButton onClick={onClose} disabled={recording} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1.5,
                        py: 2,
                    }}
                >
                    <Box
                        sx={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: recording ? 'var(--danger)' : 'var(--text-secondary)',
                            animation: recording ? 'audioRecPulse 1s ease-in-out infinite' : 'none',
                            '@keyframes audioRecPulse': {
                                '0%, 100%': { opacity: 1 },
                                '50%': { opacity: 0.25 },
                            },
                        }}
                    />
                    <Typography variant="h5" sx={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                        {fmt(elapsed)}
                    </Typography>
                </Box>

                {!recording && !recordedUrl && (
                    <>
                        <Button
                            variant="contained"
                            startIcon={<MicIcon />}
                            onClick={startRecording}
                        >
                            {t('audioRec.start')}
                        </Button>
                        <Tooltip title={t('audioRec.processingHint')}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={processingEnabled}
                                        onChange={(e) => handleProcessingChange(e.target.checked)}
                                    />
                                }
                                label={t('audioRec.processing')}
                                sx={{ color: 'var(--text-secondary)' }}
                            />
                        </Tooltip>
                    </>
                )}

                {recording && (
                    <Button
                        variant="contained"
                        color="error"
                        startIcon={<StopIcon />}
                        onClick={stopRecording}
                    >
                        {t('audioRec.stop')}
                    </Button>
                )}

                {recordedUrl && !recording && (
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center' }}>
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <audio src={recordedUrl} controls style={{ width: '100%' }} />
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<ReplayIcon />}
                            onClick={reset}
                        >
                            {t('audioRec.retake')}
                        </Button>
                    </Box>
                )}

                {error && (
                    <Typography variant="body2" color="error.main" sx={{ textAlign: 'center' }}>
                        {t('audioRec.error')}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={recording}>{t('common.cancel')}</Button>
                <Button
                    variant="contained"
                    startIcon={<CheckIcon />}
                    onClick={apply}
                    disabled={!recordedUrl || recording}
                >
                    {t('audioRec.insert')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AudioRecorder;
