import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  IconButton,
  Paper,
  Grid,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
  Link as LinkIcon,
  ClearAll as ClearAllIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { ImageMap } from '@qiuz/react-image-map';
import { MapArea } from '../types/pack';

interface FindACatEditorProps {
  image?: string;
  map: MapArea[];
  name: string;
  duration: number;
  onImageChange: (image: string) => void;
  onMapChange: (map: MapArea[]) => void;
  onNameChange: (name: string) => void;
  onDurationChange: (duration: number) => void;
}

const PRESET_COLORS = [
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Yellow
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#ffffff', // White
];

const FindACatEditor: React.FC<FindACatEditorProps> = ({
  image,
  map,
  name,
  duration,
  onImageChange,
  onMapChange,
  onNameChange,
  onDurationChange,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [activeAreaIndex, setActiveAreaIndex] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [tempArea, setTempArea] = useState<MapArea | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Global paste handler to capture images from buffer (clipboard)
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
    
    // First try: Fetch directly (in case of CORS-enabled servers)
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

    // Second try: Load in Image with anonymous crossOrigin and convert to base64 via Canvas
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
            const dataUrl = canvas.toDataURL('image/png');
            onImageChange(dataUrl);
          } catch (canvasErr) {
            alert('CORS restriction on this server prevents automatic conversion to base64. Please save the image to your PC first, then upload it or copy/paste it.');
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

  // Drag-and-drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

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

  // Mouse handlers for drawing rectangles
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !image || previewMode) return;
    const rect = containerRef.current.getBoundingClientRect();
    const startX = ((e.clientX - rect.left) / rect.width) * 100;
    const startY = ((e.clientY - rect.top) / rect.height) * 100;
    
    setDragStart({ x: startX, y: startY });
    setIsDrawing(true);
    setTempArea({
      left: `${startX}%`,
      top: `${startY}%`,
      width: '0%',
      height: '0%',
      color: '#8b5cf6',
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !dragStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;

    const left = Math.min(dragStart.x, currentX);
    const top = Math.min(dragStart.y, currentY);
    const width = Math.abs(currentX - dragStart.x);
    const height = Math.abs(currentY - dragStart.y);

    const clampedLeft = Math.max(0, Math.min(100, left));
    const clampedTop = Math.max(0, Math.min(100, top));
    const clampedWidth = Math.min(100 - clampedLeft, width);
    const clampedHeight = Math.min(100 - clampedTop, height);

    setTempArea({
      left: `${clampedLeft}%`,
      top: `${clampedTop}%`,
      width: `${clampedWidth}%`,
      height: `${clampedHeight}%`,
      color: tempArea?.color || '#8b5cf6',
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !tempArea) return;
    setIsDrawing(false);
    setDragStart(null);

    const w = parseFloat(tempArea.width);
    const h = parseFloat(tempArea.height);

    if (w > 0.5 && h > 0.5) {
      const newArea: MapArea = {
        ...tempArea,
        color: '#8b5cf6',
      };
      const newMap = [...map, newArea];
      onMapChange(newMap);
      setActiveAreaIndex(newMap.length - 1);
    }
    setTempArea(null);
  };

  const handleAreaClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setActiveAreaIndex(index);
  };

  const handleUpdateAreaField = (field: keyof MapArea, value: string) => {
    if (activeAreaIndex === null) return;
    const updatedMap = [...map];
    const isCoordinate = field === 'left' || field === 'top' || field === 'width' || field === 'height';
    const finalValue = isCoordinate && !value.endsWith('%') ? `${value}%` : value;
    updatedMap[activeAreaIndex] = {
      ...updatedMap[activeAreaIndex],
      [field]: finalValue,
    };
    onMapChange(updatedMap);
  };

  const handleDeleteArea = (index: number) => {
    const updatedMap = map.filter((_, i) => i !== index);
    onMapChange(updatedMap);
    if (activeAreaIndex === index) {
      setActiveAreaIndex(null);
    } else if (activeAreaIndex !== null && activeAreaIndex > index) {
      setActiveAreaIndex(activeAreaIndex - 1);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all selected areas?')) {
      onMapChange([]);
      setActiveAreaIndex(null);
    }
  };

  // Convert map to react-image-map expected format
  const mappedAreas = map.map((area, index) => ({
    left: area.left,
    top: area.top,
    width: area.width,
    height: area.height,
    style: {
      background: area.color ? `${area.color}66` : 'rgba(139, 92, 246, 0.4)',
      border: `2px solid ${area.color || '#8b5cf6'}`,
      boxSizing: 'border-box' as const,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '4px',
    },
    render: () => (
      <Box
        sx={{
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: 700,
          background: area.color || '#8b5cf6',
          borderRadius: '50%',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
        }}
      >
        {index + 1}
      </Box>
    ),
  }));

  const activeArea = activeAreaIndex !== null ? map[activeAreaIndex] : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* General Settings: Target and Duration */}
      <Paper sx={{ p: 3, background: 'rgba(19, 26, 54, 0.5)' }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={8}>
            <TextField
              label="What to find? (e.g. котиків)*"
              fullWidth
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. котиків"
              helperText="The target item that players need to search for on the image"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Duration (seconds)*"
              type="number"
              fullWidth
              value={duration}
              onChange={(e) => onDurationChange(parseInt(e.target.value) || 0)}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Image Uploader & Clipboard Listener */}
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
            '&:hover': {
              borderColor: '#8b5cf6',
            },
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 64, color: 'rgba(139, 92, 246, 0.7)', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Drag & Drop image here
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            or click below to upload from PC, load from URL, or press <strong>Ctrl+V</strong> to paste from clipboard
          </Typography>

          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 3 }}>
            <Button
              variant="contained"
              component="label"
              startIcon={<CloudUploadIcon />}
            >
              Upload from PC
              <input type="file" hidden accept="image/*" onChange={handlePcUpload} />
            </Button>
          </Stack>

          <Box sx={{ maxW: '500px', mx: 'auto', display: 'flex', gap: 1 }}>
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
        <Grid container spacing={3}>
          {/* Map Editor Canvas */}
          <Grid item xs={12} md={8}>
            <Paper
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                background: 'rgba(19, 26, 54, 0.5)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  {previewMode ? <VisibilityIcon fontSize="small" /> : <EditIcon fontSize="small" />}
                  {previewMode ? 'Map Preview' : 'Drag & Draw Areas'}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant={previewMode ? 'contained' : 'outlined'}
                    onClick={() => setPreviewMode(!previewMode)}
                    startIcon={<VisibilityIcon />}
                  >
                    {previewMode ? 'Editor Mode' : 'Preview Mode'}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={handleClearAll}
                    disabled={map.length === 0}
                    startIcon={<ClearAllIcon />}
                  >
                    Clear All
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={() => {
                      if (window.confirm('Change image? This will keep defined areas but let you load a new image.')) {
                        onImageChange('');
                      }
                    }}
                  >
                    Change Image
                  </Button>
                </Stack>
              </Box>

              <Box
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                sx={{
                  position: 'relative',
                  width: '100%',
                  userSelect: 'none',
                  cursor: previewMode ? 'default' : 'crosshair',
                  overflow: 'hidden',
                  borderRadius: '8px',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  backgroundColor: '#0a0e27',
                }}
              >
                {previewMode ? (
                  <ImageMap src={image} map={mappedAreas} />
                ) : (
                  <>
                    <Box
                      component="img"
                      src={image}
                      alt="Cat search board"
                      draggable={false}
                      sx={{
                        display: 'block',
                        width: '100%',
                        height: 'auto',
                        pointerEvents: 'none',
                      }}
                    />

                    {/* Render existing areas */}
                    {map.map((area, index) => {
                      const isSelected = activeAreaIndex === index;
                      const areaColor = area.color || '#8b5cf6';
                      return (
                        <Box
                          key={index}
                          onMouseDown={(e) => handleAreaClick(e, index)}
                          sx={{
                            position: 'absolute',
                            left: area.left,
                            top: area.top,
                            width: area.width,
                            height: area.height,
                            background: `${areaColor}55`,
                            border: isSelected
                              ? `2px dashed #ffffff`
                              : `2px solid ${areaColor}`,
                            boxShadow: isSelected
                              ? `0 0 12px ${areaColor}, inset 0 0 8px ${areaColor}`
                              : 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            transition: 'box-shadow 0.2s',
                          }}
                        >
                          <Box
                            sx={{
                              color: '#ffffff',
                              fontSize: '12px',
                              fontWeight: 700,
                              background: areaColor,
                              borderRadius: '50%',
                              width: '20px',
                              height: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                            }}
                          >
                            {index + 1}
                          </Box>
                        </Box>
                      );
                    })}

                    {/* Render active drag/drawing area */}
                    {tempArea && (
                      <Box
                        sx={{
                          position: 'absolute',
                          left: tempArea.left,
                          top: tempArea.top,
                          width: tempArea.width,
                          height: tempArea.height,
                          background: 'rgba(139, 92, 246, 0.3)',
                          border: '2px solid #8b5cf6',
                          pointerEvents: 'none',
                          borderRadius: '4px',
                        }}
                      />
                    )}
                  </>
                )}
              </Box>

              <Typography variant="caption" color="text.secondary">
                {!previewMode && '💡 Drag and draw rectangles over the image to mark where cats (or other targets) are hidden.'}
              </Typography>
            </Paper>
          </Grid>

          {/* Area Details & Controls */}
          <Grid item xs={12} md={4}>
            <Stack spacing={3}>
              <Paper sx={{ p: 3, background: 'rgba(19, 26, 54, 0.5)' }}>
                <Typography variant="h6" gutterBottom>
                  Defined Areas ({map.length})
                </Typography>

                {map.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No areas marked yet. Draw one on the image!
                  </Typography>
                ) : (
                  <Stack spacing={1} sx={{ maxH: '250px', overflowY: 'auto', pr: 1, mb: 2 }}>
                    {map.map((area, index) => {
                      const isSelected = activeAreaIndex === index;
                      const areaColor = area.color || '#8b5cf6';
                      return (
                        <Box
                          key={index}
                          onClick={() => setActiveAreaIndex(index)}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 1.5,
                            borderRadius: '8px',
                            background: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            border: isSelected ? '1px solid #8b5cf6' : '1px solid transparent',
                            cursor: 'pointer',
                            '&:hover': {
                              background: isSelected ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                            },
                          }}
                        >
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box
                              sx={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                background: areaColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: '#ffffff',
                              }}
                            >
                              {index + 1}
                            </Box>
                            <Typography variant="body2">
                              L: {parseFloat(area.left).toFixed(1)}% | T: {parseFloat(area.top).toFixed(1)}%
                            </Typography>
                          </Stack>

                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteArea(index);
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Paper>

              {/* Selected Area Fine Tuning */}
              {activeArea && activeAreaIndex !== null && (
                <Paper sx={{ p: 3, border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(19, 26, 54, 0.6)' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, display: 'flex', justify: 'space-between', alignItems: 'center' }}>
                    Edit Area #{activeAreaIndex + 1}
                  </Typography>

                  {/* Color Selector */}
                  <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                    Area Color:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
                    {PRESET_COLORS.map((col) => {
                      const activeColor = (activeArea.color || '#8b5cf6').toLowerCase();
                      const presetColor = col.toLowerCase();
                      const isSelected = activeColor === presetColor;
                      return (
                        <Tooltip title={col} key={col}>
                          <Box
                            onClick={() => handleUpdateAreaField('color', col)}
                            sx={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: col,
                              cursor: 'pointer',
                              border: isSelected ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.5)',
                              transform: isSelected ? 'scale(1.15)' : 'none',
                              boxShadow: isSelected ? '0 0 8px rgba(255,255,255,0.6)' : 'none',
                              transition: 'all 0.2s',
                              '&:hover': {
                                transform: 'scale(1.15)',
                              },
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                    
                    {/* Custom Color Input */}
                    {(() => {
                      const activeColor = (activeArea.color || '#8b5cf6').toLowerCase();
                      const normalizedPresets = PRESET_COLORS.map(c => c.toLowerCase());
                      const isCustom = !normalizedPresets.includes(activeColor);
                      return (
                        <Box
                          sx={{
                            position: 'relative',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            border: isCustom ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                            transform: isCustom ? 'scale(1.15)' : 'none',
                            boxShadow: isCustom ? '0 0 8px rgba(255,255,255,0.6)' : 'none',
                            transition: 'all 0.2s',
                            '&:hover': {
                              transform: 'scale(1.15)',
                            },
                          }}
                        >
                          <input
                            type="color"
                            value={activeColor}
                            onChange={(e) => handleUpdateAreaField('color', e.target.value)}
                            style={{
                              position: 'absolute',
                              top: '-5px',
                              left: '-5px',
                              width: '40px',
                              height: '40px',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          />
                        </Box>
                      );
                    })()}
                  </Stack>

                  {/* Area Geometry Coordinates Adjusters */}
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField
                        size="small"
                        label="Left (%)"
                        type="number"
                        value={parseFloat(activeArea.left)}
                        onChange={(e) => handleUpdateAreaField('left', `${e.target.value}%`)}
                        inputProps={{ min: 0, max: 100, step: 0.1 }}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        size="small"
                        label="Top (%)"
                        type="number"
                        value={parseFloat(activeArea.top)}
                        onChange={(e) => handleUpdateAreaField('top', `${e.target.value}%`)}
                        inputProps={{ min: 0, max: 100, step: 0.1 }}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        size="small"
                        label="Width (%)"
                        type="number"
                        value={parseFloat(activeArea.width)}
                        onChange={(e) => handleUpdateAreaField('width', `${e.target.value}%`)}
                        inputProps={{ min: 0.1, max: 100, step: 0.1 }}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        size="small"
                        label="Height (%)"
                        type="number"
                        value={parseFloat(activeArea.height)}
                        onChange={(e) => handleUpdateAreaField('height', `${e.target.value}%`)}
                        inputProps={{ min: 0.1, max: 100, step: 0.1 }}
                      />
                    </Grid>
                  </Grid>

                  <Button
                    variant="outlined"
                    color="error"
                    fullWidth
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDeleteArea(activeAreaIndex)}
                    sx={{ mt: 2 }}
                  >
                    Delete Area
                  </Button>
                </Paper>
              )}
            </Stack>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default FindACatEditor;
