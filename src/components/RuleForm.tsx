import React, { useState, Component, useEffect, useRef, useMemo } from 'react';
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
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Close as CloseIcon } from '@mui/icons-material';
import { Rule, RuleType } from '../types/pack';
import { isContentEmpty } from '../utils/contentUtils';
import { useTranslation } from '../i18n/LanguageContext';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import '../quill-theme.css';

const Video = Quill.import('formats/video');
const Link = Quill.import('formats/link');

class CoustomVideo extends Video {


  static blotName = 'video';
  static className = 'ql-video';
  static tagName = 'DIV';

  static create(value: string) {
    const node = super.create(value) as HTMLElement;

    // Clear any existing content (like iframe from parent)
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }

    const video = document.createElement('video');
    video.setAttribute('controls', 'true');
    video.setAttribute('autoplay', 'true');
    video.setAttribute('type', "video/mp4");
    video.setAttribute('style', "height: 200px; width: 100%");
    video.setAttribute('src', value); // Use value directly, Link.sanitize might break data URIs
    node.appendChild(video);

    return node;
  }

}



Quill.register('formats/video', CoustomVideo);

class CustomAudio extends Video {
  static blotName = 'audio';
  static className = 'ql-audio';
  static tagName = 'DIV';

  static create(value: string) {
    const node = super.create(value) as HTMLElement;

    // Clear any existing content
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }

    const audio = document.createElement('audio');
    audio.setAttribute('controls', 'true');
    audio.setAttribute('autoplay', 'true');
    audio.setAttribute('style', "width: 100%");
    audio.setAttribute('src', value);
    node.appendChild(audio);

    return node;
  }
}

Quill.register('formats/audio', CustomAudio);

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

  const handleAddRule = () => {
    if (draftRule.type && !isContentEmpty(draftRule.content)) {
      const ruleToSave = {
        ...draftRule,
        content: convertMediaTags(draftRule.content!),
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const videoHandler = () => {
    fileInputRef.current?.click();
  };

  const audioHandler = () => {
    audioInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, 'video', base64);
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, 'audio', base64);
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  };

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, false] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
        ['link', 'image', 'video', 'audio'],
        ['clean'],
      ],
      handlers: {
        video: videoHandler,
        audio: audioHandler,
      },
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
      <Paper ref={formRef} sx={{ p: 2, mb: 2, border: editingIndex !== null ? '1px solid #8b5cf6' : 'none' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" gutterBottom>
            {t('ruleForm.content')}
          </Typography>
          <Box sx={{
            maxHeight: '400px',
            width: '100%',
            overflow: 'auto',
            '& .ql-container': {
              maxHeight: '400px',
              width: '100%',
            },
            '& .ql-editor': {
              maxHeight: '400px',
              width: '100%',
            }
          }}>
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
                  sx={{ mr: 1, color: '#8b5cf6' }}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  onClick={() => handleDeleteRule(index)}
                  sx={{ color: '#ef4444' }}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
            {index < rules.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>
    </Box>
  );
};

export default RuleForm;