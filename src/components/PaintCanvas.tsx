import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Slider,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    Close as CloseIcon,
    Brush as BrushIcon,
    Undo as UndoIcon,
    DeleteOutline as DeleteOutlineIcon,
    Check as CheckIcon,
    Image as ImageIcon,
    FormatColorFill as FormatColorFillIcon,
} from '@mui/icons-material';
import { useTranslation } from '../i18n/LanguageContext';

interface PaintCanvasProps {
    open: boolean;
    onClose: () => void;
    onApply: (media: string) => void;
    // When provided, the canvas opens seeded with this image so it can be edited
    initialImage?: string | null;
}

type Tool = 'brush' | 'fill' | 'eraser';

const DEFAULT_W = 720;
const DEFAULT_H = 420;
const MAX_W = 1280;
const MAX_H = 720;
const PALETTE = ['#000000', '#ffffff', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];
// Checkerboard shown behind the (transparent) canvas so the user can tell where
// it is see-through
const CHECKER = {
    backgroundColor: '#ffffff',
    backgroundImage:
        'linear-gradient(45deg, #d0d0d0 25%, transparent 25%), linear-gradient(-45deg, #d0d0d0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d0d0d0 75%), linear-gradient(-45deg, transparent 75%, #d0d0d0 75%)',
    backgroundSize: '16px 16px',
    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
};

const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });

const hexToRgba = (hex: string): [number, number, number, number] => {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
};

