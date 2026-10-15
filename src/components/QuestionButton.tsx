import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { ContentCopy as ContentCopyIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Question } from '../types/quiz';
import { useTranslation } from '../i18n/LanguageContext';

interface QuestionButtonProps {
    id: string;
    question?: Question;
    price: number;
    onClick: () => void;
    hasContent: boolean;
    onDuplicate?: () => void;
    onDelete?: () => void;
    // Theme-row index: in Party Mix every row gets its own tile color
    // (html[data-theme="party"] .q-cell--r* rules in index.css)
    rowIndex?: number;
}

const QuestionButton: React.FC<QuestionButtonProps> = ({ id, question, price, onClick, onDuplicate, onDelete, hasContent, rowIndex }) => {
    const { t } = useTranslation();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : (hasContent ? 1 : 0.6),
        zIndex: isDragging ? 1000 : 1,
    };

    return (
        <Box
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            className={rowIndex !== undefined ? `q-cell q-cell--r${rowIndex % 6}` : 'q-cell'}
            sx={{
                background: 'var(--grad-cell)',
                color: 'var(--cell-text)',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                borderRadius: '12px',
                position: 'relative',
                padding: { xs: '20px 10px', sm: '24px 32px' },
                minWidth: { xs: 0, sm: '120px' },
                width: { xs: '100%', sm: 'auto' },
                minHeight: { xs: 84, sm: 96 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                touchAction: { xs: 'manipulation', md: 'none' },
                transition: 'transform 0.3s ease, box-shadow 0.3s ease, border 0.3s ease',
                border: hasContent ? '2px solid var(--cell-border)' : '2px solid transparent',
                '&:hover': {
                    transform: 'translateY(-4px) scale(1.05)',
                    boxShadow: '0 8px 30px var(--cell-glow)',
                    border: '2px solid var(--hover-border)',
                },
                '&:active': {
                    cursor: 'grabbing',
                },
                '&:hover .question-actions, &:focus .question-actions, &:focus-within .question-actions': {
                    opacity: 1,
                    visibility: 'visible',
                    pointerEvents: 'auto',
                },
            }}
        >
            <Box
                sx={{
                    fontSize: { xs: '24px', sm: '32px' },
                    fontWeight: 700,
                    pointerEvents: 'none',
                    zIndex: 2,
                }}
            >
                {question?.price?.text || price}
            </Box>

            <Box
                className="question-actions"
                sx={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    opacity: { xs: 1, md: 0 },
                    visibility: { xs: 'visible', md: 'hidden' },
                    pointerEvents: { xs: 'auto', md: 'none' },
                    transition: 'opacity 0.15s ease',
                    display: 'flex',
                    gap: '2px',
                    padding: '2px',
                    borderRadius: '9px',
                    background: 'rgba(0, 0, 0, 0.34)',
                }}
            >
                {onDuplicate && (
                    <Tooltip title={t('question.duplicate')} arrow>
                        <IconButton
                            size="small"
                            aria-label={t('question.duplicate')}
                            onPointerDown={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                                event.stopPropagation();
                                onDuplicate();
                            }}
                            sx={{ color: 'rgba(255,255,255,.88)', p: '4px', width: 44, height: 44 }}
                        >
                            <ContentCopyIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                    </Tooltip>
                )}
                {onDelete && (
                    <Tooltip title={t('question.delete')} arrow>
                        <IconButton
                            size="small"
                            aria-label={t('question.delete')}
                            onPointerDown={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                                event.stopPropagation();
                                onDelete();
                            }}
                            sx={{ color: 'var(--danger)', p: '4px', width: 44, height: 44 }}
                        >
                            <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>

        </Box>
    );
};

export default QuestionButton;
