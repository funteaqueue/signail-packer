import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, FormControlLabel, MenuItem, Select, Slider, Switch, TextField, Typography } from '@mui/material';
import { useTranslation } from '../i18n/LanguageContext';
import { getSpectrumSegments, SPECTRUM_ZONE_COLORS, wrapSpectrumPosition } from '../utils/spectrum';

interface SpectrumEditorProps {
  left: string;
  right: string;
  range: number;
  targetMode: 'random' | 'fixed';
  target: number;
  riskMode: 'risk' | 'safe';
  clueMode: 'text' | 'verbal';
  firstCorrectBonus: number;
  clueGiverCorrectBonus: number;
  allowSelfPick: boolean;
  duration: number;
  onLeftChange: (value: string) => void;
  onRightChange: (value: string) => void;
  onRangeChange: (value: number) => void;
  onTargetModeChange: (value: 'random' | 'fixed') => void;
  onTargetChange: (value: number) => void;
  onRiskModeChange: (value: 'risk' | 'safe') => void;
  onClueModeChange: (value: 'text' | 'verbal') => void;
  onFirstCorrectBonusChange: (value: number) => void;
  onClueGiverCorrectBonusChange: (value: number) => void;
  onAllowSelfPickChange: (value: boolean) => void;
  onDurationChange: (value: number) => void;
}

