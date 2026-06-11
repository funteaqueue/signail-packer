import React from 'react';
import { IconButton } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useTranslation } from '../i18n/LanguageContext';

interface AddButtonProps {
    onClick: () => void;
    size?: 'small' | 'medium' | 'large';
    label?: string;
}

const AddButton: React.FC<AddButtonProps> = ({ onClick, size = 'medium', label }) => {
    const { t } = useTranslation();
    const sizeMap = {
        small: 40,
        medium: 56,
        large: 72,
    };

    const iconSizeMap = {
        small: 24,
        medium: 32,
        large: 40,
    };

    return (
        <IconButton
            onClick={onClick}
            sx={{
                width: sizeMap[size],
                height: sizeMap[size],
                border: '3px solid #ef4444',
                borderRadius: '50%',
                backgroundColor: 'transparent',
                color: '#ef4444',
                transition: 'all 0.3s ease',
                '&:hover': {
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    transform: 'scale(1.1) rotate(90deg)',
                    boxShadow: '0 0 20px rgba(239, 68, 68, 0.5)',
                },
                '&:active': {
                    transform: 'scale(1.05) rotate(90deg)',
                },
            }}
            aria-label={label || t('common.add')}
        >
            <AddIcon sx={{ fontSize: iconSizeMap[size] }} />
        </IconButton>
    );
};

export default AddButton;
