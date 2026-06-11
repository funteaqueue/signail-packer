import React from 'react';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { Language } from './translations';
import { useTranslation } from './LanguageContext';

const LanguageSwitcher: React.FC = () => {
    const { language, setLanguage } = useTranslation();

    return (
        <ToggleButtonGroup
            value={language}
            exclusive
            size="small"
            onChange={(_, value: Language | null) => {
                if (value) {
                    setLanguage(value);
                }
            }}
            sx={{
                '& .MuiToggleButton-root': {
                    padding: '4px 10px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    borderColor: 'var(--glass-border)',
                    '&.Mui-selected': {
                        color: 'var(--on-primary)',
                        backgroundColor: 'var(--primary)',
                    },
                    '&.Mui-selected:hover': {
                        backgroundColor: 'var(--primary-hover)',
                    },
                },
            }}
        >
            <ToggleButton value="en">EN</ToggleButton>
            <ToggleButton value="uk">УКР</ToggleButton>
        </ToggleButtonGroup>
    );
};

export default LanguageSwitcher;
