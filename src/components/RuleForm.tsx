import React, { useState, Component, useRef, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Popover,
  Slider,
  Snackbar,
  Alert,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Close as CloseIcon, ContentCut as ContentCutIcon } from '@mui/icons-material';
import { Rule, RuleType, RevealEffect, RevealCurve } from '../types/quiz';
import { isContentEmpty } from '../utils/contentUtils';
import { embedExternalImages } from '../utils/embedImages';
import { usePasteImageBytes } from '../hooks/usePasteImageBytes';
import { useTranslation } from '../i18n/LanguageContext';
import MediaTrimmer from './MediaTrimmer';
import AudioRecorder from './AudioRecorder';
import PaintCanvas from './PaintCanvas';
import MediaImporter from './MediaImporter';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import '../quill-theme.css';
import { EffectPreview, applyRevealCurve } from './ProgressiveRevealEditor';

// First embedded audio/video data URL in the rule's HTML, if any
const MEDIA_DATA_URL_RE = /data:(?:audio|video)\/[\w.+-]+;base64,[A-Za-z0-9+/=]+/;
const findMediaDataUrl = (html?: string): string | null => {
  const m = html?.match(MEDIA_DATA_URL_RE);
  return m ? m[0] : null;
};

// Audio/video embeds are stored as plain <audio>/<video> data-URL tags. Using
// the element itself as the blot tag (with value() reading the src back) lets
// them round-trip through Quill's HTML parser — needed so editing or trimming
// a clip doesn't lose the media.
const BlockEmbed = Quill.import('blots/block/embed') as any;

class CoustomVideo extends BlockEmbed {
  static blotName = 'video';
  static tagName = 'video';

  static create(value: string) {
    const node = super.create() as HTMLElement;
    node.setAttribute('controls', 'true');
    node.setAttribute('style', 'max-width: 100%; height: 200px;');
    node.setAttribute('src', value);
    return node;
  }

  static value(node: HTMLElement) {
    return node.getAttribute('src');
  }
}

Quill.register('formats/video', CoustomVideo, true);

class CustomAudio extends BlockEmbed {
  static blotName = 'audio';
  static tagName = 'audio';

  static create(value: string) {
    const node = super.create() as HTMLElement;
    node.setAttribute('controls', 'true');
    node.setAttribute('style', 'width: 100%');
    node.setAttribute('src', value);
    return node;
  }

  static value(node: HTMLElement) {
    return node.getAttribute('src');
  }
}

Quill.register('formats/audio', CustomAudio, true);

// Custom image blot that round-trips progressive-reveal config. A plain image
// is still stored as a bare src string (default behavior); a reveal image is
// stored as { src, reveal, effect, curve } and renders <img data-reveal
// data-effect data-curve> so the game can drive the reveal.
const ImageBlot = Quill.import('formats/image') as any;
class RevealImage extends ImageBlot {
  static blotName = 'image';
  static tagName = 'IMG';

  static create(value: any) {
    const src = typeof value === 'string' ? value : (value && value.src);
    const node = super.create(src) as HTMLElement;
    if (value && typeof value === 'object' && value.reveal) {
      node.setAttribute('data-reveal', 'true');
      node.setAttribute('data-effect', value.effect || 'blur');
      node.setAttribute('data-curve', value.curve || 'linear');
    }
    return node;
  }

  static value(node: HTMLElement) {
    const src = node.getAttribute('src');
    if (node.hasAttribute('data-reveal')) {
      return {
        src,
        reveal: true,
        effect: node.getAttribute('data-effect') || 'blur',
        curve: node.getAttribute('data-curve') || 'linear',
      };
    }
    return src;
  }
}
Quill.register('formats/image', RevealImage, true);

// Preserve the reveal data-attributes when HTML is parsed into the editor
// (loading a saved question, or pasting) — the default img matcher drops them.
const DeltaCtor = Quill.import('delta') as any;
const revealImageMatcher = (node: any, delta: any) => {
  if (node && node.getAttribute && node.getAttribute('data-reveal')) {
    return new DeltaCtor().insert({
      image: {
        src: node.getAttribute('src'),
        reveal: true,
        effect: node.getAttribute('data-effect') || 'blur',
        curve: node.getAttribute('data-curve') || 'linear',
      },
    });
  }
  return delta;
};

