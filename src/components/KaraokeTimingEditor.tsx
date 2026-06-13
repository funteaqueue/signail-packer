import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    Dialog,
    Divider,
    IconButton,
    MenuItem,
    Select,
    Typography,
} from '@mui/material';
import {
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    Close as CloseIcon,
    DeleteSweep as DeleteSweepIcon,
    Pause as PauseIcon,
    PlayArrow as PlayArrowIcon,
    Replay5 as Replay5Icon,
    Save as SaveIcon,
    Undo as UndoIcon,
} from '@mui/icons-material';
import { useTranslation } from '../i18n/LanguageContext';

// Interactive word-timing editor: the author taps a key or word as it is sung
// to stamp it with the current playback time. Saved as enhanced LRC -
// "[mm:ss.xx]<mm:ss.xx>Some <mm:ss.xx>words" - which the game renders as a
// per-word karaoke fill and older parsers still read line-by-line.

const LINE_TAG_RE = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const WORD_TAG_RE = /<(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?>/g;
// Pure metadata lines like [ti:...] / [ar:...] are kept verbatim, not timed
const METADATA_LINE_RE = /^\s*\[[a-zA-Z#][^\]]*\]\s*$/;

const matchToMs = (match: RegExpExecArray): number => {
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const frac = match[3] || '';
    const fracMs = frac.length === 0 ? 0
        : frac.length === 1 ? parseInt(frac, 10) * 100
            : frac.length === 2 ? parseInt(frac, 10) * 10
                : parseInt(frac.slice(0, 3), 10);
    return (minutes * 60 + seconds) * 1000 + fracMs;
};

const formatTag = (ms: number): string => {
    const total = Math.max(0, Math.round(ms));
    const m = Math.floor(total / 60000);
    const s = Math.floor((total % 60000) / 1000);
    const cs = Math.floor((total % 1000) / 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
};

const formatClock = (ms: number): string => {
    const total = Math.max(0, ms);
    const m = Math.floor(total / 60000);
    const s = Math.floor((total % 60000) / 1000);
    const d = Math.floor((total % 1000) / 100);
    return `${m}:${String(s).padStart(2, '0')}.${d}`;
};

// Where a word's fill ends when no explicit end is set: the next stamped
// word's start (matches the game renderer), else +1s
const effectiveEnd = (g: number, times: (number | null)[], ends: (number | null)[]): number => {
    const start = times[g];
    if (start === null) return 0;
    const explicit = ends[g];
    if (explicit !== null) return explicit;
    for (let i = g + 1; i < times.length; i++) {
        const tm = times[i];
        if (tm !== null) return Math.max(start + 120, tm);
    }
    return start + 1000;
};

// Configurable transport/tap keys, stored as KeyboardEvent.code so they keep
// working on any keyboard layout
const KEYBINDS_STORAGE = 'karaokeTimingKeys';
const DEFAULT_KEYBINDS = { play: 'Space', tap: 'KeyS' };

const NUDGE_STEPS = [-200, -20, 20, 200];
const NEG_STEPS = NUDGE_STEPS.filter(d => d < 0); // shown left of the label
const POS_STEPS = NUDGE_STEPS.filter(d => d > 0); // shown right of the label

const stepLabel = (d: number): string => `${d > 0 ? '+' : '−'}${Math.abs(d)}`;

const keyLabel = (code: string): string => {
    switch (code) {
        case 'Space': return 'Space';
        case 'ArrowLeft': return '←';
        case 'ArrowRight': return '→';
        case 'ArrowUp': return '↑';
        case 'ArrowDown': return '↓';
        default: return code.replace(/^Key/, '').replace(/^Digit/, '');
    }
};

export interface DocLine {
    /** Verbatim line ([ti:...] metadata etc.) excluded from timing, or null */
    passthrough: string | null;
    /** Line time from an existing [mm:ss.xx] tag, if any */
    origTimeMs: number | null;
    words: string[];
    /** Index of the first word in the flat times array */
    startIdx: number;
}

// Lyrics text (plain, LRC or enhanced LRC) -> lines + flat per-word times.
// `ends` are explicit word END times (A2 convention: a tag right after a word
// with no word between - "<..>word<..>" or a trailing tag - ends that word).
export const parseDoc = (lyrics: string): { lines: DocLine[]; times: (number | null)[]; ends: (number | null)[] } => {
    const lines: DocLine[] = [];
    const times: (number | null)[] = [];
    const ends: (number | null)[] = [];
    for (const raw of String(lyrics || '').split(/\r?\n/)) {
        if (METADATA_LINE_RE.test(raw)) {
            lines.push({ passthrough: raw, origTimeMs: null, words: [], startIdx: times.length });
            continue;
        }
        // Contiguous prefix of [..] line tags (same rule as the game parser)
        let origTimeMs: number | null = null;
        let tail = 0;
        LINE_TAG_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = LINE_TAG_RE.exec(raw)) !== null) {
            if (match.index !== tail) break;
            const ms = matchToMs(match);
            if (origTimeMs === null || ms < origTimeMs) origTimeMs = ms;
            tail = LINE_TAG_RE.lastIndex;
        }
        const content = raw.slice(tail);
        const words: string[] = [];
        const startIdx = times.length;
        let pending: number | null = null;
        let sliceStart = 0;
        const pushSegment = (segment: string) => {
            for (const part of segment.split(/\s+/)) {
                if (!part) continue;
                words.push(part);
                times.push(pending);
                ends.push(null);
                pending = null;
            }
        };
        WORD_TAG_RE.lastIndex = 0;
        while ((match = WORD_TAG_RE.exec(content)) !== null) {
            pushSegment(content.slice(sliceStart, match.index));
            const ms = matchToMs(match);
            const prevChar = match.index > 0 ? content[match.index - 1] : '';
            const lastEndOpen = times.length > startIdx && ends[ends.length - 1] === null;
            if (pending !== null && lastEndOpen) {
                // Two tags with no word between: the first one ended the
                // previous word, this one opens the next
                ends[ends.length - 1] = pending;
                pending = ms;
            } else if (prevChar && prevChar !== '>' && !/\s/.test(prevChar) && lastEndOpen) {
                // Glued right onto the word ("word<mm:ss.xx>"): its end -
                // even when untimed words follow
                ends[ends.length - 1] = ms;
            } else {
                pending = ms;
            }
            sliceStart = WORD_TAG_RE.lastIndex;
        }
        pushSegment(content.slice(sliceStart));
        if (pending !== null && times.length > startIdx && ends[ends.length - 1] === null) {
            ends[ends.length - 1] = pending; // trailing tag ends the last word
        }
        lines.push({ passthrough: null, origTimeMs, words, startIdx });
    }
    return { lines, times, ends };
};

export const serializeDoc = (
    lines: DocLine[],
    times: (number | null)[],
    ends: (number | null)[]
): { lyrics: string; anyTimed: boolean } => {
    const anyWordTimed = times.some(t => t !== null);
    const anyLineTagged = lines.some(l => l.passthrough === null && l.origTimeMs !== null);
    const withTags = anyWordTimed || anyLineTagged;
    let lastTime = 0;
    const out: string[] = [];
    for (const line of lines) {
        if (line.passthrough !== null) {
            out.push(line.passthrough);
            continue;
        }
        if (line.words.length === 0) {
            out.push('');
            continue;
        }
        const wordTimes = times.slice(line.startIdx, line.startIdx + line.words.length);
        const wordEnds = ends.slice(line.startIdx, line.startIdx + line.words.length);
        const firstTimed = wordTimes.find(t => t !== null) ?? null;
        // Untimed lines inherit the previous time so the LRC stays parseable
        const lineTime = firstTimed ?? line.origTimeMs ?? lastTime;
        lastTime = Math.max(
            lastTime,
            lineTime,
            ...wordTimes.filter((t): t is number => t !== null),
            ...wordEnds.filter((t): t is number => t !== null)
        );
        const body = line.words
            .map((w, i) => {
                let token = wordTimes[i] !== null ? `<${formatTag(wordTimes[i] as number)}>${w}` : w;
                // Explicit end rides as an A2 tag right after the word
                if (wordTimes[i] !== null && wordEnds[i] !== null) {
                    token += `<${formatTag(wordEnds[i] as number)}>`;
                }
                return token;
            })
            .join(' ');
        out.push(withTags ? `[${formatTag(lineTime)}]${body}` : body);
    }
    return { lyrics: out.join('\n'), anyTimed: withTags };
};

const dataUrlToBytes = (dataUrl: string): { bytes: Uint8Array; mime: string } | null => {
    if (!dataUrl.startsWith('data:')) return null;
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    const mime = dataUrl.slice(5, comma).split(';')[0] || 'application/octet-stream';
    try {
        const binary = atob(dataUrl.slice(comma + 1));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return { bytes, mime };
    } catch {
        return null;
    }
};

// ---------- one lyrics line ----------

interface LineRowProps {
    line: DocLine;
    li: number;
    times: (number | null)[];
    ends: (number | null)[];
    conflicts: Set<number>;
    /** -1 line not reached | current ms while the line is live | MAX done */
    lineNow: number;
    /** Global index of the active (filling) word in this line, or -1 */
    activeIdx: number;
    /** 0..100 fill of the active word, or -1 */
    activeProgress: number;
    /** Global index of the tap-armed word in this line, or -1 */
    armedIdx: number;
    /** Global index of the selected (fine-tune) word in this line, or -1 */
    selectedIdx: number;
    lineEls: React.MutableRefObject<(HTMLDivElement | null)[]>;
}

const LineRow = React.memo<LineRowProps>(({ line, li, times, ends, conflicts, lineNow, activeIdx, activeProgress, armedIdx, selectedIdx, lineEls }) => {
    if (line.passthrough !== null) {
        return (
            <Box sx={{ opacity: 0.4, fontFamily: 'monospace', fontSize: '0.85rem', py: 0.25 }}>
                {line.passthrough}
            </Box>
        );
    }
    if (line.words.length === 0) {
        return <Box sx={{ height: '1.1rem' }} />;
    }
    let firstTimed: number | null = null;
    for (let i = 0; i < line.words.length; i++) {
        const tm = times[line.startIdx + i];
        if (tm !== null) { firstTimed = tm; break; }
    }
    return (
        <Box
            ref={(el: HTMLDivElement | null) => { lineEls.current[li] = el; }}
            sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: '0.55rem', rowGap: '0.3rem', py: 0.4 }}
        >
            <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: '4.6em' }}>
                {firstTimed !== null ? formatTag(firstTimed) : ''}
            </Box>
            {line.words.map((word, i) => {
                const g = line.startIdx + i;
                const tm = times[g];
                const endMs = ends[g];
                const timed = tm !== null;
                const isActive = g === activeIdx && activeProgress >= 0;
                const sung = timed && !isActive && lineNow >= (tm as number);
                const conflict = conflicts.has(g);
                const style: React.CSSProperties = {
                    padding: '0 0.1em',
                    cursor: 'pointer',
                    fontSize: '1.45rem',
                    fontWeight: 600,
                    lineHeight: 1.6,
                    borderBottom: `2px ${timed ? 'solid' : 'dashed'} ${conflict ? 'var(--danger)' : timed ? 'var(--primary)' : 'var(--glass-border)'}`,
                    color: sung ? 'var(--accent)' : timed ? 'var(--text-primary)' : 'var(--text-secondary)',
                };
                if (g === selectedIdx) {
                    style.outline = '2px dashed var(--primary)';
                    style.outlineOffset = '3px';
                    style.borderRadius = '6px';
                }
                if (isActive) {
                    style.backgroundImage = `linear-gradient(90deg, var(--accent) ${activeProgress}%, var(--text-primary) ${activeProgress}%)`;
                    style.WebkitBackgroundClip = 'text';
                    style.backgroundClip = 'text';
                    style.WebkitTextFillColor = 'transparent';
                    style.color = 'transparent';
                    style.filter = 'drop-shadow(0 0 9px var(--accent-glow))';
                }
                if (g === armedIdx) {
                    // The word the next Space press will stamp (tap mode)
                    style.outline = '2px solid var(--accent)';
                    style.outlineOffset = '3px';
                    style.borderRadius = '6px';
                    style.background = 'var(--accent-soft)';
                }
                const tooltip = !timed ? undefined
                    : endMs !== null ? `${formatTag(tm as number)} – ${formatTag(endMs)}`
                        : formatTag(tm as number);
                return (
                    <span key={i} data-w={g} title={tooltip} style={style}>
                        {word}
                    </span>
                );
            })}
        </Box>
    );
});

