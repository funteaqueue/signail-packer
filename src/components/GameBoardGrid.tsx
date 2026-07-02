import React, { useState } from 'react';
import { Box, Typography, IconButton, TextField } from '@mui/material';
import { ChevronLeft, ChevronRight, Edit as EditIcon } from '@mui/icons-material';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
} from '@dnd-kit/core';
import {
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    SortableContext,
} from '@dnd-kit/sortable';
import { Round, Question, Theme } from '../types/quiz';
import { useTranslation } from '../i18n/LanguageContext';
import ThemeRow from './ThemeRow';
import AddButton from './AddButton';
import QuestionButton from './QuestionButton';

// A simple preview for the theme row during drag
const ThemeRowOverlay: React.FC<{ theme: Theme }> = ({ theme }: { theme: Theme }) => (
    <Box
        sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '16px',
            background: 'var(--glass-bg)',
            borderRadius: '12px',
            border: '2px solid var(--hover-border)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            width: '100%',
            opacity: 0.8,
        }}
    >
        <Typography sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>{theme.name}</Typography>
    </Box>
);

interface GameBoardGridProps {
    currentRound: Round;
    roundIndex: number;
    totalRounds: number;
    onPreviousRound: () => void;
    onNextRound: () => void;
    onRoundNameChange: (name: string) => void;
    onThemeNameChange: (themeIndex: number, name: string) => void;
    onThemeOrderedToggle: (themeIndex: number) => void;
    onQuestionClick: (themeIndex: number, questionIndex: number) => void;
    onAddQuestion: (themeIndex: number) => void;
    onDeleteTheme: (themeIndex: number) => void;
    onMoveThemeToRound: (themeIndex: number, targetRoundIndex: number) => void;
    rounds: Round[];
    onAddTheme: () => void;
    onDragEnd: (event: DragEndEvent) => void;
}