interface RuleFormProps {
  rules: Rule[];
  onRulesChange: (rules: Rule[]) => void;
  title: string;
  draftRule: Partial<Rule>;
  onDraftRuleChange: (rule: Partial<Rule>) => void;
  buttonLabel?: string;
}

const RuleForm: React.FC<RuleFormProps> = ({
  rules,
  onRulesChange,
  title,
  draftRule,
  onDraftRuleChange,
  buttonLabel
}) => {
  const { t } = useTranslation();
  const resolvedButtonLabel = buttonLabel ?? t('ruleForm.addRule');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  function convertMediaTags(htmlString: string): string {
    const checkLength = Math.min(200, htmlString.length);
    const prefix = htmlString.substring(0, checkLength);

    if (prefix.includes('<img src="data:video')) {
      return htmlString.replace('<img', '<video controls autoplay');
    } else if (prefix.includes('<img src="data:audio')) {
      return htmlString.replace('<img', '<audio controls autoplay');
    } else {
      return htmlString;
    }
  }

  const handleAddRule = async () => {
    if (draftRule.type && !isContentEmpty(draftRule.content)) {
      const ruleToSave = {
        ...draftRule,
        content: convertMediaTags(await embedExternalImages(draftRule.content!)),
      } as Rule;

      if (editingIndex !== null) {
        const updatedRules = [...rules];
        updatedRules[editingIndex] = ruleToSave;
        onRulesChange(updatedRules);
        setEditingIndex(null);
      } else {
        onRulesChange([...rules, ruleToSave]);
      }

      onDraftRuleChange({
        type: RuleType.Embedded,
        content: '',
        duration: 15,
      });
    }
  };

  const handleEditRule = (index: number) => {
    const ruleToEdit = rules[index];
    onDraftRuleChange({
      ...ruleToEdit,
    });
    setEditingIndex(index);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    onDraftRuleChange({
      type: RuleType.Embedded,
      content: '',
      duration: 15,
    });
  };

  const handleCancelEditOrClear = () => {
    handleCancelEdit();
  };

  const handleDeleteRule = (index: number) => {
    const updatedRules = rules.filter((_, i) => i !== index);
    onRulesChange(updatedRules);
  };

  const quillRef = useRef<ReactQuill>(null);
  // Pasting an image as bytes (vs. a remote link) is handled by a shared hook.
  const { pasteWarning, clearPasteWarning } = usePasteImageBytes(
    quillRef,
    (count) => t('ruleForm.pasteImageLinkWarning', { count }),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [trimUrl, setTrimUrl] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [paintOpen, setPaintOpen] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [paintInitial, setPaintInitial] = useState<string | null>(null);
  const paintReplaceIndexRef = useRef<number | null>(null);

  const draftMediaUrl = findMediaDataUrl(draftRule.content);

  // Swap the just-trimmed media back into the editor. We replace the embed
  // through the Quill API (delete + re-insert at the same index) rather than
  // editing the HTML string — feeding modified HTML back via the value prop
  // makes Quill re-parse, and the custom audio/video blots don't round-trip.
  const handleTrimApply = (newUrl: string) => {
    const quill = quillRef.current?.getEditor();
    if (quill && trimUrl) {
      const ops = quill.getContents().ops || [];
      let index = 0;
      let found = -1;
      let format = '';
      for (const op of ops) {
        if (typeof op.insert === 'string') {
          index += op.insert.length;
        } else if (op.insert && typeof op.insert === 'object') {
          const key = (op.insert as any).audio !== undefined ? 'audio'
            : (op.insert as any).video !== undefined ? 'video' : '';
          if (key && (op.insert as any)[key] === trimUrl) { found = index; format = key; break; }
          index += 1;
        }
      }
      if (found >= 0) {
        quill.deleteText(found, 1, 'user');
        quill.insertEmbed(found, format, newUrl, 'user');
      }
    } else if (trimUrl) {
      // Fallback: string replace (no editor handle)
      const content = draftRule.content || '';
      if (content.includes(trimUrl)) onDraftRuleChange({ ...draftRule, content: content.replace(trimUrl, newUrl) });
    }
    setTrimUrl(null);
  };

  // Embed an image/audio/video file into the editor as a base64 data URL
  const insertMediaFile = (file: File) => {
    const format = file.type.startsWith('video/') ? 'video'
      : file.type.startsWith('audio/') ? 'audio'
        : file.type.startsWith('image/') ? 'image'
          : null;
    if (!format) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const quill = quillRef.current?.getEditor();
      if (!quill) return;
      const range = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
      quill.insertEmbed(range.index, format, base64);
      quill.setSelection(range.index + 1, 0);
    };
    reader.readAsDataURL(file);
  };

  // Embed an already-encoded data URL (e.g. a recording or a drawing) at the cursor
  const insertMediaUrl = (format: 'image' | 'audio' | 'video', url: string) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const range = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
    quill.insertEmbed(range.index, format, url);
    quill.setSelection(range.index + 1, 0);
  };

  const videoHandler = () => {
    fileInputRef.current?.click();
  };

  const audioHandler = () => {
    audioInputRef.current?.click();
  };

  const recorderHandler = () => {
    setRecordOpen(true);
  };

  const youtubeHandler = () => {
    setYoutubeOpen(true);
  };

  // Open the paint tool. If the cursor sits on an embedded image, load that
  // image for editing and remember where to put the result back; otherwise
  // start a blank drawing inserted at the cursor.
  const paintHandler = () => {
    const quill = quillRef.current?.getEditor();
    let initial: string | null = null;
    let replaceIndex: number | null = null;
    if (quill) {
      const range = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
      const ops = quill.getContents().ops || [];
      let index = 0;
      for (const op of ops) {
        if (typeof op.insert === 'string') {
          index += op.insert.length;
        } else if (op.insert && typeof op.insert === 'object') {
          const src = (op.insert as any).image;
          if (src !== undefined && (index === range.index || index === range.index - 1)) {
            initial = src as string;
            replaceIndex = index;
            break;
          }
          index += 1;
        }
      }
    }
    paintReplaceIndexRef.current = replaceIndex;
    setPaintInitial(initial);
    setPaintOpen(true);
  };

  // Apply the drawing: replace the image being edited in place, or insert a new one
  const handlePaintApply = (url: string) => {
    const quill = quillRef.current?.getEditor();
    const replaceIndex = paintReplaceIndexRef.current;
    if (quill && replaceIndex !== null) {
      quill.deleteText(replaceIndex, 1, 'user');
      quill.insertEmbed(replaceIndex, 'image', url, 'user');
      quill.setSelection(replaceIndex + 1, 0);
    } else {
      insertMediaUrl('image', url);
    }
    paintReplaceIndexRef.current = null;
    setPaintInitial(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) insertMediaFile(file);
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) insertMediaFile(file);
    // Reset input so same file can be selected again
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  };

  // Drag & drop: intercept on the capture phase so Quill's own handling never
  // sees the drop (it would otherwise try to embed images its own way).
  const handleDrop = (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer?.files || [])
      .filter(f => /^(image|audio|video)\//.test(f.type));
    if (files.length === 0) { setDragOver(false); return; }
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    files.forEach(insertMediaFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer?.items || []).some(i => i.kind === 'file')) return;
    e.preventDefault();
    e.stopPropagation();
    if (!dragOver) setDragOver(true);
  };

  // Clicking an image in the editor opens a popover to toggle progressive
  // reveal and pick its effect/curve, stored on that image.
  const [revealAnchor, setRevealAnchor] = useState<
    { index: number; left: number; top: number; src: string; reveal: boolean; effect: string; curve: string } | null
  >(null);
  // Slider position (0..100) for previewing the reveal at a given progress
  const [previewProgress, setPreviewProgress] = useState(0);

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target || target.tagName !== 'IMG') return;
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    let index = -1;
    try {
      const blot = (Quill as any).find(target);
      index = quill.getIndex(blot);
    } catch { /* not a Quill-managed node */ }
    if (index < 0) return;
    const rect = target.getBoundingClientRect();
    setPreviewProgress(0); // start the preview fully hidden
    setRevealAnchor({
      index,
      left: rect.left + rect.width / 2,
      top: rect.bottom,
      src: target.getAttribute('src') || '',
      reveal: target.hasAttribute('data-reveal'),
      effect: target.getAttribute('data-effect') || 'blur',
      curve: target.getAttribute('data-curve') || 'linear',
    });
  };

  // Re-insert the clicked image with the updated reveal config (replacing the
  // embed in place so the change round-trips through Quill's model).
  const applyReveal = (patch: Partial<{ reveal: boolean; effect: string; curve: string }>) => {
    setRevealAnchor(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      const quill = quillRef.current?.getEditor();
      if (quill) {
        quill.deleteText(next.index, 1, 'user');
        const value = next.reveal
          ? { src: next.src, reveal: true, effect: next.effect, curve: next.curve }
          : next.src;
        quill.insertEmbed(next.index, 'image', value as any, 'user');
        quill.setSelection(next.index + 1, 0);
      }
      return next;
    });
  };

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, false] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
        ['link', 'image', 'video', 'audio', 'recorder', 'paint', 'youtube'],
        ['clean'],
      ],
      handlers: {
        video: videoHandler,
        audio: audioHandler,
        recorder: recorderHandler,
        paint: paintHandler,
        youtube: youtubeHandler,
      },
    },
    clipboard: {
      matchers: [['img', revealImageMatcher]],
    },
  }), []);

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image', 'video', 'audio',
  ];

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle1" gutterBottom>
        {title}
      </Typography>

      {/* Add Rule Form */}
      <Paper ref={formRef} sx={{ p: 2, mb: 2, border: editingIndex !== null ? '1px solid var(--primary)' : 'none' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" gutterBottom>
            {t('ruleForm.content')}
          </Typography>
          <Box
            onDropCapture={handleDrop}
            onDragOverCapture={handleDragOver}
            onDragLeave={() => setDragOver(false)}
            onClick={handleEditorClick}
            sx={{
              position: 'relative',
              maxHeight: '400px',
              width: '100%',
              overflow: 'auto',
              borderRadius: '6px',
              outline: dragOver ? '2px dashed var(--primary)' : 'none',
              outlineOffset: '-2px',
              '& .ql-container': {
                maxHeight: '400px',
                width: '100%',
              },
              '& .ql-editor': {
                maxHeight: '400px',
                width: '100%',
              },
              // Click any image to configure reveal; reveal images are outlined
              '& .ql-editor img': { cursor: 'pointer' },
              '& .ql-editor img[data-reveal]': {
                outline: '3px solid var(--primary)',
                outlineOffset: '2px',
              },
            }}>
            {dragOver && (
              <Box sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--input-bg)',
                opacity: 0.92,
                pointerEvents: 'none',
                borderRadius: '6px',
                color: 'var(--primary)',
                fontWeight: 600,
              }}>
                {t('ruleForm.dropMedia')}
              </Box>
            )}
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={draftRule.content || ''}
              onChange={(html) => onDraftRuleChange({ ...draftRule, content: html })}
              modules={modules}
              formats={formats}
            />
            <input
              type="file"
              accept="video/*"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <input
              type="file"
              accept="audio/*"
              ref={audioInputRef}
              style={{ display: 'none' }}
              onChange={handleAudioChange}
            />
          </Box>

          {draftMediaUrl && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCutIcon />}
              onClick={() => setTrimUrl(draftMediaUrl)}
              sx={{ alignSelf: 'flex-start' }}
            >
              {t('ruleForm.trimMedia')}
            </Button>
          )}

          <TextField
            fullWidth
            type="number"
            label={t('ruleForm.durationSeconds')}
            value={draftRule.duration || 15}
            onChange={(e) => onDraftRuleChange({ ...draftRule, duration: parseInt(e.target.value) })}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={editingIndex !== null ? <EditIcon /> : <AddIcon />}
              onClick={handleAddRule}
              fullWidth
            >
              {editingIndex !== null ? t('ruleForm.updateRule') : resolvedButtonLabel}
            </Button>
            {editingIndex !== null && (
              <Button
                variant="outlined"
                startIcon={<CloseIcon />}
                onClick={handleCancelEdit}
                color="secondary"
              >
                {t('common.cancel')}
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Rules List */}
      <List>
        {rules.map((rule, index) => (
          <React.Fragment key={index}>
            <ListItem>
              <ListItemText
                primary={t('ruleForm.ruleItem', { type: rule.type })}
                secondary={
                  <Box sx={{
                    maxHeight: '400px',
                    width: '100%',
                    overflow: 'auto',
                    '& img, & video': {
                      maxWidth: '100%',
                      height: 'auto'
                    }
                  }}>
                    {t('ruleForm.contentLabel')} <div dangerouslySetInnerHTML={{ __html: rule.content || '' }} /><br />
                    {t('ruleForm.durationLabel')} {rule.duration}s
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={() => handleEditRule(index)}
                  sx={{ mr: 1, color: 'var(--primary)' }}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  onClick={() => handleDeleteRule(index)}
                  sx={{ color: 'var(--danger)', '&:hover': { color: 'var(--danger)' } }}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
            {index < rules.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>

      <MediaTrimmer
        open={trimUrl !== null}
        media={trimUrl || ''}
        onClose={() => setTrimUrl(null)}
        onApply={handleTrimApply}
      />

      <AudioRecorder
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        onApply={(url) => insertMediaUrl('audio', url)}
      />

      <PaintCanvas
        open={paintOpen}
        initialImage={paintInitial}
        onClose={() => { setPaintOpen(false); setPaintInitial(null); paintReplaceIndexRef.current = null; }}
        onApply={handlePaintApply}
      />

      <MediaImporter
        open={youtubeOpen}
        onClose={() => setYoutubeOpen(false)}
        onApply={(url, kind) => insertMediaUrl(kind, url)}
      />

      {/* Per-image progressive-reveal config (opened by clicking an image) */}
      <Popover
        open={!!revealAnchor}
        onClose={() => setRevealAnchor(null)}
        anchorReference="anchorPosition"
        anchorPosition={revealAnchor ? { top: revealAnchor.top, left: revealAnchor.left } : undefined}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        PaperProps={{ sx: { maxHeight: '80vh', overflowY: 'auto' } }}
      >
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, width: 300, maxWidth: '90vw' }}>
          <FormControlLabel
            control={
              <Switch
                checked={!!revealAnchor?.reveal}
                onChange={(e) => applyReveal({ reveal: e.target.checked })}
              />
            }
            label={t('reveal.progressiveReveal')}
          />
          {revealAnchor?.reveal && (
            <>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('reveal.hidingEffect')}</InputLabel>
                <Select
                  label={t('reveal.hidingEffect')}
                  value={revealAnchor.effect}
                  onChange={(e) => applyReveal({ effect: e.target.value })}
                >
                  <MenuItem value="blur">{t('reveal.blur')}</MenuItem>
                  <MenuItem value="pixelate">{t('reveal.pixelate')}</MenuItem>
                  <MenuItem value="zoom">{t('reveal.zoomOut')}</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('reveal.speed')}</InputLabel>
                <Select
                  label={t('reveal.speed')}
                  value={revealAnchor.curve}
                  onChange={(e) => applyReveal({ curve: e.target.value })}
                >
                  <MenuItem value="linear">{t('reveal.linear')}</MenuItem>
                  <MenuItem value="slow-start">{t('reveal.slowStart')}</MenuItem>
                  <MenuItem value="fast-start">{t('reveal.fastStart')}</MenuItem>
                </Select>
              </FormControl>

              {/* Preview the reveal at a draggable progress (as it was previously) */}
              <Box sx={{
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid var(--glass-border)',
                backgroundColor: 'var(--bg-darker)',
                maxHeight: 200,
              }}>
                <EffectPreview
                  src={revealAnchor.src}
                  effect={revealAnchor.effect as RevealEffect}
                  progress={applyRevealCurve(previewProgress / 100, revealAnchor.curve as RevealCurve)}
                />
              </Box>
              <Box sx={{ px: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('reveal.simulateProgress', { percent: previewProgress })}
                </Typography>
                <Slider
                  size="small"
                  value={previewProgress}
                  onChange={(_, v) => setPreviewProgress(v as number)}
                  min={0}
                  max={100}
                />
              </Box>
            </>
          )}
        </Box>
      </Popover>

      <Snackbar
        open={!!pasteWarning}
        autoHideDuration={9000}
        onClose={clearPasteWarning}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="info" variant="filled" onClose={clearPasteWarning}>
          {pasteWarning}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RuleForm;