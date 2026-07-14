import React, { useState } from 'react';
import { Box, TextField, IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import { Delete as DeleteIcon, DragIndicator as DragIndicatorIcon, ArrowRightAlt as ArrowRightAltIcon } from '@mui/icons-material';
import { useSortable, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Round, Theme } from '../types/quiz';
import { useTranslation } from '../i18n/LanguageContext';
import QuestionButton from './QuestionButton';
import AddButton from './AddButton';
import { getQuestionSlotPrices, questionHasContent } from '../utils/questionContent';

interface ThemeRowProps {
    theme: Theme;
    themeIndex: number;
    onThemeNameChange: (name: string) => void;
    onThemeOrderedToggle: () => void;
    onQuestionClick: (questionIndex: number) => void;
    onAddQuestion: () => void;
    onDeleteTheme: () => void;
    rounds: Round[];
    currentRoundIndex: number;
    onMoveToRound: (targetRoundIndex: number) => void;
}

const ThemeRow: React.FC<ThemeRowProps> = ({
    theme,
    themeIndex,
    onThemeNameChange,
    onThemeOrderedToggle,
    onQuestionClick,
    onAddQuestion,
    onDeleteTheme,
    rounds,
    currentRoundIndex,
    onMoveToRound,
}: ThemeRowProps) => {
    const { t } = useTranslation();
    const [isEditingName, setIsEditingName] = useState(false);
    const [moveMenuAnchor, setMoveMenuAnchor] = useState<null | HTMLElement>(null);

    const handleOpenMoveMenu = (event: React.MouseEvent<HTMLElement>) => {
        setMoveMenuAnchor(event.currentTarget);
    };

    const handleCloseMoveMenu = () => {
        setMoveMenuAnchor(null);
    };

    const handleSelectRound = (targetRoundIndex: number) => {
        onMoveToRound(targetRoundIndex);
        handleCloseMoveMenu();
    };

    const handleDeleteTheme = () => {
        if (window.confirm(t('theme.confirmDelete'))) {
            onDeleteTheme();
        }
    };

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

    // Keep the five classic slots, then grow with every authored question.
    const slotPrices = getQuestionSlotPrices(theme.questions.length);

    // Generate stable IDs for all slots (some might be empty)
    const questionIds = slotPrices.map((_, index) => {
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
            {/* Drag Handle — tap to move to another round, hold to drag/reorder */}
            <Box
                {...attributes}
                {...listeners}
                onClick={rounds.length > 1 ? handleOpenMoveMenu : undefined}
                title={rounds.length > 1 ? t('theme.moveToRound') : undefined}
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
            {rounds.length > 1 && (
                <Menu
                    anchorEl={moveMenuAnchor}
                    open={Boolean(moveMenuAnchor)}
                    onClose={handleCloseMoveMenu}
                >
                    {rounds
                        .map((round, index) => ({ round, index }))
                        .filter(({ index }) => index !== currentRoundIndex)
                        .map(({ round, index }) => (
                            <MenuItem key={index} onClick={() => handleSelectRound(index)}>
                                {round.name || `${t('rounds.roundName')} ${index + 1}`}
                            </MenuItem>
                        ))}
                </Menu>
            )}
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
                {/* Compact icon column so the fixed-width name box keeps its
                    room for text: ordered toggle on top, delete below */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Tooltip title={t(theme.ordered ? 'theme.orderedOn' : 'theme.orderedOff')} arrow>
                        <IconButton
                            onClick={onThemeOrderedToggle}
                            size="small"
                            sx={{
                                padding: '2px',
                                color: theme.ordered ? 'var(--primary)' : 'var(--text-muted)',
                                background: theme.ordered ? 'var(--surface-soft)' : 'transparent',
                                '&:hover': {
                                    color: 'var(--primary)',
                                    background: 'var(--surface-soft)',
                                },
                            }}
                        >
                            <ArrowRightAltIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                    <IconButton
                        onClick={handleDeleteTheme}
                        size="small"
                        sx={{
                            padding: '2px',
                            color: 'var(--danger)',
                            '&:hover': {
                                color: 'var(--danger)',
                                background: 'var(--surface-soft)',
                            },
                        }}
                    >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </Box>
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
                    {slotPrices.map((price, index) => {
                        const question = theme.questions[index];
                        const hasContent = questionHasContent(question);
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
