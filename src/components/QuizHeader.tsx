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
                alignItems: { xs: 'stretch', md: 'center' },
                gap: 2,
                padding: { xs: '16px', md: '20px 32px' },
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
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 1.5, md: 3 },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    flex: '1 1 320px',
                    minWidth: 0,
                    width: '100%',
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
                    sx={{
                        flex: { xs: '0 0 auto', sm: '1 1 200px' },
                        minWidth: 0,
                        maxWidth: { xs: 'none', sm: 250 },
                        '& .MuiInputBase-root': { minHeight: 44 },
                    }}
                />
                <TextField
                    label={t('header.author')}
                    value={author}
                    onChange={(e) => onAuthorChange(e.target.value)}
                    size="small"
                    sx={{
                        flex: { xs: '0 0 auto', sm: '1 1 160px' },
                        minWidth: 0,
                        maxWidth: { xs: 'none', sm: 200 },
                        '& .MuiInputBase-root': { minHeight: 44 },
                    }}
                />
            </Box>

            <Box sx={{
                display: { xs: 'grid', sm: 'flex' },
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))' },
                flexWrap: 'wrap',
                gap: { xs: 1.25, sm: 2 },
                alignItems: 'center',
                width: { xs: '100%', md: 'auto' },
                '& > .MuiButton-root': {
                    minHeight: 44,
                },
            }}>
                <Select
                    value={themeId}
                    onChange={(e) => setThemeId(e.target.value)}
                    size="small"
                    aria-label={t('header.design')}
                    title={t('header.design')}
                    sx={{
                        minHeight: '44px',
                        minWidth: 0,
                        width: { xs: '100%', sm: 'auto' },
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
                <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-start' }, '& > div': { width: { xs: '100%', sm: 'auto' } }, '& button': { flex: 1, minHeight: 44 } }}>
                    <LanguageSwitcher />
                </Box>
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
                    sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
                >
                    {t('header.clear')}
                </Button>
            </Box>
        </Box>
    );
};

export default QuizHeader;
