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
                    color: '#a8b2d1',
                    borderColor: 'rgba(139, 92, 246, 0.3)',
                    '&.Mui-selected': {
                        color: '#ffffff',
                        backgroundColor: 'rgba(139, 92, 246, 0.3)',
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
