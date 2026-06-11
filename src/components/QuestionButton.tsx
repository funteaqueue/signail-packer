import React from 'react';
import { Box } from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Question } from '../types/pack';

interface QuestionButtonProps {
    id: string;
    question?: Question;
    price: number;
    onClick: () => void;
    hasContent: boolean;
    // Theme-row index: in Party Mix every row gets its own tile color
    // (html[data-theme="party"] .q-cell--r* rules in index.css)
    rowIndex?: number;
}

const QuestionButton: React.FC<QuestionButtonProps> = ({ id, question, price, onClick, hasContent, rowIndex }) => {
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
                padding: '24px 32px',
                minWidth: '120px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                touchAction: 'none',
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
            }}
        >
            <Box
                sx={{
                    fontSize: '32px',
                    fontWeight: 700,
                    pointerEvents: 'none',
                    zIndex: 2,
                }}
            >
                {question?.price?.text || price}
            </Box>

            {/* Edit Indicator */}
            <Box
                className="edit-indicator"
                sx={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    opacity: 0,
                    transition: 'opacity 0.2s ease',
                    color: 'rgba(255, 255, 255, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '50%',
                    padding: '4px',
                    '& .MuiSvgIcon-root': {
                        fontSize: '16px',
                    }
                }}
            >
                <EditIcon />
            </Box>

            <style>
                {`
                    .edit-indicator {
                        transition: opacity 0.2s ease;
                    }
                    div:hover > .edit-indicator {
                        opacity: 1;
                    }
                `}
            </style>
        </Box>
    );
};

export default QuestionButton;