// ---------- the editor dialog ----------

interface KaraokeTimingEditorProps {
    open: boolean;
    media: string;
    lyrics: string;
    onClose: () => void;
    onSave: (lyrics: string, anyTimed: boolean) => void;
}

const KaraokeTimingEditor: React.FC<KaraokeTimingEditorProps> = ({ open, media, lyrics, onClose, onSave }) => {
    const { t } = useTranslation();

    const [doc, setDoc] = useState<DocLine[]>([]);
    const [times, setTimes] = useState<(number | null)[]>([]);
    const [ends, setEnds] = useState<(number | null)[]>([]);
    const [selected, setSelected] = useState(-1);
    const [selectNonce, setSelectNonce] = useState(0);
    const [zoomWin, setZoomWin] = useState<{ t0: number; span: number } | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [durationMs, setDurationMs] = useState(0);
    const [speed, setSpeed] = useState(1);
    const [keyBinds, setKeyBinds] = useState<{ play: string; tap: string }>(() => {
        try {
            const stored = JSON.parse(localStorage.getItem(KEYBINDS_STORAGE) || '');
            if (stored && typeof stored.play === 'string' && typeof stored.tap === 'string') {
                return { play: stored.play, tap: stored.tap };
            }
        } catch { /* fall through to defaults */ }
        return { ...DEFAULT_KEYBINDS };
    });
    const [capturing, setCapturing] = useState<'play' | 'tap' | null>(null);
    const [tapCursor, setTapCursor] = useState(0);
    const [nowMs, setNowMs] = useState(0);
    const [dirty, setDirty] = useState(false);
    const [undoCount, setUndoCount] = useState(0);
    const [peaks, setPeaks] = useState<number[] | null>(null);
    const [mediaSrc, setMediaSrc] = useState<string | undefined>(undefined);

    const mediaRef = useRef<HTMLMediaElement | null>(null);
    const timesRef = useRef<(number | null)[]>([]);
    const endsRef = useRef<(number | null)[]>([]);
    const undoRef = useRef<{ t: (number | null)[]; e: (number | null)[] }[]>([]);
    const previewStopRef = useRef<number | null>(null);
    const finePeaksRef = useRef<Float32Array | null>(null); // 10ms buckets for the zoom strip
    const zoomWinRef = useRef<{ t0: number; span: number } | null>(null);
    const zoomBoxRef = useRef<HTMLDivElement | null>(null);
    const zoomCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const zoomPlayheadRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<{
        /** Word being dragged, or -1 when panning the window itself */
        g: number;
        zone: 'move' | 'start' | 'end' | 'pan';
        downX: number;
        /** Word start at pointer-down, or the window t0 for 'pan' */
        origStart: number;
        origEnd: number | null;
        origEff: number;
        msPerPx: number;
        /** Left the click dead-zone (a few px) at least once */
        moved: boolean;
    } | null>(null);
    // Last manual strip navigation (pan/arrows/wheel/word drag): the playback
    // auto-follow keeps its hands off the window for a moment after it
    const lastStripNavRef = useRef(0);
    // A held tap key: keydown stamped this word, keyup will set its length
    const tapHoldRef = useRef<{ g: number; startMs: number } | null>(null);
    const pointerHoldRef = useRef<{ g: number; startMs: number; pointerId: number } | null>(null);
    const tapCursorRef = useRef(0);
    const lastStampWallRef = useRef(0);
    const lastWheelRef = useRef(0);
    const lyricsBoxRef = useRef<HTMLDivElement | null>(null);
    const lineEls = useRef<(HTMLDivElement | null)[]>([]);
    const waveBoxRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const playheadRef = useRef<HTMLDivElement | null>(null);
    const playedRef = useRef<HTMLDivElement | null>(null);
    const clockRef = useRef<HTMLSpanElement | null>(null);

    useEffect(() => { timesRef.current = times; }, [times]);
    useEffect(() => { endsRef.current = ends; }, [ends]);

    // Next word to stamp from the keyboard: ref for handlers (rapid taps
    // must not wait for a re-render), state for the armed-word highlight
    const setCursor = (g: number) => {
        tapCursorRef.current = g;
        setTapCursor(g);
    };

    // Fresh editing session on every open
    useEffect(() => {
        if (!open) return;
        const parsed = parseDoc(lyrics);
        setDoc(parsed.lines);
        setTimes(parsed.times);
        timesRef.current = parsed.times;
        setEnds(parsed.ends);
        endsRef.current = parsed.ends;
        setSelected(-1);
        undoRef.current = [];
        setUndoCount(0);
        setDirty(false);
        setIsPlaying(false);
        setDurationMs(0);
        setNowMs(0);
        setPeaks(null);
        const firstUntimed = parsed.times.findIndex(tm => tm === null);
        setCursor(firstUntimed === -1 ? parsed.times.length : firstUntimed);
        tapHoldRef.current = null;
        pointerHoldRef.current = null;
        lastStampWallRef.current = 0;
        lineEls.current = [];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Element src: a Blob URL (minted per open - data URLs make miserable src)
    useEffect(() => {
        if (!open || !media) return;
        const decoded = dataUrlToBytes(media);
        if (!decoded) {
            setMediaSrc(media);
            return () => setMediaSrc(undefined);
        }
        const buffer = new ArrayBuffer(decoded.bytes.length);
        new Uint8Array(buffer).set(decoded.bytes);
        const url = URL.createObjectURL(new Blob([buffer], { type: decoded.mime }));
        setMediaSrc(url);
        return () => {
            URL.revokeObjectURL(url);
            setMediaSrc(undefined);
        };
    }, [open, media]);

    // Waveform peaks (decode the audio track; videos may fail -> flat bar)
    useEffect(() => {
        if (!open || !media) return;
        let cancelled = false;
        finePeaksRef.current = null;
        (async () => {
            try {
                const decoded = dataUrlToBytes(media);
                if (!decoded) return;
                const AC: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                const ctx = new AC();
                const buffer = new ArrayBuffer(decoded.bytes.length);
                new Uint8Array(buffer).set(decoded.bytes);
                const audio = await ctx.decodeAudioData(buffer);
                const ch = audio.getChannelData(0);
                const buckets = 1200;
                const per = Math.max(1, Math.floor(ch.length / buckets));
                const result: number[] = [];
                for (let b = 0; b < buckets; b++) {
                    let peak = 0;
                    const from = b * per;
                    const to = Math.min(ch.length, from + per);
                    // Sampling every 16th value is plenty for a visual peak
                    for (let i = from; i < to; i += 16) {
                        const v = Math.abs(ch[i]);
                        if (v > peak) peak = v;
                    }
                    result.push(peak);
                }
                // High-res lane for the per-word zoom strip: 10ms buckets
                const fineBuckets = Math.max(1, Math.ceil(audio.duration * 100));
                const fine = new Float32Array(fineBuckets);
                const perFine = ch.length / fineBuckets;
                for (let b = 0; b < fineBuckets; b++) {
                    let peak = 0;
                    const from = Math.floor(b * perFine);
                    const to = Math.min(ch.length, Math.floor((b + 1) * perFine));
                    for (let i = from; i < to; i += 4) {
                        const v = Math.abs(ch[i]);
                        if (v > peak) peak = v;
                    }
                    fine[b] = peak;
                }
                ctx.close();
                if (!cancelled) {
                    finePeaksRef.current = fine;
                    setPeaks(result);
                }
            } catch {
                // Not decodable (some video containers) - keep the flat bar
            }
        })();
        return () => { cancelled = true; };
    }, [open, media]);

    useEffect(() => {
        if (mediaRef.current) mediaRef.current.playbackRate = speed;
    }, [speed, mediaSrc]);

    useEffect(() => {
        try { localStorage.setItem(KEYBINDS_STORAGE, JSON.stringify(keyBinds)); } catch { /* private mode */ }
    }, [keyBinds]);

    // Clock: smooth playhead/clock via refs, word highlight via ~25fps state
    useEffect(() => {
        if (!open) return;
        let raf = 0;
        const tick = () => {
            const el = mediaRef.current;
            if (el) {
                const ms = el.currentTime * 1000;
                // Single-word preview reached its end: stop there
                if (previewStopRef.current !== null && !el.paused && ms >= previewStopRef.current) {
                    previewStopRef.current = null;
                    el.pause();
                }
                setNowMs(Math.round(ms / 40) * 40);
                const dur = el.duration;
                if (Number.isFinite(dur) && dur > 0) {
                    const pct = `${Math.min(100, (el.currentTime / dur) * 100)}%`;
                    if (playheadRef.current) playheadRef.current.style.left = pct;
                    if (playedRef.current) playedRef.current.style.width = pct;
                }
                const win = zoomWinRef.current;
                if (zoomPlayheadRef.current) {
                    if (win && ms >= win.t0 && ms <= win.t0 + win.span) {
                        zoomPlayheadRef.current.style.display = 'block';
                        zoomPlayheadRef.current.style.left = `${((ms - win.t0) / win.span) * 100}%`;
                    } else {
                        zoomPlayheadRef.current.style.display = 'none';
                    }
                }
                if (clockRef.current) clockRef.current.textContent = formatClock(ms);
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [open]);

    // ---------- editing ops ----------

    const pushUndo = () => {
        undoRef.current.push({ t: timesRef.current, e: endsRef.current });
        if (undoRef.current.length > 100) undoRef.current.shift();
        setUndoCount(undoRef.current.length);
    };

    // Rapid consecutive edits (sweep stamps, nudge-button mashing) group into
    // one undo step; a pause starts a new gesture. ownStep forces a step.
    const beginGesture = (ownStep = false) => {
        const wall = Date.now();
        if (ownStep || wall - lastStampWallRef.current > 800) pushUndo();
        lastStampWallRef.current = wall;
    };

    // Every stamped word owns an explicit duration so words stay independent:
    // a pause between words never stretches the previous word's fill, and
    // moving one word never changes a neighbor. The default length is capped
    // by an already-stamped next word; stamping the NEXT word truncates this
    // one's overhang (continuous singing), but later edits never couple them.
    const DEFAULT_WORD_MS = 600;

    // Keyboard taps get their own undo step each (ownUndoStep)
    const stampWord = (g: number, ownUndoStep = false): number | null => {
        const el = mediaRef.current;
        if (!el || el.paused) return null;
        const stampMs = Math.round(el.currentTime * 1000);
        beginGesture(ownUndoStep);
        const starts = timesRef.current;
        let nextStart = Infinity;
        let prevIdx = -1;
        let prevStart = -1;
        for (let i = 0; i < starts.length; i++) {
            const tm = starts[i];
            if (i === g || tm === null) continue;
            if (tm > stampMs && tm < nextStart) nextStart = tm;
            if (tm < stampMs && tm >= prevStart) { prevStart = tm; prevIdx = i; }
        }
        const ownEnd = Math.max(stampMs + 40, Math.min(stampMs + DEFAULT_WORD_MS, nextStart));
        const prevEnd = prevIdx >= 0 ? endsRef.current[prevIdx] : null;
        const truncatePrev = prevEnd !== null && prevEnd > stampMs;
        const nextTimes = starts.map((tm, i) => (i === g ? stampMs : tm));
        const nextEnds = endsRef.current.map((em, i) => {
            if (i === g) return ownEnd;
            if (truncatePrev && i === prevIdx) return Math.max(prevStart + 40, stampMs);
            return em;
        });
        timesRef.current = nextTimes;
        endsRef.current = nextEnds;
        setTimes(nextTimes);
        setEnds(nextEnds);
        setCursor(g + 1);
        setDirty(true);
        return stampMs;
    };

    const clearWord = (g: number) => {
        if (timesRef.current[g] === null) return;
        pushUndo();
        lastStampWallRef.current = 0;
        setTimes(prev => prev.map((tm, i) => (i === g ? null : tm)));
        setEnds(prev => prev.map((em, i) => (i === g ? null : em)));
        setDirty(true);
    };

    const clearAll = () => {
        if (!timesRef.current.some(tm => tm !== null)) return;
        if (!window.confirm(t('timing.clearAllConfirm'))) return;
        pushUndo();
        lastStampWallRef.current = 0;
        setTimes(prev => prev.map(() => null));
        setEnds(prev => prev.map(() => null));
        setCursor(0);
        setDirty(true);
    };

    const shiftAll = (deltaMs: number) => {
        if (!timesRef.current.some(tm => tm !== null)) return;
        pushUndo();
        lastStampWallRef.current = 0;
        setTimes(prev => prev.map(tm => (tm === null ? null : Math.max(0, tm + deltaMs))));
        setEnds(prev => prev.map(em => (em === null ? null : Math.max(0, em + deltaMs))));
        setDirty(true);
    };

    const undo = () => {
        const snapshot = undoRef.current.pop();
        if (!snapshot) return;
        setUndoCount(undoRef.current.length);
        lastStampWallRef.current = 0;
        // Park the cursor on the first reverted word so it can be re-tapped
        const current = timesRef.current;
        for (let i = 0; i < snapshot.t.length; i++) {
            if (snapshot.t[i] !== current[i]) {
                setCursor(i);
                break;
            }
        }
        setTimes(snapshot.t);
        setEnds(snapshot.e);
        setDirty(true);
    };

    // ---------- per-word fine-tuning (selected word) ----------

    const effectiveEndOf = (g: number): number => effectiveEnd(g, timesRef.current, endsRef.current);

    // Moving the start slides the WHOLE word - its length stays the same.
    // (Use the strip's left edge to change where it starts without moving
    // the end.) Words with no explicit end (legacy lyrics) just move.
    const nudgeStart = (g: number, deltaMs: number) => {
        const start = timesRef.current[g];
        if (start === null) return;
        beginGesture();
        const next = Math.max(0, durationMs > 0 ? Math.min(durationMs, start + deltaMs) : start + deltaMs);
        const applied = next - start;
        setTimes(prev => prev.map((tm, i) => (i === g ? next : tm)));
        const explicit = endsRef.current[g];
        if (explicit !== null) {
            setEnds(prev => prev.map((em, i) => (i === g ? Math.max(next + 40, explicit + applied) : em)));
        }
        setDirty(true);
    };

    // "Faster" (-) / "slower" (+): moves the word's END, giving it its own
    // sweep length independent of the next word's start
    const nudgeEnd = (g: number, deltaMs: number) => {
        const start = timesRef.current[g];
        if (start === null) return;
        beginGesture();
        const base = effectiveEndOf(g);
        let next = Math.max(start + 40, base + deltaMs);
        if (durationMs > 0) next = Math.min(durationMs, next);
        setEnds(prev => prev.map((em, i) => (i === g ? next : em)));
        setDirty(true);
    };

    const resetEnd = (g: number) => {
        if (endsRef.current[g] === null) return;
        beginGesture(true);
        setEnds(prev => prev.map((em, i) => (i === g ? null : em)));
        setDirty(true);
    };

    // Listen to just this word: a 300ms lead-in, stop shortly after its end
    const playWord = (g: number) => {
        const el = mediaRef.current;
        const start = timesRef.current[g];
        if (!el || start === null) return;
        previewStopRef.current = effectiveEndOf(g) + 150;
        el.currentTime = Math.max(0, (start - 300) / 1000);
        el.play().catch(() => {});
    };

    // ---------- zoomed drag strip for the selected word ----------

    // Window around the selection; fixed while dragging (re-click recenters)
    useEffect(() => {
        if (!open || selected < 0 || timesRef.current[selected] === null) {
            setZoomWin(null);
            zoomWinRef.current = null;
            return;
        }
        const start = timesRef.current[selected] as number;
        const len = Math.max(200, effectiveEndOf(selected) - start);
        const span = Math.max(3000, len + 2400);
        const win = { t0: Math.max(0, start - (span - len) / 2), span };
        setZoomWin(win);
        zoomWinRef.current = win;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, selected, selectNonce]);

    // While the track plays, follow the playhead: once it runs past 85% of
    // the window (or sits behind it after a seek), flip the page so the
    // words being sung right now stay visible. Recent manual navigation or
    // an active drag wins, like the lyrics autoscroll.
    useEffect(() => {
        if (!open || !isPlaying) return;
        const win = zoomWinRef.current;
        if (!win || dragRef.current) return;
        if (Date.now() - lastStripNavRef.current < 2500) return;
        if (nowMs >= win.t0 && nowMs <= win.t0 + win.span * 0.85) return;
        const maxT0 = durationMs > 0 ? Math.max(0, durationMs - win.span) : Infinity;
        const t0 = Math.min(Math.max(0, nowMs - win.span * 0.15), maxT0);
        if (t0 === win.t0) return;
        const next = { t0, span: win.span };
        zoomWinRef.current = next;
        setZoomWin(next);
    }, [open, isPlaying, nowMs, durationMs]);

    // Slide the zoom window along the track (arrows, Shift+wheel, pan drag)
    const panWindowBy = (deltaMs: number) => {
        const win = zoomWinRef.current;
        if (!win) return;
        lastStripNavRef.current = Date.now();
        const maxT0 = durationMs > 0 ? Math.max(0, durationMs - win.span) : Infinity;
        const t0 = Math.min(Math.max(0, win.t0 + deltaMs), maxT0);
        const next = { t0, span: win.span };
        zoomWinRef.current = next;
        setZoomWin(next);
    };

    // Shift+wheel scrolls through the track (some platforms report a held
    // Shift as deltaX instead of deltaY - take whichever moved)
    const handleZoomWheel = (e: React.WheelEvent) => {
        if (!e.shiftKey) return;
        const win = zoomWinRef.current;
        if (!win) return;
        const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        panWindowBy((delta / 100) * win.span * 0.15);
    };

    const handleZoomPointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        const box = zoomBoxRef.current;
        const win = zoomWinRef.current;
        if (!box || !win || selected < 0) return;
        const rect = box.getBoundingClientRect();
        lastStripNavRef.current = Date.now();
        const target = e.target as HTMLElement;
        const zone = target.getAttribute('data-zone') as 'move' | 'start' | 'end' | null;
        // The selected block carries move/start/end zones; other words'
        // blocks carry data-g and can only be moved (a plain click selects)
        let g = zone !== null ? selected : -1;
        if (g < 0) {
            const hit = target.closest('[data-g]');
            const attr = hit?.getAttribute('data-g');
            if (attr !== null && attr !== undefined && Number.isFinite(Number(attr))) g = Number(attr);
        }
        if (g < 0) {
            // Background: dragging pans the window; a motionless click seeks
            // (decided on pointer-up, once it is clear no pan happened)
            dragRef.current = {
                g: -1,
                zone: 'pan',
                downX: e.clientX,
                origStart: win.t0,
                origEnd: null,
                origEff: 0,
                msPerPx: win.span / rect.width,
                moved: false,
            };
            try { box.setPointerCapture(e.pointerId); } catch { /* keep dragging uncaptured */ }
            e.preventDefault();
            return;
        }
        const start = timesRef.current[g];
        if (start === null) return;
        pushUndo();
        lastStampWallRef.current = 0;
        dragRef.current = {
            g,
            zone: zone ?? 'move',
            downX: e.clientX,
            origStart: start,
            origEnd: endsRef.current[g],
            origEff: effectiveEndOf(g),
            msPerPx: win.span / rect.width,
            moved: false,
        };
        try { box.setPointerCapture(e.pointerId); } catch { /* keep dragging uncaptured */ }
        e.preventDefault();
    };

    const handleZoomPointerMove = (e: React.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        lastStripNavRef.current = Date.now();
        const dxPx = e.clientX - drag.downX;
        if (Math.abs(dxPx) > 3) drag.moved = true;
        if (drag.zone === 'pan') {
            if (!drag.moved) return;
            const win = zoomWinRef.current;
            if (!win) return;
            // Grab-the-content: dragging right shows earlier time
            let t0 = drag.origStart - dxPx * drag.msPerPx;
            const maxT0 = durationMs > 0 ? Math.max(0, durationMs - win.span) : Infinity;
            t0 = Math.min(Math.max(0, t0), maxT0);
            const next = { t0, span: win.span };
            zoomWinRef.current = next;
            setZoomWin(next);
            return;
        }
        const g = drag.g;
        const dt = Math.round((dxPx * drag.msPerPx) / 10) * 10;
        const dur = durationMs > 0 ? durationMs : Infinity;
        if (drag.zone === 'move') {
            // Slide the whole word: length is preserved, neighbors untouched
            const len = drag.origEff - drag.origStart;
            const ns = Math.min(Math.max(0, drag.origStart + dt), dur === Infinity ? drag.origStart + dt : Math.max(0, dur - len));
            setTimes(prev => prev.map((tm, i) => (i === g ? ns : tm)));
            setEnds(prev => prev.map((em, i) => (i === g ? ns + len : em)));
        } else if (drag.zone === 'start') {
            // Left edge: only when the word starts; the end stays put
            const limit = (drag.origEnd ?? drag.origEff) - 40;
            const ns = Math.min(Math.max(0, drag.origStart + dt), limit);
            setTimes(prev => prev.map((tm, i) => (i === g ? ns : tm)));
        } else {
            // Right edge: only how long the word is sung
            const ne = Math.min(Math.max(drag.origStart + 40, drag.origEff + dt), dur);
            setEnds(prev => prev.map((em, i) => (i === g ? ne : em)));
        }
        setDirty(true);
    };

    const handleZoomPointerUp = (e: React.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        dragRef.current = null;
        if (drag.zone === 'pan') {
            // Motionless background click: seek there to listen
            if (drag.moved || e.type !== 'pointerup') return;
            const el = mediaRef.current;
            const box = zoomBoxRef.current;
            const win = zoomWinRef.current;
            if (el && box && win && Number.isFinite(el.duration)) {
                const rect = box.getBoundingClientRect();
                const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                el.currentTime = Math.min(el.duration, Math.max(0, (win.t0 + frac * win.span) / 1000));
            }
            return;
        }
        // A click without movement should not burn an undo step
        if (timesRef.current[drag.g] === drag.origStart
            && endsRef.current[drag.g] === drag.origEnd) {
            undoRef.current.pop();
            setUndoCount(undoRef.current.length);
            // Plain click on another word's block: select it instead
            if (drag.g !== selected) {
                setSelected(drag.g);
                setSelectNonce(n => n + 1);
            }
        }
    };

    const togglePlay = () => {
        const el = mediaRef.current;
        if (!el) return;
        previewStopRef.current = null; // manual transport cancels word preview
        if (el.paused) {
            el.play().catch(() => {});
        } else {
            el.pause();
        }
    };

    const seekRel = (deltaSec: number) => {
        const el = mediaRef.current;
        if (!el || !Number.isFinite(el.duration)) return;
        el.currentTime = Math.min(el.duration, Math.max(0, el.currentTime + deltaSec));
    };

    const save = () => {
        const result = serializeDoc(doc, timesRef.current, endsRef.current);
        onSave(result.lyrics, result.anyTimed);
    };

    const requestClose = () => {
        if (dirty && !window.confirm(t('timing.discardConfirm'))) return;
        onClose();
    };

    // Keyboard: configurable play/pause + tap keys (Enter always taps too),
    // Ctrl+Z = undo, arrows = seek. Holding the tap key sets the word's
    // length: keydown stamps the start, keyup marks where the singing ends
    // (quick taps keep the default length). The whole handler lives behind a
    // ref so the window listener never sees stale state; capture phase lets
    // Escape cancel a key-capture before the dialog reacts to it.
    const actionsRef = useRef<{ onKey: (e: KeyboardEvent) => void; onKeyUp: (e: KeyboardEvent) => void }>({
        onKey: () => {},
        onKeyUp: () => {},
    });
    actionsRef.current = {
        onKeyUp: (e: KeyboardEvent) => {
            if (capturing) return;
            if (e.code !== keyBinds.tap && e.key !== 'Enter') return;
            const hold = tapHoldRef.current;
            tapHoldRef.current = null;
            if (!hold) return;
            const el = mediaRef.current;
            if (!el || el.paused) return; // paused mid-hold: keep the default
            const start = timesRef.current[hold.g];
            if (start === null) return; // undone mid-hold
            const releaseMs = Math.round(el.currentTime * 1000);
            // An ordinary key press lasts up to ~250ms - only a clearly
            // deliberate hold sets the length; plain taps keep the default
            if (releaseMs - hold.startMs < 300) return;
            const endMs = Math.max(start + 40, releaseMs);
            // Same gesture as the keydown stamp: no extra undo step
            setEnds(prev => prev.map((em, i) => (i === hold.g ? endMs : em)));
            setDirty(true);
        },
        onKey: (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const tag = target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (typeof target?.closest === 'function'
                && target.closest('[role="listbox"], [role="option"], .MuiSelect-select')) return;
            if (capturing) {
                e.preventDefault();
                e.stopPropagation();
                if (e.code === 'Escape') {
                    setCapturing(null);
                    return;
                }
                if (/^(Shift|Control|Alt|Meta)/.test(e.code)) return; // wait for a real key
                setKeyBinds(prev => {
                    const other = capturing === 'play' ? 'tap' : 'play';
                    const next = { ...prev, [capturing]: e.code };
                    // Collides with the other action: swap so both stay usable
                    if (prev[other] === e.code) next[other] = prev[capturing];
                    return next;
                });
                setCapturing(null);
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();
                return;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) return; // leave shortcuts alone
            const stampNext = () => {
                const g = tapCursorRef.current;
                if (g >= timesRef.current.length) return;
                const el = mediaRef.current;
                if (!el || el.paused) return;
                stampWord(g, true);
                tapHoldRef.current = { g, startMs: Math.round(el.currentTime * 1000) };
            };
            if (e.code === keyBinds.play) {
                e.preventDefault();
                if (!e.repeat) togglePlay();
            } else if (e.code === keyBinds.tap) {
                e.preventDefault();
                if (!e.repeat) stampNext();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (!e.repeat) stampNext();
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                seekRel(-2);
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                seekRel(2);
            }
        },
    };
    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => actionsRef.current.onKey(e);
        const onKeyUp = (e: KeyboardEvent) => actionsRef.current.onKeyUp(e);
        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('keyup', onKeyUp, true);
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
            window.removeEventListener('keyup', onKeyUp, true);
        };
    }, [open]);

    // ---------- pointer interaction over the words ----------

    const wordFromEvent = (e: React.SyntheticEvent): number | null => {
        const el = (e.target as HTMLElement).closest?.('[data-w]') as HTMLElement | null;
        if (!el) return null;
        const g = Number(el.getAttribute('data-w'));
        return Number.isFinite(g) ? g : null;
    };

    const handleLyricsPointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        const g = wordFromEvent(e);
        if (g === null) return;
        const el = mediaRef.current;
        if (!el) return;
        if (!el.paused) {
            const startMs = stampWord(g, true);
            if (startMs !== null) {
                pointerHoldRef.current = { g, startMs, pointerId: e.pointerId };
                e.currentTarget.setPointerCapture(e.pointerId);
            }
        } else {
            // Paused click: seek there, arm the tap cursor and select the
            // word for fine-tuning
            const tm = timesRef.current[g];
            if (tm !== null && Number.isFinite(el.duration)) {
                el.currentTime = tm / 1000;
            }
            setCursor(g);
            setSelected(g);
            setSelectNonce(n => n + 1); // re-click recenters the zoom strip
        }
    };

    const handleLyricsPointerUp = (e: React.PointerEvent) => {
        const hold = pointerHoldRef.current;
        if (!hold || hold.pointerId !== e.pointerId) return;
        pointerHoldRef.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        const el = mediaRef.current;
        const start = timesRef.current[hold.g];
        if (!el || el.paused || start === null) return;
        const releaseMs = Math.round(el.currentTime * 1000);
        if (releaseMs - hold.startMs < 300) return;
        const endMs = Math.max(start + 40, releaseMs);
        const nextEnds = endsRef.current.map((em, i) => (i === hold.g ? endMs : em));
        endsRef.current = nextEnds;
        setEnds(nextEnds);
        setDirty(true);
    };

    const handleLyricsPointerCancel = (e: React.PointerEvent) => {
        if (pointerHoldRef.current?.pointerId === e.pointerId) {
            pointerHoldRef.current = null;
        }
    };

    const handleLyricsContextMenu = (e: React.MouseEvent) => {
        const g = wordFromEvent(e);
        if (g === null) return;
        e.preventDefault();
        clearWord(g);
    };

    const handleWaveSeek = (e: React.PointerEvent) => {
        const el = mediaRef.current;
        const box = waveBoxRef.current;
        if (!el || !box || !Number.isFinite(el.duration) || el.duration <= 0) return;
        const rect = box.getBoundingClientRect();
        const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        el.currentTime = frac * el.duration;
    };

    // ---------- media element events ----------

    const setMediaEl = (el: HTMLMediaElement | null) => { mediaRef.current = el; };

    const handleLoadedMetadata = () => {
        const el = mediaRef.current;
        if (!el) return;
        if (Number.isFinite(el.duration) && el.duration > 0) {
            setDurationMs(Math.round(el.duration * 1000));
        } else if (el.duration === Infinity) {
            // Chrome quirk: some webm files report Infinity until seeked far
            el.currentTime = 1e7;
        }
    };

    const handleDurationChange = () => {
        const el = mediaRef.current;
        if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
        setDurationMs(Math.round(el.duration * 1000));
        if (el.currentTime > 1e6) el.currentTime = 0;
    };

    // ---------- waveform rendering ----------

    useEffect(() => {
        if (!open) return;
        const canvas = canvasRef.current;
        const box = waveBoxRef.current;
        if (!canvas || !box) return;
        const draw = () => {
            const dpr = window.devicePixelRatio || 1;
            const w = box.clientWidth;
            const h = box.clientHeight;
            if (w === 0 || h === 0) return;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.scale(dpr, dpr);
            const css = getComputedStyle(document.documentElement);
            const waveColor = (css.getPropertyValue('--primary') || '#888').trim();
            const tickColor = (css.getPropertyValue('--accent') || '#fff').trim();
            ctx.clearRect(0, 0, w, h);
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = waveColor;
            const laneH = h - 12; // bottom lane reserved for word ticks
            if (peaks && peaks.length > 0) {
                for (let x = 0; x < w; x++) {
                    const p = peaks[Math.floor((x / w) * peaks.length)] || 0;
                    const barH = Math.max(2, p * (laneH - 6));
                    ctx.fillRect(x, (laneH - barH) / 2 + 2, 1, barH);
                }
            } else {
                ctx.fillRect(0, laneH / 2 - 3, w, 6);
            }
            if (durationMs > 0) {
                ctx.globalAlpha = 0.9;
                ctx.fillStyle = tickColor;
                for (const tm of timesRef.current) {
                    if (tm === null) continue;
                    const x = (tm / durationMs) * w;
                    ctx.fillRect(x - 1, h - 9, 2, 9);
                }
            }
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        };
        draw();
        const observer = new ResizeObserver(draw);
        observer.observe(box);
        return () => observer.disconnect();
    }, [open, peaks, times, durationMs]);

    // Zoomed strip: high-res waveform around the selected word (the other
    // words render as DOM blocks on top of it)
    useEffect(() => {
        if (!open || !zoomWin) return;
        const canvas = zoomCanvasRef.current;
        const box = zoomBoxRef.current;
        if (!canvas || !box) return;
        const draw = () => {
            const dpr = window.devicePixelRatio || 1;
            const w = box.clientWidth;
            const h = box.clientHeight;
            if (w === 0 || h === 0) return;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.scale(dpr, dpr);
            const css = getComputedStyle(document.documentElement);
            const waveColor = (css.getPropertyValue('--primary') || '#888').trim();
            ctx.clearRect(0, 0, w, h);
            const fine = finePeaksRef.current;
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = waveColor;
            if (fine && fine.length > 0) {
                const msPerPx = zoomWin.span / w;
                for (let x = 0; x < w; x++) {
                    const tFrom = zoomWin.t0 + x * msPerPx;
                    const b0 = Math.floor(tFrom / 10);
                    const b1 = Math.max(b0 + 1, Math.floor((tFrom + msPerPx) / 10));
                    let peak = 0;
                    for (let b = b0; b < b1 && b < fine.length; b++) {
                        if (b >= 0 && fine[b] > peak) peak = fine[b];
                    }
                    const barH = Math.max(1, peak * (h - 8));
                    ctx.fillRect(x, (h - barH) / 2, 1, barH);
                }
            } else {
                ctx.fillRect(0, h / 2 - 3, w, 6);
            }
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        };
        draw();
        const observer = new ResizeObserver(draw);
        observer.observe(box);
        return () => observer.disconnect();
    }, [open, zoomWin, peaks]);

    // ---------- derived view state ----------

    const conflicts = useMemo(() => {
        const set = new Set<number>();
        let maxT = -1;
        times.forEach((tm, g) => {
            if (tm === null) return;
            if (tm < maxT) set.add(g);
            else maxT = tm;
        });
        return set;
    }, [times]);

    const gToLine = useMemo(() => {
        const arr: number[] = [];
        doc.forEach((line, li) => {
            for (let i = 0; i < line.words.length; i++) arr[line.startIdx + i] = li;
        });
        return arr;
    }, [doc]);

    const lineMeta = useMemo(() => doc.map(line => {
        let min: number | null = null;
        let max: number | null = null;
        for (let i = 0; i < line.words.length; i++) {
            const tm = times[line.startIdx + i];
            if (tm === null) continue;
            if (min === null || tm < min) min = tm;
            if (max === null || tm > max) max = tm;
        }
        return { min, max };
    }), [doc, times]);

    const totalWords = times.length;
    const timedWords = useMemo(() => times.reduce((n: number, tm) => n + (tm !== null ? 1 : 0), 0), [times]);

    // Active word = the latest stamped word the playhead has passed
    let activeIdx = -1;
    let bestT = -1;
    for (let g = 0; g < times.length; g++) {
        const tm = times[g];
        if (tm !== null && tm <= nowMs && tm >= bestT) {
            bestT = tm;
            activeIdx = g;
        }
    }
    const activeLi = activeIdx >= 0 ? gToLine[activeIdx] : -1;
    let activeProgress = -1;
    if (activeIdx >= 0) {
        const start = times[activeIdx] as number;
        const hold = tapHoldRef.current;
        let end: number;
        if (hold && hold.g === activeIdx) {
            // The tap key is still held on this word - its real end is not
            // decided yet, so keep the fill visibly in progress (it chases
            // the playhead and only completes once the key is released)
            end = Math.max(start + 120, nowMs + 250);
        } else if (ends[activeIdx] !== null) {
            end = Math.max(start + 40, ends[activeIdx] as number);
        } else {
            let next: number | null = null;
            for (let g = activeIdx + 1; g < times.length; g++) {
                const tm = times[g];
                if (tm !== null) { next = tm; break; }
            }
            end = Math.max(start + 120, next ?? (start + 1000));
        }
        activeProgress = Math.round(Math.min(1, Math.max(0, (nowMs - start) / (end - start))) * 200) / 2;
    }

    const armedLi = tapCursor < times.length ? (gToLine[tapCursor] ?? -1) : -1;
    const followLi = armedLi;

    // Keep the word armed for the next tap in view.
    useEffect(() => {
        if (!open || followLi < 0) return;
        if (Date.now() - lastWheelRef.current < 2500) return;
        const box = lyricsBoxRef.current;
        const el = lineEls.current[followLi];
        if (!box || !el) return;
        const boxRect = box.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        if (elRect.top < boxRect.top + boxRect.height * 0.12 || elRect.bottom > boxRect.top + boxRect.height * 0.8) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }, [open, followLi]);

    const isVideo = media.startsWith('data:video');

    return (
        <Dialog
            fullScreen
            open={open}
            onClose={requestClose}
            PaperProps={{ sx: { background: 'var(--bg-darker)', backgroundImage: 'none' } }}
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 2, gap: 1.25 }}>
                {/* header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <Typography variant="h6" sx={{ flex: 1, minWidth: '12rem' }}>
                        {t('timing.title')}
                    </Typography>
                    <Chip
                        size="small"
                        label={t('timing.timedCount', { done: timedWords, total: totalWords })}
                        sx={{ background: 'var(--surface-soft)', color: 'var(--text-secondary)' }}
                    />
                    {conflicts.size > 0 && (
                        <Chip
                            size="small"
                            label={t('timing.conflicts', { count: conflicts.size })}
                            sx={{ background: 'var(--danger)', color: '#fff' }}
                        />
                    )}
                    <Button variant="contained" startIcon={<SaveIcon />} onClick={save} disabled={!dirty}>
                        {t('timing.save')}
                    </Button>
                    <IconButton onClick={requestClose} title={t('timing.close')}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* transport */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                    <IconButton
                        onClick={togglePlay}
                        disabled={!mediaSrc}
                        sx={{
                            background: 'var(--grad-primary)',
                            color: 'var(--btn-primary-text)',
                            '&:hover': { background: 'var(--grad-primary)', filter: 'brightness(1.1)' },
                        }}
                    >
                        {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                    </IconButton>
                    <IconButton onClick={() => seekRel(-5)} title={t('timing.back5')}>
                        <Replay5Icon />
                    </IconButton>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '1rem', minWidth: '8.5em' }}>
                        <span ref={clockRef}>0:00.0</span> / {formatClock(durationMs)}
                    </Typography>
                    <Select size="small" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                        {[0.5, 0.75, 1].map(v => (
                            <MenuItem key={v} value={v}>{v}×</MenuItem>
                        ))}
                    </Select>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Button
                            size="small"
                            variant="outlined"
                            title={t('timing.keyHint')}
                            onClick={() => setCapturing(prev => (prev === 'play' ? null : 'play'))}
                            sx={capturing === 'play' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
                        >
                            {t('timing.keyPlay')}: {capturing === 'play' ? t('timing.pressKey') : keyLabel(keyBinds.play)}
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            title={t('timing.keyHint')}
                            onClick={() => setCapturing(prev => (prev === 'tap' ? null : 'tap'))}
                            sx={capturing === 'tap' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
                        >
                            {t('timing.keyTap')}: {capturing === 'tap' ? t('timing.pressKey') : keyLabel(keyBinds.tap)}
                        </Button>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mr: 0.5 }}>
                            {t('timing.shiftAll')}
                        </Typography>
                        {NUDGE_STEPS.map(d => (
                            <Button
                                key={d}
                                size="small"
                                sx={{ minWidth: '46px', px: 0.5 }}
                                title={`${stepLabel(d)}ms`}
                                onClick={() => shiftAll(d)}
                            >
                                {stepLabel(d)}
                            </Button>
                        ))}
                    </Box>
                    <Box sx={{ flex: 1 }} />
                    <IconButton onClick={undo} disabled={undoCount === 0} title={t('timing.undo')}>
                        <UndoIcon />
                    </IconButton>
                    <IconButton onClick={clearAll} title={t('timing.clearAll')} sx={{ color: 'var(--danger)' }}>
                        <DeleteSweepIcon />
                    </IconButton>
                </Box>

                {/* waveform / seek bar */}
                <Box
                    ref={waveBoxRef}
                    onPointerDown={(e) => { e.preventDefault(); handleWaveSeek(e); }}
                    onPointerMove={(e) => { if (e.buttons & 1) handleWaveSeek(e); }}
                    sx={{
                        position: 'relative',
                        height: 72,
                        flexShrink: 0,
                        borderRadius: '10px',
                        overflow: 'hidden',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--glass-border)',
                        cursor: 'pointer',
                        touchAction: 'none',
                    }}
                >
                    <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
                    <Box ref={playedRef} sx={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 0, background: 'var(--primary)', opacity: 0.14, pointerEvents: 'none' }} />
                    <Box ref={playheadRef} sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '2px', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent-glow)', pointerEvents: 'none' }} />
                </Box>

                {/* fine-tune panel for the selected word */}
                {selected >= 0 && selected < times.length && times[selected] !== null && (() => {
                    const selLi = gToLine[selected];
                    const selLine = selLi !== undefined ? doc[selLi] : null;
                    const selWord = selLine ? selLine.words[selected - selLine.startIdx] : '';
                    const selStart = times[selected] as number;
                    const explicit = ends[selected];
                    const selEnd = effectiveEnd(selected, times, ends);
                    return (
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            flexWrap: 'wrap',
                            px: 1.5,
                            py: 0.75,
                            flexShrink: 0,
                            borderRadius: '10px',
                            border: '1px solid var(--glass-border)',
                            background: 'var(--surface-soft)',
                        }}>
                            <Typography sx={{ fontWeight: 700, maxWidth: '10rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                «{selWord}»
                            </Typography>

                            {/* −200 −20 Start +20 +200 (slides the whole word) */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {NEG_STEPS.map(d => (
                                    <Button key={d} size="small" sx={{ minWidth: '46px', px: 0.5 }}
                                        title={`${t('timing.selEarlier')} ${Math.abs(d)}ms`}
                                        onClick={() => nudgeStart(selected, d)}>
                                        {stepLabel(d)}
                                    </Button>
                                ))}
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1, mx: 0.25 }}>
                                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>{t('timing.selStart')}</Typography>
                                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{formatTag(selStart)}</Typography>
                                </Box>
                                {POS_STEPS.map(d => (
                                    <Button key={d} size="small" sx={{ minWidth: '46px', px: 0.5 }}
                                        title={`${t('timing.selLater')} ${Math.abs(d)}ms`}
                                        onClick={() => nudgeStart(selected, d)}>
                                        {stepLabel(d)}
                                    </Button>
                                ))}
                            </Box>

                            <Divider orientation="vertical" flexItem sx={{ borderColor: 'var(--glass-border)' }} />

                            {/* −200 −20 Length +20 +200 (changes only how long it is sung) */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {NEG_STEPS.map(d => (
                                    <Button key={d} size="small" sx={{ minWidth: '46px', px: 0.5 }}
                                        title={`${t('timing.selFaster')} ${Math.abs(d)}ms`}
                                        onClick={() => nudgeEnd(selected, d)}>
                                        {stepLabel(d)}
                                    </Button>
                                ))}
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1, mx: 0.25 }}>
                                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>{t('timing.selLength')}</Typography>
                                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }} title={formatTag(selEnd)}>
                                        {((selEnd - selStart) / 1000).toFixed(2)}s{explicit === null ? ` (${t('timing.selAuto')})` : ''}
                                    </Typography>
                                </Box>
                                {POS_STEPS.map(d => (
                                    <Button key={d} size="small" sx={{ minWidth: '46px', px: 0.5 }}
                                        title={`${t('timing.selSlower')} ${Math.abs(d)}ms`}
                                        onClick={() => nudgeEnd(selected, d)}>
                                        {stepLabel(d)}
                                    </Button>
                                ))}
                            </Box>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1, mx: 0.25 }}>
                                <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>{t('timing.selEnd')}</Typography>
                                <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                    {formatTag(selEnd)}{explicit === null ? ` (${t('timing.selAuto')})` : ''}
                                </Typography>
                            </Box>
                            {explicit !== null && (
                                <Button size="small" onClick={() => resetEnd(selected)}>{t('timing.selAuto')}</Button>
                            )}
                            <Box sx={{ flex: 1 }} />
                            <Button size="small" startIcon={<PlayArrowIcon />} onClick={() => playWord(selected)}>
                                {t('timing.selPlay')}
                            </Button>
                            <IconButton size="small" onClick={() => setSelected(-1)} title={t('timing.close')}>
                                <CloseIcon fontSize="small" />
                            </IconButton>

                            {/* zoomed strip: drag a block to move that word,
                                drag the selected block's edges to change how
                                long it is sung; click another word to select,
                                drag the background to pan along the track */}
                            {zoomWin && (() => {
                                const blockL = Math.max(0, Math.min(100, ((selStart - zoomWin.t0) / zoomWin.span) * 100));
                                const blockR = Math.max(blockL, Math.min(100, ((selEnd - zoomWin.t0) / zoomWin.span) * 100));
                                // Every other timed word inside the window, as
                                // dimmer blocks for context / coarse moves
                                const winEnd = zoomWin.t0 + zoomWin.span;
                                const others: { g: number; word: string; l: number; r: number; startMs: number; endMs: number }[] = [];
                                for (const line of doc) {
                                    if (line.passthrough !== null) continue;
                                    for (let i = 0; i < line.words.length; i++) {
                                        const g = line.startIdx + i;
                                        if (g === selected) continue;
                                        const tm = times[g];
                                        if (tm === null) continue;
                                        const en = effectiveEnd(g, times, ends);
                                        if (en < zoomWin.t0 || tm > winEnd) continue;
                                        others.push({
                                            g,
                                            word: line.words[i],
                                            l: Math.max(0, ((tm - zoomWin.t0) / zoomWin.span) * 100),
                                            r: Math.min(100, ((en - zoomWin.t0) / zoomWin.span) * 100),
                                            startMs: tm,
                                            endMs: en,
                                        });
                                    }
                                }
                                return (
                                    <Box
                                        ref={zoomBoxRef}
                                        onPointerDown={handleZoomPointerDown}
                                        onPointerMove={handleZoomPointerMove}
                                        onPointerUp={handleZoomPointerUp}
                                        onPointerCancel={handleZoomPointerUp}
                                        onWheel={handleZoomWheel}
                                        sx={{
                                            position: 'relative',
                                            flexBasis: '100%',
                                            height: 64,
                                            mt: 0.75,
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                            background: 'var(--input-bg)',
                                            border: '1px solid var(--glass-border)',
                                            cursor: 'grab',
                                            touchAction: 'none',
                                        }}
                                    >
                                        <canvas ref={zoomCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
                                        {others.map(o => (
                                            <Box
                                                key={o.g}
                                                data-g={o.g}
                                                title={`${formatTag(o.startMs)} – ${formatTag(o.endMs)}\n${t('timing.dragMoveOther')}`}
                                                sx={{
                                                    position: 'absolute',
                                                    top: '14px',
                                                    bottom: '14px',
                                                    left: `${o.l}%`,
                                                    width: `${Math.max(0.5, o.r - o.l)}%`,
                                                    background: 'var(--surface-soft)',
                                                    border: `1px solid ${conflicts.has(o.g) ? 'var(--danger)' : 'var(--glass-border)'}`,
                                                    borderRadius: '6px',
                                                    cursor: 'grab',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    userSelect: 'none',
                                                }}
                                            >
                                                <Typography variant="caption" sx={{ pointerEvents: 'none', color: 'var(--text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', px: 0.5 }}>
                                                    {o.word}
                                                </Typography>
                                            </Box>
                                        ))}
                                        <Box ref={zoomPlayheadRef} sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '2px', background: 'var(--accent)', pointerEvents: 'none', display: 'none' }} />
                                        <Box
                                            data-zone="move"
                                            title={t('timing.dragMove')}
                                            sx={{
                                                position: 'absolute',
                                                top: '6px',
                                                bottom: '6px',
                                                left: `${blockL}%`,
                                                width: `${Math.max(0.5, blockR - blockL)}%`,
                                                background: 'var(--accent-soft)',
                                                border: '1px solid var(--accent)',
                                                borderRadius: '6px',
                                                cursor: 'grab',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'visible',
                                                userSelect: 'none',
                                            }}
                                        >
                                            <Typography variant="caption" sx={{ pointerEvents: 'none', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', px: 0.5 }}>
                                                {selWord}
                                            </Typography>
                                            <Box data-zone="start" sx={{ position: 'absolute', left: '-6px', top: 0, bottom: 0, width: '12px', cursor: 'ew-resize' }} />
                                            <Box data-zone="end" sx={{ position: 'absolute', right: '-6px', top: 0, bottom: 0, width: '12px', cursor: 'ew-resize' }} />
                                        </Box>
                                        <IconButton
                                            size="small"
                                            title={t('timing.panEarlier')}
                                            disabled={zoomWin.t0 <= 0}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            onClick={() => panWindowBy(-zoomWin.span / 2)}
                                            sx={{
                                                position: 'absolute',
                                                left: 4,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'var(--surface-soft)',
                                                '&:hover': { background: 'var(--surface-soft)', filter: 'brightness(1.2)' },
                                            }}
                                        >
                                            <ChevronLeftIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            title={t('timing.panLater')}
                                            disabled={durationMs > 0 && zoomWin.t0 + zoomWin.span >= durationMs}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            onClick={() => panWindowBy(zoomWin.span / 2)}
                                            sx={{
                                                position: 'absolute',
                                                right: 4,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'var(--surface-soft)',
                                                '&:hover': { background: 'var(--surface-soft)', filter: 'brightness(1.2)' },
                                            }}
                                        >
                                            <ChevronRightIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                );
                            })()}
                        </Box>
                    );
                })()}

                {/* playback element (hidden; videos contribute audio only) */}
                {isVideo ? (
                    <video
                        ref={setMediaEl}
                        src={mediaSrc}
                        preload="auto"
                        playsInline
                        style={{ display: 'none' }}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                        onLoadedMetadata={handleLoadedMetadata}
                        onDurationChange={handleDurationChange}
                    />
                ) : (
                    <audio
                        ref={setMediaEl}
                        src={mediaSrc}
                        preload="auto"
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                        onLoadedMetadata={handleLoadedMetadata}
                        onDurationChange={handleDurationChange}
                    />
                )}

                {/* lyrics */}
                <Box
                    ref={lyricsBoxRef}
                    onPointerDown={handleLyricsPointerDown}
                    onPointerUp={handleLyricsPointerUp}
                    onPointerCancel={handleLyricsPointerCancel}
                    onContextMenu={handleLyricsContextMenu}
                    onWheel={() => { lastWheelRef.current = Date.now(); }}
                    sx={{
                        flex: 1,
                        overflowY: 'auto',
                        borderRadius: '12px',
                        border: '1px solid var(--glass-border)',
                        background: 'var(--glass-bg)',
                        p: 2.5,
                        userSelect: 'none',
                        touchAction: 'pan-y',
                    }}
                >
                    {doc.map((line, li) => {
                        const meta = lineMeta[li];
                        const lineNow = meta.min === null
                            ? -1
                            : nowMs >= (meta.max as number)
                                ? Number.MAX_SAFE_INTEGER
                                : nowMs >= meta.min ? nowMs : -1;
                        return (
                            <LineRow
                                key={li}
                                line={line}
                                li={li}
                                times={times}
                                ends={ends}
                                conflicts={conflicts}
                                lineNow={lineNow}
                                activeIdx={activeLi === li ? activeIdx : -1}
                                activeProgress={activeLi === li ? activeProgress : -1}
                                armedIdx={armedLi === li ? tapCursor : -1}
                                selectedIdx={selected >= 0 && gToLine[selected] === li ? selected : -1}
                                lineEls={lineEls}
                            />
                        );
                    })}
                </Box>

                <Typography variant="body2" sx={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    {t('timing.hint', {
                        play: keyLabel(keyBinds.play),
                        tap: keyLabel(keyBinds.tap),
                    })}
                </Typography>
            </Box>
        </Dialog>
    );
};

export default KaraokeTimingEditor;
