import React, { useRef } from 'react';
import { Box, TextField, Button, Typography, Select, MenuItem } from '@mui/material';
import { Upload, Download, DeleteForever } from '@mui/icons-material';
import { useTranslation } from '../i18n/LanguageContext';
import LanguageSwitcher from '../i18n/LanguageSwitcher';
import { THEMES } from '../theme/themes';
import { useAppTheme } from '../theme/ThemeContext';

interface QuizHeaderProps {
    quizName: string;
    author: string;
    onQuizNameChange: (name: string) => void;
    onAuthorChange: (author: string) => void;
    onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onDownload: () => void;
    onClear: () => void;
    downloading: boolean;
}

const QuizHeader: React.FC<QuizHeaderProps> = ({
    quizName,
    author,
    onQuizNameChange,
    onAuthorChange,
    onUpload,
    onDownload,
    onClear,
    downloading,
}) => {
    const { t } = useTranslation();
    const { themeId, setThemeId } = useAppTheme();
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <Box
            sx={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 2,
                padding: { xs: '16px 20px', md: '20px 32px' },
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(10px)',
                border: '1px solid var(--glass-border)',
                borderRadius: '16px',
                marginBottom: '24px',
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: { xs: 1.5, md: 3 },
                    alignItems: 'center',
                    flex: '1 1 320px',
                    minWidth: 0,
                }}
            >
                <Typography variant="h5" className="gradient-text" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {t('header.title')}
                </Typography>
                <TextField
                    label={t('header.quizName')}
                    value={quizName}
                    onChange={(e) => onQuizNameChange(e.target.value)}
                    size="small"
                    sx={{ flex: '1 1 200px', minWidth: 140, maxWidth: 250 }}
                />
                <TextField
                    label={t('header.author')}
                    value={author}
                    onChange={(e) => onAuthorChange(e.target.value)}
                    size="small"
                    sx={{ flex: '1 1 160px', minWidth: 120, maxWidth: 200 }}
                />
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                <Select
                    value={themeId}
                    onChange={(e) => setThemeId(e.target.value)}
                    size="small"
                    aria-label={t('header.design')}
                    title={t('header.design')}
                    sx={{
                        height: '36px',
                        minWidth: '140px',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--glass-border)',
                        '& .MuiOutlinedInput-notchedOutline': {
                            border: 'none',
                        },
                    }}
                >
                    {THEMES.map((option) => (
                        <MenuItem key={option.id} value={option.id}>{option.name}</MenuItem>
                    ))}
                </Select>
                <LanguageSwitcher />
                <input
                    type="file"
                    accept=".json"
                    onChange={onUpload}
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                />
                <Button
                    variant="outlined"
                    startIcon={<Upload />}
                    onClick={() => fileInputRef.current?.click()}
                    size="small"
                >
                    {t('header.upload')}
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<Download />}
                    onClick={onDownload}
                    size="small"
                    disabled={downloading}
                >
                    {downloading ? t('header.downloading') : t('header.download')}
                </Button>
                <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteForever />}
                    onClick={onClear}
                    size="small"
                >
                    {t('header.clear')}
                </Button>
            </Box>
        </Box>
    );
};

export default QuizHeader;