// A freehand drawing pad. It can start blank, from an existing image (for
// editing), or with a background image loaded in, over a chosen background
// colour or a transparent background. The canvas layer itself is always kept
// transparent — the background colour is composited in only on export — so the
// background can be changed at any time without destroying the drawing.
const PaintCanvas: React.FC<PaintCanvasProps> = ({ open, onClose, onApply, initialImage }) => {
    const { t } = useTranslation();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const bgInputRef = useRef<HTMLInputElement>(null);
    const drawingRef = useRef(false);
    const lastRef = useRef<{ x: number; y: number } | null>(null);
    const historyRef = useRef<ImageData[]>([]);

    const [dims, setDims] = useState({ w: DEFAULT_W, h: DEFAULT_H });
    const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
    const [baseToken, setBaseToken] = useState(0);
    const [color, setColor] = useState('#000000');
    const [bgColor, setBgColor] = useState<string | null>('#ffffff'); // null = transparent
    const [size, setSize] = useState(4);
    const [tool, setTool] = useState<Tool>('brush');
    const [canUndo, setCanUndo] = useState(false);

    // Scale an image down to fit within the working resolution, keeping aspect
    const fitDims = (img: HTMLImageElement) => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) return { w: DEFAULT_W, h: DEFAULT_H };
        const scale = Math.min(1, MAX_W / w, MAX_H / h);
        return { w: Math.round(w * scale), h: Math.round(h * scale) };
    };

    const applyBase = useCallback((img: HTMLImageElement) => {
        setBaseImage(img);
        setDims(fitDims(img));
        setBaseToken((tk) => tk + 1);
    }, []);

    const resetBlank = useCallback(() => {
        setBaseImage(null);
        setDims({ w: DEFAULT_W, h: DEFAULT_H });
        setBaseToken((tk) => tk + 1);
    }, []);

    // (Re)initialise whenever the dialog opens
    useEffect(() => {
        if (!open) return;
        setColor('#000000');
        setBgColor('#ffffff');
        setSize(4);
        setTool('brush');
        drawingRef.current = false;
        lastRef.current = null;
        if (initialImage) {
            loadImage(initialImage).then(applyBase).catch(resetBlank);
        } else {
            resetBlank();
        }
    }, [open, initialImage, applyBase, resetBlank]);

    // Draw any base image onto the (transparent) canvas after it is sized. Runs
    // after React has applied the width/height attributes (which clear the
    // canvas), so it must come last.
    useLayoutEffect(() => {
        if (!open) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (baseImage) ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
        historyRef.current = [];
        setCanUndo(false);
    }, [open, dims, baseToken, baseImage]);

    const pushHistory = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (historyRef.current.length > 30) historyRef.current.shift();
        setCanUndo(true);
    };

    const undo = useCallback(() => {
        const ctx = canvasRef.current?.getContext('2d');
        const prev = historyRef.current.pop();
        if (ctx && prev) ctx.putImageData(prev, 0, 0);
        setCanUndo(historyRef.current.length > 0);
    }, []);

    // Ctrl+Z / Cmd+Z undoes the last stroke
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                undo();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, undo]);

    const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * canvas.width,
            y: ((e.clientY - rect.top) / rect.height) * canvas.height,
        };
    };

    // 4-way flood fill with a small tolerance for anti-aliased edges
    const floodFill = (startX: number, startY: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const w = canvas.width;
        const h = canvas.height;
        const sx = Math.round(startX);
        const sy = Math.round(startY);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
        const img = ctx.getImageData(0, 0, w, h);
        const data = img.data;
        const at = (x: number, y: number) => (y * w + x) * 4;
        const start = at(sx, sy);
        const target = [data[start], data[start + 1], data[start + 2], data[start + 3]];
        const [fr, fg, fb, fa] = hexToRgba(color);
        if (target[0] === fr && target[1] === fg && target[2] === fb && target[3] === fa) return;
        const tol = 32;
        const matches = (i: number) =>
            Math.abs(data[i] - target[0]) <= tol &&
            Math.abs(data[i + 1] - target[1]) <= tol &&
            Math.abs(data[i + 2] - target[2]) <= tol &&
            Math.abs(data[i + 3] - target[3]) <= tol;
        const stack: number[] = [sx, sy];
        while (stack.length) {
            const y = stack.pop()!;
            const x = stack.pop()!;
            if (x < 0 || y < 0 || x >= w || y >= h) continue;
            const i = at(x, y);
            if (!matches(i)) continue;
            data[i] = fr;
            data[i + 1] = fg;
            data[i + 2] = fb;
            data[i + 3] = fa;
            stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
        }
        ctx.putImageData(img, 0, 0);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        const p = pointFromEvent(e);
        if (tool === 'fill') {
            pushHistory();
            floodFill(p.x, p.y);
            return;
        }
        canvasRef.current?.setPointerCapture(e.pointerId);
        pushHistory();
        drawingRef.current = true;
        lastRef.current = p;
        // Draw a dot so a single click leaves a mark
        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
        ctx.fill();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current) return;
        const ctx = canvasRef.current!.getContext('2d')!;
        const p = pointFromEvent(e);
        const last = lastRef.current!;
        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        lastRef.current = p;
    };

    const endStroke = () => {
        drawingRef.current = false;
        lastRef.current = null;
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) ctx.globalCompositeOperation = 'source-over';
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        pushHistory();
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => loadImage(reader.result as string).then(applyBase).catch(() => {});
            reader.readAsDataURL(file);
        }
        if (bgInputRef.current) bgInputRef.current.value = '';
    };

    const apply = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let url: string;
        if (bgColor) {
            // Composite the drawing over the chosen background colour
            const off = document.createElement('canvas');
            off.width = canvas.width;
            off.height = canvas.height;
            const octx = off.getContext('2d')!;
            octx.fillStyle = bgColor;
            octx.fillRect(0, 0, off.width, off.height);
            octx.drawImage(canvas, 0, 0);
            url = off.toDataURL('image/png');
        } else {
            // Transparent background — export the canvas as-is
            url = canvas.toDataURL('image/png');
        }
        onApply(url);
        onClose();
    };

    const swatchBorder = (c: string) =>
        c.toLowerCase() === '#ffffff' ? '1px solid var(--glass-border)' : '1px solid transparent';

    const transparent = bgColor === null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BrushIcon />
                {initialImage ? t('paint.titleEdit') : t('paint.title')}
                <Box sx={{ flex: 1 }} />
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {/* Row 1: foreground colours + brush size + tools */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {PALETTE.map((c) => (
                            <Box
                                key={c}
                                onClick={() => { setColor(c); if (tool === 'eraser') setTool('brush'); }}
                                sx={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    background: c,
                                    cursor: 'pointer',
                                    border: swatchBorder(c),
                                    outline: tool !== 'eraser' && color === c ? '2px solid var(--primary)' : 'none',
                                    outlineOffset: '2px',
                                }}
                            />
                        ))}
                        <Box
                            component="input"
                            type="color"
                            value={color}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setColor(e.target.value); if (tool === 'eraser') setTool('brush'); }}
                            sx={{ width: 28, height: 28, p: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                            title={t('paint.customColor')}
                        />
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 130 }}>
                        <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                            {t('paint.brushSize')}
                        </Typography>
                        <Slider value={size} min={1} max={40} onChange={(_, v) => typeof v === 'number' && setSize(v)} sx={{ width: 80 }} />
                    </Box>

                    <Box sx={{ flex: 1 }} />

                    <Button variant={tool === 'brush' ? 'contained' : 'outlined'} size="small" startIcon={<BrushIcon />} onClick={() => setTool('brush')}>
                        {t('paint.brush')}
                    </Button>
                    <Button variant={tool === 'fill' ? 'contained' : 'outlined'} size="small" startIcon={<FormatColorFillIcon />} onClick={() => setTool('fill')}>
                        {t('paint.fill')}
                    </Button>
                    <Button variant={tool === 'eraser' ? 'contained' : 'outlined'} size="small" onClick={() => setTool('eraser')}>
                        {t('paint.eraser')}
                    </Button>
                </Box>

                {/* Row 2: background controls + image + undo/clear */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                        {t('paint.bg')}
                    </Typography>
                    <Box
                        component="input"
                        type="color"
                        value={bgColor ?? '#ffffff'}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBgColor(e.target.value)}
                        sx={{ width: 28, height: 28, p: 0, border: 'none', background: 'none', cursor: 'pointer', opacity: transparent ? 0.4 : 1 }}
                        title={t('paint.bgColor')}
                    />
                    <Button variant={transparent ? 'contained' : 'outlined'} size="small" onClick={() => setBgColor(transparent ? '#ffffff' : null)}>
                        {t('paint.transparent')}
                    </Button>
                    <Button variant="outlined" size="small" startIcon={<ImageIcon />} onClick={() => bgInputRef.current?.click()}>
                        {t('paint.image')}
                    </Button>

                    <Box sx={{ flex: 1 }} />

                    <Tooltip title={t('paint.undo')}>
                        <span>
                            <IconButton size="small" onClick={undo} disabled={!canUndo}>
                                <UndoIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={t('paint.clear')}>
                        <IconButton size="small" onClick={clear}>
                            <DeleteOutlineIcon />
                        </IconButton>
                    </Tooltip>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'center', background: 'var(--input-bg)', borderRadius: 1, p: 1 }}>
                    <canvas
                        ref={canvasRef}
                        width={dims.w}
                        height={dims.h}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={endStroke}
                        onPointerLeave={endStroke}
                        style={{
                            width: '100%',
                            maxWidth: dims.w,
                            aspectRatio: `${dims.w} / ${dims.h}`,
                            borderRadius: 6,
                            touchAction: 'none',
                            cursor: 'crosshair',
                            ...(transparent ? CHECKER : { background: bgColor as string }),
                        }}
                    />
                </Box>

                <input type="file" accept="image/*" ref={bgInputRef} style={{ display: 'none' }} onChange={handleBgChange} />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('common.cancel')}</Button>
                <Button variant="contained" startIcon={<CheckIcon />} onClick={apply}>
                    {initialImage ? t('paint.save') : t('paint.insert')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default PaintCanvas;