const SpectrumEditor: React.FC<SpectrumEditorProps> = ({
  left,
  right,
  range,
  targetMode,
  target,
  riskMode,
  clueMode,
  firstCorrectBonus,
  clueGiverCorrectBonus,
  allowSelfPick,
  duration,
  onLeftChange,
  onRightChange,
  onRangeChange,
  onTargetModeChange,
  onTargetChange,
  onRiskModeChange,
  onClueModeChange,
  onFirstCorrectBonusChange,
  onClueGiverCorrectBonusChange,
  onAllowSelfPickChange,
  onDurationChange,
}) => {
  const { t } = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; target: number } | null>(null);
  const [previewTarget, setPreviewTarget] = useState(() => wrapSpectrumPosition(targetMode === 'fixed' ? target : 50));
  const visibleTarget = targetMode === 'fixed' ? wrapSpectrumPosition(target) : previewTarget;
  const segments = useMemo(() => getSpectrumSegments(visibleTarget, range), [visibleTarget, range]);

  useEffect(() => {
    if (targetMode === 'fixed') setPreviewTarget(wrapSpectrumPosition(target));
  }, [targetMode, target]);

  const setDraggedTarget = (value: number) => {
    const wrapped = Math.round(wrapSpectrumPosition(value) * 10) / 10;
    setPreviewTarget(wrapped);
    if (targetMode === 'fixed') onTargetChange(wrapped);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    dragRef.current = { x: event.clientX, target: visibleTarget };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !trackRef.current) return;
    const width = trackRef.current.getBoundingClientRect().width;
    if (width <= 0) return;
    setDraggedTarget(dragRef.current.target + ((event.clientX - dragRef.current.x) / width) * 100);
  };

  const stopDrag = () => { dragRef.current = null; };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2 }}>
        <TextField
          label={t('spectrum.leftLabel')}
          value={left}
          onChange={event => onLeftChange(event.target.value)}
          required
        />
        <TextField
          label={t('spectrum.rightLabel')}
          value={right}
          onChange={event => onRightChange(event.target.value)}
          required
        />
      </Box>

      <Box sx={{ p: 2.5, borderRadius: 3, border: '1px solid var(--glass-border)', background: 'var(--surface-soft)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 1, color: 'var(--text-primary)', fontWeight: 700 }}>
          <span>{left || t('spectrum.leftFallback')}</span>
          <span style={{ textAlign: 'right' }}>{right || t('spectrum.rightFallback')}</span>
        </Box>
        <Box
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={visibleTarget}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              setDraggedTarget(visibleTarget - 1);
            }
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              setDraggedTarget(visibleTarget + 1);
            }
          }}
          sx={{
            height: 88,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 2,
            border: '2px solid rgba(255,255,255,0.24)',
            cursor: 'grab',
            touchAction: 'none',
            userSelect: 'none',
            '&:active': { cursor: 'grabbing' },
          }}
          aria-label={t('spectrum.dragPreview')}
        >
          {segments.map((segment, index) => (
            <Box
              key={`${segment.start}-${segment.end}-${index}`}
              sx={{
                position: 'absolute',
                left: `${segment.start}%`,
                width: `${segment.end - segment.start}%`,
                top: 0,
                bottom: 0,
                background: segment.multiplier < 0
                  ? `linear-gradient(rgba(75, 85, 99, 0.48), rgba(75, 85, 99, 0.48)), ${segment.color}`
                  : segment.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderRight: '1px solid rgba(0,0,0,0.18)',
                color: segment.multiplier < 0 ? '#f3f4f6' : '#16200f',
                fontSize: '0.72rem',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                textShadow: segment.multiplier < 0
                  ? '0 1px 2px rgba(0,0,0,0.65)'
                  : '0 1px 1px rgba(255,255,255,0.35)',
              }}
            >
              {segment.end - segment.start >= 5 ? segment.label : ''}
            </Box>
          ))}
          <Box sx={{ position: 'absolute', left: `${visibleTarget}%`, top: 0, bottom: 0, width: 3, background: '#fff', boxShadow: '0 0 8px rgba(0,0,0,.8)', transform: 'translateX(-1.5px)' }} />
        </Box>
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'var(--text-secondary)' }}>
          {targetMode === 'random' ? t('spectrum.randomPreviewHint') : t('spectrum.fixedPreviewHint')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1.5 }}>
          {Object.entries(SPECTRUM_ZONE_COLORS).map(([value, color]) => (
            <Box key={value} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              <Box sx={{
                width: 13,
                height: 13,
                borderRadius: '4px',
                background: Number(value) < 0
                  ? `linear-gradient(rgba(75, 85, 99, 0.48), rgba(75, 85, 99, 0.48)), ${color}`
                  : color,
              }} />
              {Number(value) > 0 ? '+' : ''}{Number(value) * 100}%
            </Box>
          ))}
        </Box>
      </Box>

      <Box>
        <Typography gutterBottom sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {t('spectrum.range')}: {range}%
        </Typography>
        <Slider min={1} max={50} step={1} value={range} valueLabelDisplay="auto" onChange={(_, value) => onRangeChange(value as number)} />
        <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>{t('spectrum.rangeHelper')}</Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 2 }}>
        <Box>
          <Typography variant="body2" sx={{ mb: 0.75, color: 'var(--text-secondary)' }}>{t('spectrum.clueMode')}</Typography>
          <Select fullWidth value={clueMode} onChange={event => onClueModeChange(event.target.value as 'text' | 'verbal')}>
            <MenuItem value="text">{t('spectrum.clueText')}</MenuItem>
            <MenuItem value="verbal">{t('spectrum.clueVerbal')}</MenuItem>
          </Select>
          <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'var(--text-secondary)' }}>
            {clueMode === 'verbal' ? t('spectrum.clueVerbalHelper') : t('spectrum.clueTextHelper')}
          </Typography>
        </Box>
        <Box>
          <Typography variant="body2" sx={{ mb: 0.75, color: 'var(--text-secondary)' }}>{t('spectrum.targetMode')}</Typography>
          <Select fullWidth value={targetMode} onChange={event => onTargetModeChange(event.target.value as 'random' | 'fixed')}>
            <MenuItem value="random">{t('spectrum.targetRandom')}</MenuItem>
            <MenuItem value="fixed">{t('spectrum.targetFixed')}</MenuItem>
          </Select>
        </Box>
        <Box>
          <Typography variant="body2" sx={{ mb: 0.75, color: 'var(--text-secondary)' }}>{t('spectrum.riskMode')}</Typography>
          <Select fullWidth value={riskMode} onChange={event => onRiskModeChange(event.target.value as 'risk' | 'safe')}>
            <MenuItem value="risk">{t('spectrum.risk')}</MenuItem>
            <MenuItem value="safe">{t('spectrum.safe')}</MenuItem>
          </Select>
        </Box>
        <TextField
          label={t('question.durationSeconds')}
          type="number"
          value={duration}
          onChange={event => onDurationChange(Math.max(1, Number(event.target.value) || 1))}
          onWheel={event => (event.target as HTMLInputElement).blur()}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2 }}>
        <TextField
          label={t('spectrum.firstCorrectBonus')}
          type="number"
          value={firstCorrectBonus}
          onChange={event => onFirstCorrectBonusChange(Math.max(0, Number(event.target.value) || 0))}
          onWheel={event => (event.target as HTMLInputElement).blur()}
          inputProps={{ min: 0 }}
          helperText={t('spectrum.firstCorrectBonusHelper')}
        />
        <TextField
          label={t('spectrum.clueGiverCorrectBonus')}
          type="number"
          value={clueGiverCorrectBonus}
          onChange={event => onClueGiverCorrectBonusChange(Math.max(0, Number(event.target.value) || 0))}
          onWheel={event => (event.target as HTMLInputElement).blur()}
          inputProps={{ min: 0 }}
          helperText={t('spectrum.clueGiverCorrectBonusHelper')}
        />
      </Box>

      <FormControlLabel
        control={(
          <Switch
            checked={allowSelfPick}
            onChange={event => onAllowSelfPickChange(event.target.checked)}
          />
        )}
        label={t('question.allowSelfPick')}
      />

    </Box>
  );
};

export default SpectrumEditor;
