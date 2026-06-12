import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Divider,
  Collapse,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { Quiz, Round, Theme, Question } from '../types/quiz';
import { useTranslation } from '../i18n/LanguageContext';
import QuestionForm from './QuestionForm';

interface RoundsFormProps {
  onSubmit: (rounds: Quiz['rounds']) => void;
  initialData: Quiz['rounds'];
  onRoundsChange: (rounds: Quiz['rounds']) => void;
}

const RoundsForm: React.FC<RoundsFormProps> = ({ onSubmit, initialData, onRoundsChange }) => {
  const { t } = useTranslation();
  const [rounds, setRounds] = useState<Round[]>(initialData);
  const [currentRound, setCurrentRound] = useState<Partial<Round>>({
    name: '',
    themes: [],
  });
  const [currentTheme, setCurrentTheme] = useState<Partial<Theme>>({
    name: '',
    description: '',
    ordered: false,
    questions: [],
  });
  const [expandedThemes, setExpandedThemes] = useState<{[key: string]: boolean}>({});
  const [expandedRounds, setExpandedRounds] = useState<boolean[]>(initialData.map(() => true));

  const getNextQuestionId = useCallback(() => {
    let maxId = 0;
    rounds.forEach(round => {
      round.themes.forEach(theme => {
        theme.questions.forEach(question => {
          if (question.id > maxId) {
            maxId = question.id;
          }
        });
      });
    });
    return maxId + 1;
  }, [rounds]);

  useEffect(() => {
    // Update expandedRounds when initialData changes (e.g., quiz loaded)
    setExpandedRounds(initialData.map(() => true));
  }, [initialData]);

  // Call onRoundsChange whenever the local rounds state changes
  useEffect(() => {
    onRoundsChange(rounds);
  }, [rounds, onRoundsChange]);

  const handleAddRound = () => {
    if (currentRound.name) {
      setRounds([...rounds, { ...currentRound, themes: [] } as Round]);
      setExpandedRounds([...expandedRounds, true]);
      setCurrentRound({ name: '', themes: [] });
    }
  };

  const handleDeleteRound = (index: number) => {
    const updatedRounds = rounds.filter((_: any, i: number) => i !== index);
    setRounds(updatedRounds);
    setExpandedRounds(expandedRounds.filter((_: boolean, i: number) => i !== index));
  };

  const handleAddTheme = (roundIndex: number) => {
    if (currentTheme.name) {
      const updatedRounds = [...rounds];
      updatedRounds[roundIndex].themes.push({
        ...currentTheme,
        questions: [],
      } as Theme);
      setRounds(updatedRounds);
      setCurrentTheme({ name: '', description: '', ordered: false, questions: [] });
    }
  };

  const handleDeleteTheme = (roundIndex: number, themeIndex: number) => {
    const updatedRounds = [...rounds];
    updatedRounds[roundIndex].themes = updatedRounds[roundIndex].themes.filter(
      (_: any, i: number) => i !== themeIndex
    );
    setRounds(updatedRounds);
  };

  const handleQuestionsChange = (roundIndex: number, themeIndex: number, questions: Theme['questions']) => {
    const updatedRounds = [...rounds];
    updatedRounds[roundIndex].themes[themeIndex].questions = questions;
    setRounds(updatedRounds);
  };

  const handleToggleRoundExpand = (index: number) => {
    const newExpandedRounds = [...expandedRounds];
    newExpandedRounds[index] = !newExpandedRounds[index];
    setExpandedRounds(newExpandedRounds);
  };

  const handleToggleThemeExpand = (roundIndex: number, themeIndex: number) => {
    const key = `${roundIndex}-${themeIndex}`;
    setExpandedThemes(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t('rounds.title')}
      </Typography>

      {/* Add Round Form */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          {t('rounds.addNewRound')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            fullWidth
            label={t('rounds.roundName')}
            value={currentRound.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentRound({ ...currentRound, name: e.target.value })}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddRound}
          >
            {t('rounds.addRound')}
          </Button>
        </Box>
      </Paper>

      {/* Rounds List */}
      {rounds.map((round: Round, roundIndex: number) => (
        <Paper key={roundIndex} sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <TextField
              variant="standard"
              value={round.name}
              onChange={(e) => {
                const updatedRounds = [...rounds];
                updatedRounds[roundIndex].name = e.target.value;
                setRounds(updatedRounds);
              }}
              sx={{ flexGrow: 1, marginRight: 2 }}
            />
            <IconButton onClick={() => handleDeleteRound(roundIndex)}>
              <DeleteIcon />
            </IconButton>
            <IconButton 
              onClick={() => handleToggleRoundExpand(roundIndex)}
              sx={{
                transform: expandedRounds[roundIndex] ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s ease-in-out',
              }}
            >
              <ExpandMoreIcon />
            </IconButton>
          </Box>

          <Collapse in={expandedRounds[roundIndex]}>
            <Box>
              {/* Add Theme Form */}
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  fullWidth
                  label={t('rounds.themeName')}
                  value={currentTheme.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentTheme({ ...currentTheme, name: e.target.value })}
                />
                <TextField
                  fullWidth
                  label={t('rounds.themeDescription')}
                  value={currentTheme.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setCurrentTheme({ ...currentTheme, description: e.target.value })}
                />
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleAddTheme(roundIndex)}
                >
                  {t('rounds.addTheme')}
                </Button>
              </Box>

              {/* Themes List */}
              <List>
                {round.themes.map((theme: Theme, themeIndex: number) => (
                  <React.Fragment key={themeIndex}>
                    <ListItem>
                      <ListItemText
                        primary={
                          <TextField
                            variant="standard"
                            value={theme.name}
                            onChange={(e) => {
                              const updatedRounds = [...rounds];
                              updatedRounds[roundIndex].themes[themeIndex].name = e.target.value;
                              setRounds(updatedRounds);
                            }}
                            sx={{ flexGrow: 1 }}
                          />
                        }
                        secondary={theme.description}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleToggleThemeExpand(roundIndex, themeIndex)}
                          sx={{
                            transform: expandedThemes[`${roundIndex}-${themeIndex}`] ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s ease-in-out',
                          }}
                        >
                          <ExpandMoreIcon />
                        </IconButton>
                        <IconButton
                          edge="end"
                          onClick={() => handleDeleteTheme(roundIndex, themeIndex)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    <Collapse in={expandedThemes[`${roundIndex}-${themeIndex}`]}>
                      <Box sx={{ pl: 4, pr: 4, pb: 2 }}>
                        <QuestionForm
                          questions={theme.questions}
                          onQuestionsChange={(questions: Question[]) => handleQuestionsChange(roundIndex, themeIndex, questions)}
                          getNextQuestionId={getNextQuestionId}
                        />
                      </Box>
                    </Collapse>
                    {themeIndex < round.themes.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Box>
          </Collapse>
        </Paper>
      ))}

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          onClick={() => onSubmit(rounds)}
          disabled={rounds.length === 0}
        >
          {t('common.next')}
        </Button>
      </Box>
    </Box>
  );
};

export default RoundsForm; 
