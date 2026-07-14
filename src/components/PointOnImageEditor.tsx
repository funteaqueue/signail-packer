import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Grid, Paper, Slider, Stack, TextField, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LinkIcon from '@mui/icons-material/Link';
import { PointCoordinate } from '../types/quiz';
import { useTranslation } from '../i18n/LanguageContext';

interface PointOnImageEditorProps {
  image?: string;
  task: string;
  correctPoint?: PointCoordinate;
  imageAspectRatio?: number;
  duration: number;
  accuracyPercent: number;
  firstPlaceBonus: number;
  onImageChange: (image: string) => void;
  onTaskChange: (task: string) => void;
  onCorrectPointChange: (point: PointCoordinate) => void;
  onImageAspectRatioChange: (aspectRatio: number) => void;
  onDurationChange: (duration: number) => void;
  onAccuracyPercentChange: (accuracyPercent: number) => void;
  onFirstPlaceBonusChange: (firstPlaceBonus: number) => void;
}

const PointOnImageEditor: React.FC<PointOnImageEditorProps> = ({
  image,
  task,
  correctPoint,
  imageAspectRatio,
  duration,
  accuracyPercent,
  firstPlaceBonus,
  onImageChange,
  onTaskChange,
  onCorrectPointChange,
  onImageAspectRatioChange,
  onDurationChange,
  onAccuracyPercentChange,
  onFirstPlaceBonusChange,
}) => {
  const { t } = useTranslation();
  const [urlInput, setUrlInput] = useState('');
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const parsedAspect = Number(imageAspectRatio);
  const safeAspect = Number.isFinite(parsedAspect) && parsedAspect > 0 ? parsedAspect : 1;
  const imageSpace = safeAspect >= 1
    ? { width: safeAspect, height: 1 }
    : { width: 1, height: 1 / safeAspect };
  const correctnessRadius = (accuracyPercent / 100) * Math.hypot(imageSpace.width, imageSpace.height);

  const readImageFile = (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') onImageChange(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const imageItem = Array.from(event.clipboardData?.items || [])
        .find((item) => item.type.startsWith('image/'));
      if (!imageItem) return;
      readImageFile(imageItem.getAsFile());
      event.preventDefault();
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  });

  const handlePointClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = imageContainerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    onCorrectPointChange({
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    });
  };

  return (
    <Stack spacing={3}>
      <TextField
        label={t('pointOnImage.prompt')}
        value={task}
        onChange={(event) => onTaskChange(event.target.value)}
        helperText={t('pointOnImage.promptHelper')}
        required
        fullWidth
        multiline
        minRows={2}
      />

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <TextField
            label={t('pointOnImage.duration')}
            type="number"
            value={duration}
            onChange={(event) => onDurationChange(Math.max(1, parseInt(event.target.value) || 1))}
            inputProps={{ min: 1 }}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ px: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {t('pointOnImage.accuracy')}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {accuracyPercent.toFixed(1)}%
              </Typography>
            </Stack>
            <Slider
              aria-label={t('pointOnImage.accuracy')}
              value={Math.max(0.1, Math.min(20, accuracyPercent))}
              onChange={(_, value) => onAccuracyPercentChange(value as number)}
              min={0.1}
              max={20}
              step={0.1}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value.toFixed(1)}%`}
              marks={[
                { value: 0.1, label: '0.1%' },
                { value: 2, label: '2%' },
                { value: 10, label: '10%' },
                { value: 20, label: '20%' },
              ]}
              sx={{ mt: 0.5 }}
            />
            <Typography variant="caption" color="text.secondary">
              {t('pointOnImage.accuracyHelper')}
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            label={t('pointOnImage.firstPlaceBonus')}
            type="number"
            value={firstPlaceBonus}
            onChange={(event) => onFirstPlaceBonusChange(Math.max(0, parseInt(event.target.value) || 0))}
            helperText={t('pointOnImage.firstPlaceBonusHelper')}
            inputProps={{ min: 0 }}
            fullWidth
          />
        </Grid>
      </Grid>

      <Paper
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          readImageFile(event.dataTransfer.files?.[0]);
        }}
        sx={{ p: 2, background: 'var(--surface-soft)' }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <Button component="label" variant="contained" startIcon={<CloudUploadIcon />}>
            {t('pointOnImage.uploadImage')}
            <input hidden accept="image/*" type="file" onChange={(event) => readImageFile(event.target.files?.[0])} />
          </Button>
          <TextField
            size="small"
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            placeholder={t('pointOnImage.imageUrl')}
            sx={{ flex: 1 }}
          />
          <Button
            variant="outlined"
            startIcon={<LinkIcon />}
            disabled={!urlInput.trim()}
            onClick={() => onImageChange(urlInput.trim())}
          >
            {t('pointOnImage.loadUrl')}
          </Button>
        </Stack>

        {!image ? (
          <Box sx={{ py: 8, textAlign: 'center', border: '2px dashed var(--glass-border)', borderRadius: 2 }}>
            <Typography color="text.secondary">{t('pointOnImage.dropImage')}</Typography>
          </Box>
        ) : (
          <Stack spacing={1.5} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {t('pointOnImage.clickCorrectPoint')}
            </Typography>
            <Box
              ref={imageContainerRef}
              onClick={handlePointClick}
              sx={{
                position: 'relative',
                display: 'inline-block',
                maxWidth: '100%',
                cursor: 'crosshair',
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid var(--glass-border)',
              }}
            >
              <Box
                component="img"
                src={image}
                alt={task}
                onLoad={(event: React.SyntheticEvent<HTMLImageElement>) => {
                  const element = event.currentTarget;
                  if (element.naturalWidth > 0 && element.naturalHeight > 0) {
                    const nextRatio = element.naturalWidth / element.naturalHeight;
                    if (!imageAspectRatio || Math.abs(imageAspectRatio - nextRatio) > 0.0001) {
                      onImageAspectRatioChange(nextRatio);
                    }
                  }
                }}
                sx={{ display: 'block', maxWidth: '100%', maxHeight: '60vh', width: 'auto', height: 'auto', pointerEvents: 'none' }}
              />
              {correctPoint && (
                <svg
                  viewBox={`0 0 ${imageSpace.width} ${imageSpace.height}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    overflow: 'hidden',
                  }}
                >
                  <circle
                    cx={correctPoint.x * imageSpace.width}
                    cy={correctPoint.y * imageSpace.height}
                    r={correctnessRadius}
                    fill="#22c55e"
                    fillOpacity="0.16"
                    stroke="#16a34a"
                    strokeWidth="0.01"
                  />
                  <circle
                    cx={correctPoint.x * imageSpace.width}
                    cy={correctPoint.y * imageSpace.height}
                    r="0.016"
                    fill="#16a34a"
                    stroke="#fff"
                    strokeWidth="0.008"
                  />
                </svg>
              )}
            </Box>
            {correctPoint && (
              <Typography variant="caption" color="text.secondary">
                X: {(correctPoint.x * 100).toFixed(1)}%, Y: {(correctPoint.y * 100).toFixed(1)}%
              </Typography>
            )}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
};

export default PointOnImageEditor;
