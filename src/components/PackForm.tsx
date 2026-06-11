import React, { useState, useEffect, useRef } from 'react';
import { Container } from '@mui/material';
import { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Pack, Round, Question, Theme } from '../types/pack';
import { savePack, loadPack, initDB, clearStorage } from '../services/storage';
import { convertSIQFromFile } from '../services/siqConverter';
import { useTranslation } from '../i18n/LanguageContext';
import PackHeader from './PackHeader';
import GameBoardGrid from './GameBoardGrid';
import QuestionModal from './QuestionModal';

const PackForm: React.FC = () => {
  const { t } = useTranslation();
  const [packData, setPackData] = useState<Pack>({
    author: '',
    name: '',
    rounds: [
      {
        name: 'Round 1',
        themes: [],
      },
    ],
  });
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [dbReady, setDbReady] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const latestPackRef = useRef(packData);
  const [repacking, setRepacking] = useState(false);

  // Question Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<{
    themeIndex: number;
    questionIndex: number;
    question: Question | null;
  } | null>(null);

  // Helper to ensure all themes and questions have unique IDs
  const ensurePackIds = (pack: Pack): Pack => {
    let nextThemeId = 1;
    let nextQuestionId = 1;

    // Find highest existing IDs
    pack.rounds.forEach(round => {
      round.themes.forEach(theme => {
        if (theme.id && theme.id >= nextThemeId) nextThemeId = theme.id + 1;
        theme.questions.forEach(q => {
          if (q.id && q.id >= nextQuestionId) nextQuestionId = q.id + 1;
        });
      });
    });

    const updatedRounds = pack.rounds.map(round => ({
      ...round,
      themes: round.themes.map(theme => {
        const themeId = theme.id || nextThemeId++;
        return {
          ...theme,
          id: themeId,
          questions: theme.questions.map(q => {
            if (q.id) return q;
            return { ...q, id: nextQuestionId++ };
          })
        };
      })
    }));

    return { ...pack, rounds: updatedRounds };
  };

  // Initialize database
  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        await initDB();
        setDbReady(true);
      } catch (error) {
        console.error('Error initializing database:', error);
      }
    };
    initializeDatabase();
  }, []);

  // Load saved pack data
  useEffect(() => {
    if (dbReady) {
      const loadSavedPack = async () => {
        try {
          const savedPack = await loadPack();
          if (savedPack) {
            setPackData(ensurePackIds(savedPack));
          }
        } catch (error) {
          console.error('Error loading saved pack:', error);
        }
      };
      loadSavedPack();
    }
  }, [dbReady]);

  // Auto-save pack data
  useEffect(() => {
    if (!dbReady) return;
    if (!packData.name && !packData.author && packData.rounds.length === 1 && packData.rounds[0].themes.length === 0) {
      return;
    }

    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      savePack(packData).catch((error) => {
        console.error('Error saving pack:', error);
      });
      saveTimeoutRef.current = null;
    }, 500);

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [packData, dbReady]);

  useEffect(() => {
    latestPackRef.current = packData;
  }, [packData]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        if (dbReady && (latestPackRef.current.name || latestPackRef.current.author || latestPackRef.current.rounds[0].themes.length > 0)) {
          savePack(latestPackRef.current).catch((error) => {
            console.error('Error saving pack on unmount:', error);
          });
        }
        saveTimeoutRef.current = null;
      }
    };
  }, [dbReady]);

  // Round navigation
  const handlePreviousRound = () => {
    if (currentRoundIndex > 0) {
      setCurrentRoundIndex(currentRoundIndex - 1);
    }
  };

  const handleNextRound = () => {
    if (currentRoundIndex < packData.rounds.length - 1) {
      setCurrentRoundIndex(currentRoundIndex + 1);
    } else {
      // Create new round
      const newRound: Round = {
        name: `Round ${packData.rounds.length + 1}`,
        themes: [],
      };
      setPackData((prev: Pack) => ({
        ...prev,
        rounds: [...prev.rounds, newRound],
      }));
      setCurrentRoundIndex(packData.rounds.length);
    }
  };

  const handleRoundNameChange = (name: string) => {
    setPackData((prev: Pack) => {
      const updatedRounds = [...prev.rounds];
      updatedRounds[currentRoundIndex].name = name;
      return { ...prev, rounds: updatedRounds };
    });
  };

  const handleThemeNameChange = (themeIndex: number, name: string) => {
    setPackData((prev: Pack) => {
      const updatedRounds = [...prev.rounds];
      updatedRounds[currentRoundIndex].themes[themeIndex].name = name;
      return { ...prev, rounds: updatedRounds };
    });
  };

  const handleAddTheme = () => {
    setPackData((prev: Pack) => {
      let maxThemeId = 0;
      prev.rounds.forEach(r => r.themes.forEach(t => {
        if (t.id > maxThemeId) maxThemeId = t.id;
      }));

      const newTheme: Theme = {
        id: maxThemeId + 1,
        name: `Theme ${packData.rounds[currentRoundIndex].themes.length + 1}`,
        description: '',
        ordered: false,
        questions: [],
      };

      const updatedRounds = [...prev.rounds];
      updatedRounds[currentRoundIndex].themes.push(newTheme);
      return { ...prev, rounds: updatedRounds };
    });
  };

  const handleDeleteTheme = (themeIndex: number) => {
    setPackData((prev: Pack) => {
      const updatedRounds = [...prev.rounds];
      updatedRounds[currentRoundIndex].themes = updatedRounds[currentRoundIndex].themes.filter(
        (_: any, i: number) => i !== themeIndex
      );
      return { ...prev, rounds: updatedRounds };
    });
  };

  const handleAddQuestion = (themeIndex: number) => {
    const theme = packData.rounds[currentRoundIndex].themes[themeIndex];
    const questionIndex = theme.questions.length;

    setEditingQuestion({
      themeIndex,
      questionIndex,
      question: null,
    });
    setModalOpen(true);
  };

  const handleQuestionClick = (themeIndex: number, questionIndex: number) => {
    const theme = packData.rounds[currentRoundIndex].themes[themeIndex];
    const question = theme.questions[questionIndex] || null;

    setEditingQuestion({
      themeIndex,
      questionIndex,
      question,
    });
    setModalOpen(true);
  };

  const handleSaveQuestion = (question: Question) => {
    if (!editingQuestion) return;

    setPackData((prev: Pack) => {
      const updatedRounds = [...prev.rounds];
      const theme = updatedRounds[currentRoundIndex].themes[editingQuestion.themeIndex];

      // Ensure the question has an ID
      if (!question.id) {
        let maxId = 0;
        updatedRounds.forEach((r: Round) => r.themes.forEach((t: Theme) => t.questions.forEach((q: Question) => {
          if (q.id > maxId) maxId = q.id;
        })));
        question.id = maxId + 1;
      }

      if (editingQuestion.questionIndex < theme.questions.length) {
        // Update existing question
        theme.questions[editingQuestion.questionIndex] = question;
      } else {
        // Add new question
        theme.questions.push(question);
      }

      return { ...prev, rounds: updatedRounds };
    });

    setModalOpen(false);
    setEditingQuestion(null);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingQuestion(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId !== overId) {
      setPackData((prev: Pack) => {
        const updatedRounds = [...prev.rounds];
        const currentRound = updatedRounds[currentRoundIndex];

        // Handle Theme Drag and Drop
        if (activeId.startsWith('t-') && overId.startsWith('t-')) {
          const activeThemeId = parseInt(activeId.replace('t-', ''), 10);
          const overThemeId = parseInt(overId.replace('t-', ''), 10);

          const activeIndex = currentRound.themes.findIndex(t => t.id === activeThemeId);
          const overIndex = currentRound.themes.findIndex(t => t.id === overThemeId);

          if (activeIndex !== -1 && overIndex !== -1) {
            currentRound.themes = arrayMove(currentRound.themes, activeIndex, overIndex);
          }
          return { ...prev, rounds: updatedRounds };
        }

        // Handle Question Drag and Drop
        let activeThemeIndex = -1;
        let activeQuestionIndex = -1;
        let overThemeIndex = -1;
        let overQuestionIndex = -1;

        // Find source and destination
        currentRound.themes.forEach((theme: Theme, tIdx: number) => {
          theme.questions.forEach((q: Question, qIdx: number) => {
            if (`q-${q.id}` === activeId) {
              activeThemeIndex = tIdx;
              activeQuestionIndex = qIdx;
            }
            if (`q-${q.id}` === overId) {
              overThemeIndex = tIdx;
              overQuestionIndex = qIdx;
            }
          });
        });

        if (activeThemeIndex === -1) return prev; // Should not happen

        if (overThemeIndex === -1) {
          // Check if dropped over an empty slot
          if (overId.startsWith('empty-')) {
            const parts = overId.split('-');
            overThemeIndex = parseInt(parts[1], 10);
            overQuestionIndex = parseInt(parts[2], 10);
          }
        }

        if (overThemeIndex === -1) return prev;

        const activeTheme = currentRound.themes[activeThemeIndex];
        const overTheme = currentRound.themes[overThemeIndex];
        const question = activeTheme.questions[activeQuestionIndex];

        if (activeThemeIndex === overThemeIndex) {
          // Reorder within the same theme
          activeTheme.questions = arrayMove(activeTheme.questions, activeQuestionIndex, overQuestionIndex);
        } else {
          // Move to a different theme
          activeTheme.questions.splice(activeQuestionIndex, 1);
          overTheme.questions.splice(overQuestionIndex, 0, question);
        }

        return { ...prev, rounds: updatedRounds };
      });
    }
  };

  const buildDownloadFileName = (name: string) => (name ? name.toLowerCase().replace(/\s+/g, '-') : 'pack');

  const downloadPack = (pack: Pack) => {
    const jsonString = JSON.stringify(pack, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${buildDownloadFileName(pack.name)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownload = () => {
    downloadPack(packData);
  };

  const handleRepackFile = async (file: File) => {
    setRepacking(true);
    try {
      const convertedPack = await convertSIQFromFile(file);
      const safePack = {
        ...convertedPack,
        rounds: convertedPack.rounds && convertedPack.rounds.length > 0 ? convertedPack.rounds : [{ name: 'Round 1', themes: [] }],
      };
      setPackData(ensurePackIds(safePack));
      setCurrentRoundIndex(0);
    } catch (error) {
      console.error('Error repacking SIQ package:', error);
      const message = error instanceof Error ? error.message : t('pack.repackErrorFallback');
      alert(t('pack.repackError', { message }));
    } finally {
      setRepacking(false);
    }
  };

  const handleClearStorage = async () => {
    try {
      await clearStorage();
      window.location.reload();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      await clearStorage();
      await savePack(jsonData);
      setPackData(ensurePackIds(jsonData));
      setCurrentRoundIndex(0);
    } catch (error) {
      console.error('Error loading JSON file:', error);
      alert(t('pack.uploadError'));
    }
  };

  const currentRound: Round = packData.rounds[currentRoundIndex] || { name: 'Round 1', themes: [] };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PackHeader
        packName={packData.name}
        author={packData.author}
        onPackNameChange={(name: string) => setPackData((prev: Pack) => ({ ...prev, name }))}
        onAuthorChange={(author: string) => setPackData((prev: Pack) => ({ ...prev, author }))}
        onUpload={handleFileUpload}
        onDownload={handleDownload}
        onRepackFile={handleRepackFile}
        onClear={handleClearStorage}
        repacking={repacking}
      />

      <GameBoardGrid
        currentRound={currentRound}
        roundIndex={currentRoundIndex}
        totalRounds={packData.rounds.length}
        onPreviousRound={handlePreviousRound}
        onNextRound={handleNextRound}
        onRoundNameChange={handleRoundNameChange}
        onThemeNameChange={handleThemeNameChange}
        onQuestionClick={handleQuestionClick}
        onAddQuestion={handleAddQuestion}
        onDeleteTheme={handleDeleteTheme}
        onAddTheme={handleAddTheme}
        onDragEnd={handleDragEnd}
      />

      <QuestionModal
        open={modalOpen}
        question={editingQuestion?.question || null}
        questionIndex={editingQuestion?.questionIndex || 0}
        onSave={handleSaveQuestion}
        onClose={handleCloseModal}
      />
    </Container>
  );
};

export default PackForm;
