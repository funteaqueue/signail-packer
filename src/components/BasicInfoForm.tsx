import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';
import { Quiz } from '../types/quiz';
import { useTranslation } from '../i18n/LanguageContext';

interface BasicInfoFormProps {
  onSubmit: (data: { author: string; name: string }) => void;
  initialData: Pick<Quiz, 'author' | 'name'>;
}

const BasicInfoForm: React.FC<BasicInfoFormProps> = ({ onSubmit, initialData }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    author: initialData.author,
    name: initialData.name,
  });

  // Update form data when initialData prop changes
  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t('basicInfo.title')}
      </Typography>
      <TextField
        required
        fullWidth
        label={t('header.quizName')}
        name="name"
        value={formData.name}
        onChange={handleChange}
        margin="normal"
      />
      <TextField
        required
        fullWidth
        label={t('header.author')}
        name="author"
        value={formData.author}
        onChange={handleChange}
        margin="normal"
      />
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="submit" variant="contained">
          {t('common.next')}
        </Button>
      </Box>
    </Box>
  );
};

export default BasicInfoForm; 