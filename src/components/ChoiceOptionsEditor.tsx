import React, { useState, useRef, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  IconButton,
  Paper,
  Switch,
  FormControlLabel,
  Checkbox,
  Radio,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { ChoiceOption } from '../types/quiz';
import { isContentEmpty } from '../utils/contentUtils';
import { useTranslation } from '../i18n/LanguageContext';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import '../quill-theme.css';
// RuleForm registers the custom video/audio Quill blots on import; QuestionModal
// always imports RuleForm, so the formats are available here as well.

interface ChoiceOptionsEditorProps {
  options: ChoiceOption[];
  multiple: boolean;
  onOptionsChange: (options: ChoiceOption[]) => void;
  onMultipleChange: (multiple: boolean) => void;
}

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

const ChoiceOptionsEditor: React.FC<ChoiceOptionsEditorProps> = ({
  options,
  multiple,
  onOptionsChange,
  onMultipleChange,
}) => {
  const { t } = useTranslation();
  const [draftContent, setDraftContent] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const quillRef = useRef<ReactQuill>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const handleMediaFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    format: 'video' | 'audio',
    inputRef: React.RefObject<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, format, base64);
        }
      };
      reader.readAsDataURL(file);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike'],
        ['link', 'image', 'video', 'audio'],
        ['clean'],
      ],
      handlers: {
        video: () => fileInputRef.current?.click(),
        audio: () => audioInputRef.current?.click(),
      },
    },
  }), []);

  const formats = [
    'bold', 'italic', 'underline', 'strike',
    'link', 'image', 'video', 'audio',
  ];

  const handleAddOption = () => {
    if (isContentEmpty(draftContent)) return;
    const content = convertMediaTags(draftContent);

    if (editingIndex !== null) {
      const updated = [...options];
      updated[editingIndex] = { ...updated[editingIndex], content };
      onOptionsChange(updated);
      setEditingIndex(null);
    } else {
      onOptionsChange([...options, { content, correct: false }]);
    }
    setDraftContent('');
  };

  const handleEditOption = (index: number) => {
    setDraftContent(options[index].content);
    setEditingIndex(index);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setDraftContent('');
  };

  const handleDeleteOption = (index: number) => {
    onOptionsChange(options.filter((_, i) => i !== index));
    if (editingIndex === index) handleCancelEdit();
  };

  const handleCorrectToggle = (index: number) => {
    if (multiple) {
      const updated = options.map((opt, i) =>
        i === index ? { ...opt, correct: !opt.correct } : opt
      );
      onOptionsChange(updated);
    } else {
      // Single mode: exactly one correct option
      const updated = options.map((opt, i) => ({ ...opt, correct: i === index }));
      onOptionsChange(updated);
    }
  };

  const handleMultipleToggle = (checked: boolean) => {
    onMultipleChange(checked);
    if (!checked) {
      // Back to single mode: keep only the first correct option
      const firstCorrect = options.findIndex(o => o.correct);
      onOptionsChange(options.map((opt, i) => ({ ...opt, correct: i === firstCorrect })));
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <FormControlLabel
        control={
          <Switch
            checked={multiple}
            onChange={(e) => handleMultipleToggle(e.target.checked)}
          />
        }
        label={t('choice.multipleCorrect')}
      />

      {/* Draft option editor */}
      <Paper ref={formRef} sx={{ p: 2, border: editingIndex !== null ? '1px solid var(--primary)' : 'none' }}>
        <Typography variant="body2" gutterBottom>
          {editingIndex !== null ? t('choice.editOption', { number: editingIndex + 1 }) : t('choice.newOption')}
        </Typography>
        <Box sx={{
          maxHeight: '300px',
          overflow: 'auto',
          '& .ql-container': { maxHeight: '300px' },
          '& .ql-editor': { maxHeight: '300px' },
        }}>
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={draftContent}
            onChange={setDraftContent}
            modules={modules}
            formats={formats}
          />
          <input
            type="file"
            accept="video/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e) => handleMediaFile(e, 'video', fileInputRef)}
          />
          <input
            type="file"
            accept="audio/*"
            ref={audioInputRef}
            style={{ display: 'none' }}
            onChange={(e) => handleMediaFile(e, 'audio', audioInputRef)}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Button
            variant="contained"
            startIcon={editingIndex !== null ? <EditIcon /> : <AddIcon />}
            onClick={handleAddOption}
            fullWidth
          >
            {editingIndex !== null ? t('choice.updateOption') : t('choice.addOption')}
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
      </Paper>

      {/* Options list */}
      <Typography variant="subtitle1">
        {t(multiple ? 'choice.optionsHeadingMultiple' : 'choice.optionsHeadingSingle', { count: options.length })}
      </Typography>
      {options.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {t('choice.noOptions')}
        </Typography>
      )}
      {options.map((option, index) => (
        <Paper
          key={index}
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            border: option.correct ? '1px solid #10b981' : '1px solid var(--glass-border)',
            background: option.correct ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-soft)',
          }}
        >
          <Tooltip title={option.correct ? t('choice.correctAnswer') : t('choice.markCorrect')}>
            {multiple ? (
              <Checkbox
                checked={option.correct}
                onChange={() => handleCorrectToggle(index)}
                sx={{ '&.Mui-checked': { color: '#10b981' } }}
              />
            ) : (
              <Radio
                checked={option.correct}
                onChange={() => handleCorrectToggle(index)}
                sx={{ '&.Mui-checked': { color: '#10b981' } }}
              />
            )}
          </Tooltip>
          <Box
            sx={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--primary)',
              color: 'var(--on-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              flexShrink: 0,
              mt: 0.5,
            }}
          >
            {index + 1}
          </Box>
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              maxHeight: '200px',
              '& img, & video': { maxWidth: '100%', height: 'auto' },
            }}
            dangerouslySetInnerHTML={{ __html: option.content }}
          />
          <IconButton size="small" onClick={() => handleEditOption(index)} sx={{ color: 'var(--primary)' }}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" onClick={() => handleDeleteOption(index)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Paper>
      ))}
    </Box>
  );
};

export default ChoiceOptionsEditor;
