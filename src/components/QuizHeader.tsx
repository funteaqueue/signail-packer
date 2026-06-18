import React, { useRef } from 'react';
import { Box, TextField, Button, Typography, Select, MenuItem } from '@mui/material';
import { Upload, Download, DeleteForever, Autorenew } from '@mui/icons-material';
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
    onRepackFile: (file: File) => void;
    repacking: boolean;
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
    onRepackFile,
    repacking,
    downloading,
}) => {
    const { t } = useTranslation();
    const { themeId, setThemeId } = useAppTheme();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const repackInputRef = useRef<HTMLInputElement>(null);

    const handleRepackChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onRepackFile(file);
        }
        if (repackInputRef.current) {
            repackInputRef.current.value = '';
        }
    };

    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 32px',
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(10px)',
                border: '1px solid var(--glass-border)',
                borderRadius: '16px',
                marginBottom: '24px',
            }}
        >
            <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flex: 1 }}>
                <Typography variant="h5" className="gradient-text" sx={{ fontWeight: 700 }}>
                    {t('header.title')}
                </Typography>
                <TextField
                    label={t('header.quizName')}
                    value={quizName}
                    onChange={(e) => onQuizNameChange(e.target.value)}
                    size="small"
                    sx={{ width: '250px' }}
                />
                <TextField
                    label={t('header.author')}
                    value={author}
                    onChange={(e) => onAuthorChange(e.target.value)}
                    size="small"
                    sx={{ width: '200px' }}
                />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
                <input
                    type="file"
                    accept=".siq"
                    onChange={handleRepackChange}
                    style={{ display: 'none' }}
                    ref={repackInputRef}
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
                    startIcon={<Autorenew />}
                    onClick={() => repackInputRef.current?.click()}
                    size="small"
                    disabled={repacking}
                >
                    {repacking ? t('header.repacking') : t('header.repack')}
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