const GameBoardGrid: React.FC<GameBoardGridProps> = ({
    currentRound,
    roundIndex,
    totalRounds,
    onPreviousRound,
    onNextRound,
    onRoundNameChange,
    onThemeNameChange,
    onThemeOrderedToggle,
    onQuestionClick,
    onAddQuestion,
    onDeleteTheme,
    onMoveThemeToRound,
    rounds,
    onAddTheme,
    onDragEnd,
}: GameBoardGridProps) => {
    const { t } = useTranslation();
    const [isEditingName, setIsEditingName] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEndLocal = (event: DragEndEvent) => {
        setActiveId(null);
        onDragEnd(event);
    };

    // Find the question for the overlay
    let activeQuestion: Question | undefined;
    let activePrice: number = 0;
    let activeRowIndex: number = 0;
    if (activeId && activeId.startsWith('q-')) {
        const qId = parseInt(activeId.replace('q-', ''), 10);
        currentRound.themes.forEach((theme: Theme, themeIdx: number) => {
            theme.questions.forEach((q: Question, idx: number) => {
                if (q.id === qId) {
                    activeQuestion = q;
                    activePrice = (idx + 1) * 100;
                    activeRowIndex = themeIdx;
                }
            });
        });
    }

    // Find the theme for the overlay
    let activeTheme: Theme | undefined;
    if (activeId && activeId.startsWith('t-')) {
        const tId = parseInt(activeId.replace('t-', ''), 10);
        activeTheme = currentRound.themes.find((t: Theme) => t.id === tId);
    }

    const themeIds = currentRound.themes.map((t: Theme) => `t-${t.id}`);

    return (
        <Box>
            {/* Round Navigation */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    marginBottom: '32px',
                    padding: '20px',
                    background: 'var(--glass-bg)',
                    borderRadius: '16px',
                    border: '1px solid var(--glass-border)',
                }}
            >
                <IconButton
                    onClick={onPreviousRound}
                    disabled={roundIndex === 0}
                    sx={{
                        color: 'var(--primary)',
                        '&:disabled': {
                            color: 'var(--text-muted)',
                        },
                    }}
                >
                    <ChevronLeft fontSize="large" />
                </IconButton>

                {isEditingName ? (
                    <TextField
                        value={currentRound.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onRoundNameChange(e.target.value)}
                        onBlur={() => setIsEditingName(false)}
                        onKeyPress={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter') {
                                setIsEditingName(false);
                            }
                        }}
                        autoFocus
                        variant="standard"
                        inputProps={{
                            style: {
                                textAlign: 'center',
                                fontSize: '2.125rem',
                                fontWeight: 700,
                                background: 'var(--grad-text)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                                width: '300px',
                            },
                        }}
                        sx={{
                            minWidth: '300px',
                            '& .MuiInput-underline:before': { borderBottomColor: 'var(--hover-border)' },
                            '& .MuiInput-underline:after': { borderBottomColor: 'var(--primary)' },
                        }}
                    />
                ) : (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            cursor: 'pointer',
                            '&:hover .edit-icon': {
                                opacity: 1,
                            },
                        }}
                        onClick={() => setIsEditingName(true)}
                    >
                        <Typography
                            variant="h4"
                            sx={{
                                minWidth: '200px',
                                textAlign: 'center',
                                fontWeight: 700,
                                background: 'var(--grad-text)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                                transition: 'transform 0.2s',
                            }}
                        >
                            {currentRound.name}
                        </Typography>
                        <IconButton
                            className="edit-icon"
                            size="small"
                            sx={{
                                opacity: 0.5,
                                transition: 'opacity 0.2s',
                                color: 'var(--secondary)',
                            }}
                        >
                            <EditIcon />
                        </IconButton>
                    </Box>
                )}

                <IconButton
                    onClick={onNextRound}
                    sx={{
                        color: 'var(--primary)',
                    }}
                >
                    <ChevronRight fontSize="large" />
                </IconButton>
            </Box>

            {/* Themes Grid */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEndLocal}
            >
                <Box
                    sx={{
                        background: 'var(--surface-soft)',
                        borderRadius: '16px',
                        padding: '24px',
                        border: '1px solid var(--glass-border)',
                    }}
                >
                    {currentRound.themes.length === 0 ? (
                        <Box
                            sx={{
                                textAlign: 'center',
                                padding: '60px',
                                color: 'var(--text-secondary)',
                            }}
                        >
                            <Typography variant="h6" sx={{ marginBottom: 2 }}>
                                {t('board.noThemes')}
                            </Typography>
                            <Typography variant="body2" sx={{ marginBottom: 3 }}>
                                {t('board.noThemesHint')}
                            </Typography>
                        </Box>
                    ) : (
                        <SortableContext items={themeIds} strategy={verticalListSortingStrategy}>
                            {currentRound.themes.map((theme: Theme, themeIndex: number) => (
                                <ThemeRow
                                    key={`t-${theme.id}`}
                                    theme={theme}
                                    themeIndex={themeIndex}
                                    onThemeNameChange={(name: string) => onThemeNameChange(themeIndex, name)}
                                    onThemeOrderedToggle={() => onThemeOrderedToggle(themeIndex)}
                                    onQuestionClick={(questionIndex: number) => onQuestionClick(themeIndex, questionIndex)}
                                    onAddQuestion={() => onAddQuestion(themeIndex)}
                                    onDeleteTheme={() => onDeleteTheme(themeIndex)}
                                    rounds={rounds}
                                    currentRoundIndex={roundIndex}
                                    onMoveToRound={(targetRoundIndex: number) => onMoveThemeToRound(themeIndex, targetRoundIndex)}
                                />
                            ))}
                        </SortableContext>
                    )}

                    <Box sx={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
                        <AddButton onClick={onAddTheme} label={t('board.addNewTheme')} size="large" />
                    </Box>
                </Box>

                <DragOverlay dropAnimation={null}>
                    {activeId && activeId.startsWith('q-') && activeQuestion ? (
                        <QuestionButton
                            id={activeId}
                            question={activeQuestion}
                            price={activePrice}
                            rowIndex={activeRowIndex}
                            onClick={() => { }}
                            hasContent={true}
                        />
                    ) : activeId && activeId.startsWith('t-') && activeTheme ? (
                        <ThemeRowOverlay theme={activeTheme} />
                    ) : null}
                </DragOverlay>
            </DndContext>
        </Box>
    );
};

export default GameBoardGrid;
