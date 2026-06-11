import React, { useState } from 'react';
import { Box, TextField, IconButton, Typography } from '@mui/material';
import { Delete as DeleteIcon, DragIndicator as DragIndicatorIcon } from '@mui/icons-material';
import { useSortable, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Theme, QuestionType } from '../types/pack';
import { useTranslation } from '../i18n/LanguageContext';
import QuestionButton from './QuestionButton';
import AddButton from './AddButton';

interface ThemeRowProps {
    theme: Theme;
    themeIndex: number;
    onThemeNameChange: (name: string) => void;
    onQuestionClick: (questionIndex: number) => void;
    onAddQuestion: () => void;
    onDeleteTheme: () => void;
}

const ThemeRow: React.FC<ThemeRowProps> = ({
    theme,
    themeIndex,
    onThemeNameChange,
    onQuestionClick,
    onAddQuestion,
    onDeleteTheme,
}: ThemeRowProps) => {
    const { t } = useTranslation();
    const [isEditingName, setIsEditingName] = useState(false);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: `t-${theme.id}` });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    // Standard prices for questions
    const standardPrices = [100, 200, 300, 400, 500];

    // Generate stable IDs for all slots (some might be empty)
    const questionIds = standardPrices.map((_, index) => {
        const question = theme.questions[index];
        return question?.id ? `q-${question.id}` : `empty-${themeIndex}-${index}`;
    });

    return (
        <Box
            ref={setNodeRef}
            style={style}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                padding: '16px',
                background: 'var(--surface-soft)',
                borderRadius: '12px',
                marginBottom: '12px',
                border: '1px solid var(--glass-border)',
                touchAction: 'none',
                '&:hover': {
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--hover-border)',
                },
                zIndex: isDragging ? 10 : 1,
                position: 'relative',
            }}
        >
            {/* Drag Handle */}
            <Box
                {...attributes}
                {...listeners}
                sx={{
                    cursor: 'grab',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    '&:hover': {
                        color: 'var(--primary)',
                    },
                }}
            >
                <DragIndicatorIcon />
            </Box>
            {/* Theme Name */}
            <Box
                sx={{
                    minWidth: '200px',
                    maxWidth: '200px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                }}
            >
                {isEditingName ? (
                    <TextField
                        value={theme.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onThemeNameChange(e.target.value)}
                        onBlur={() => setIsEditingName(false)}
                        onKeyPress={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter') {
                                setIsEditingName(false);
                            }
                        }}
                        autoFocus
                        size="small"
                        fullWidth
                        sx={{
                            '& .MuiInputBase-input': {
                                color: 'var(--text-primary)',
                                fontWeight: 500,
                            },
                        }}
                    />
                ) : (
                    <Box
                        onClick={() => setIsEditingName(true)}
                        sx={{
                            cursor: 'pointer',
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                            fontSize: '16px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            flex: 1,
                            '&:hover': {
                                background: 'var(--ring)',
                            },
                        }}
                    >
                        {theme.name || t('theme.unnamed')}
                    </Box>
                )}
                <IconButton
                    onClick={onDeleteTheme}
                    size="small"
                    sx={{
                        color: 'var(--danger)',
                        '&:hover': {
                            color: 'var(--danger)',
                            background: 'var(--surface-soft)',
                        },
                    }}
                >
                    <DeleteIcon fontSize="small" />
                </IconButton>
            </Box>

            {/* Questions Grid */}
            <Box
                sx={{
                    display: 'flex',
                    gap: 2,
                    flex: 1,
                    flexWrap: 'wrap',
                }}
            >
                <SortableContext items={questionIds} strategy={horizontalListSortingStrategy}>
                    {standardPrices.map((price, index) => {
                        const question = theme.questions[index];
                        const hasContent = !!(
                            question && (
                                question.type === QuestionType.FindACat
                                    ? !!question.image
                                    : ((question.rules && question.rules.length > 0) || (question.after_round && question.after_round.length > 0))
                            )
                        );
                        const id = questionIds[index];

                        return (
                            <QuestionButton
                                key={id}
                                id={id}
                                question={question}
                                price={price}
                                rowIndex={themeIndex}
                                onClick={() => onQuestionClick(index)}
                                hasContent={hasContent}
                            />
                        );
                    })}
                </SortableContext>

                {/* Add Question Button */}
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <AddButton onClick={onAddQuestion} size="medium" label={t('theme.addQuestion')} />
                </Box>
            </Box>
        </Box>
    );
};

export default ThemeRow;
