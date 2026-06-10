import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  Paper,
  Grid,
  Stack,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { RevealEffect, RevealCurve } from '../types/pack';

interface ProgressiveRevealEditorProps {
  image?: string;
  duration: number;
  effect: RevealEffect;
  curve: RevealCurve;
  onImageChange: (image: string) => void;
  onDurationChange: (duration: number) => void;
  onEffectChange: (effect: RevealEffect) => void;
  onCurveChange: (curve: RevealCurve) => void;
}

// Maps elapsed-time fraction to reveal fraction.
// slow-start keeps the image hidden longer; fast-start uncovers a lot early.
export const applyRevealCurve = (progress: number, curve: RevealCurve): number => {
  if (curve === 'slow-start') return progress * progress;
  if (curve === 'fast-start') return Math.sqrt(progress);
  return progress;
};

// Renders the image hidden by the chosen effect at the given progress (0..1)
const EffectPreview: React.FC<{ src: string; effect: RevealEffect; progress: number }> = ({ src, effect, progress }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const hidden = 1 - progress;

  useEffect(() => {
    if (effect !== 'pixelate') return;
    setLoaded(false);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setLoaded(true);
    };
    img.src = src;
  }, [src, effect]);

  useEffect(() => {
    if (effect !== 'pixelate' || !loaded || !canvasRef.current || !imgRef.current) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    canvas.width = w;
    canvas.height = h;
    const pixelSize = Math.max(1, Math.ceil(hidden * Math.max(w, h) / 16));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const tmp = document.createElement('canvas');
    tmp.width = Math.max(1, Math.round(w / pixelSize));
    tmp.height = Math.max(1, Math.round(h / pixelSize));
    const tmpCtx = tmp.getContext('2d');
    if (!tmpCtx) return;
    tmpCtx.drawImage(img, 0, 0, tmp.width, tmp.height);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, w, h);
  }, [effect, loaded, hidden]);

  if (effect === 'pixelate') {
    return (
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: 'auto' }}
      />
    );
  }

  if (effect === 'zoom') {
    return (
      <Box sx={{ overflow: 'hidden' }}>
        <Box
          component="img"
          src={src}
          alt="preview"
          sx={{
            display: 'block',
            width: '100%',
            height: 'auto',
            transform: `scale(${1 + hidden * 7})`,
            transformOrigin: 'center center',
          }}
        />
      </Box>
    );
  }

  // blur (default)
  return (
    <Box sx={{ overflow: 'hidden' }}>
      <Box
        component="img"
        src={src}
        alt="preview"
        sx={{
          display: 'block',
          width: '100%',
          height: 'auto',
          filter: `blur(${Math.round(hidden * 40)}px)`,
          // Slightly oversize to hide transparent blur edges
          transform: `scale(${1 + hidden * 0.1})`,
        }}
      />
    </Box>
  );
};

const ProgressiveRevealEditor: React.FC<ProgressiveRevealEditorProps> = ({
  image,
  duration,
  effect,
  curve,
  onImageChange,
  onDurationChange,
  onEffectChange,
  onCurveChange,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [previewProgress, setPreviewProgress] = useState(0);

  // Paste image from clipboard
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                onImageChange(event.target.result as string);
              }
            };
            reader.readAsDataURL(blob);
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [onImageChange]);

  const handlePcUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        onImageChange(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUrlLoad = async () => {
    if (!urlInput.trim()) return;
    try {
      const response = await fetch(urlInput);
      if (response.ok) {
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          onImageChange(reader.result as string);
        };
        reader.readAsDataURL(blob);
        return;
      }
    } catch (e) {
      console.warn('CORS direct fetch failed, trying canvas fallback...', e);
    }

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            onImageChange(canvas.toDataURL('image/png'));
          } catch (canvasErr) {
            alert('CORS restriction prevents conversion to base64. Save the image to your PC and upload it, or copy/paste it.');
          }
        }
      };
      img.onerror = () => {
        alert('Failed to load image from URL. Ensure the URL is valid and public.');
      };
      img.src = urlInput;
    } catch (err) {
      alert('Error fetching image from URL.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageChange(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Settings */}
      <Paper sx={{ p: 3, background: 'rgba(19, 26, 54, 0.5)' }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel id="reveal-effect-label">Hiding effect</InputLabel>
              <Select
                labelId="reveal-effect-label"
                label="Hiding effect"
                value={effect}
                onChange={(e) => onEffectChange(e.target.value as RevealEffect)}
              >
                <MenuItem value="blur">Blur</MenuItem>
                <MenuItem value="pixelate">Pixelate</MenuItem>
                <MenuItem value="zoom">Zoom out</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel id="reveal-curve-label">Reveal speed</InputLabel>
              <Select
                labelId="reveal-curve-label"
                label="Reveal speed"
                value={curve}
                onChange={(e) => onCurveChange(e.target.value as RevealCurve)}
              >
                <MenuItem value="linear">Linear (even)</MenuItem>
                <MenuItem value="slow-start">Slow start (stays hidden longer)</MenuItem>
                <MenuItem value="fast-start">Fast start (uncovers a lot early)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Reveal duration (seconds)*"
              type="number"
              fullWidth
              value={duration}
              onChange={(e) => onDurationChange(Math.max(1, parseInt(e.target.value) || 0))}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              helperText="Time for the image to fully reveal if nobody buzzes in"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Image uploader / preview */}
      {!image ? (
        <Paper
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          sx={{
            p: 5,
            border: '2px dashed rgba(139, 92, 246, 0.4)',
            borderRadius: '16px',
            textAlign: 'center',
            background: 'rgba(19, 26, 54, 0.3)',
            cursor: 'pointer',
            transition: 'border-color 0.3s',
            '&:hover': { borderColor: '#8b5cf6' },
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 64, color: 'rgba(139, 92, 246, 0.7)', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Drag & Drop image here
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            or upload from PC, load from URL, or press <strong>Ctrl+V</strong> to paste from clipboard
          </Typography>

          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 3 }}>
            <Button variant="contained" component="label" startIcon={<CloudUploadIcon />}>
              Upload from PC
              <input type="file" hidden accept="image/*" onChange={handlePcUpload} />
            </Button>
          </Stack>

          <Box sx={{ maxWidth: '500px', mx: 'auto', display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              label="Load Image from URL"
              fullWidth
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/image.png"
              InputProps={{
                startAdornment: <LinkIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />
            <Button variant="outlined" onClick={handleUrlLoad}>
              Load
            </Button>
          </Box>
        </Paper>
      ) : (
        <Paper sx={{ p: 2, background: 'rgba(19, 26, 54, 0.5)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Reveal Preview
            </Typography>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={() => {
                if (window.confirm('Change image?')) {
                  onImageChange('');
                }
              }}
            >
              Change Image
            </Button>
          </Box>

          <Box sx={{
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            backgroundColor: '#0a0e27',
          }}>
            <EffectPreview src={image} effect={effect} progress={applyRevealCurve(previewProgress / 100, curve)} />
          </Box>

          <Box sx={{ px: 1, mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Simulate reveal progress: {previewProgress}%
            </Typography>
            <Slider
              value={previewProgress}
              onChange={(_, v) => setPreviewProgress(v as number)}
              min={0}
              max={100}
            />
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default ProgressiveRevealEditor;
