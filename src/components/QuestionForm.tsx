import React, { useState, useEffect } from 'react';
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
import { Question, QuestionType, Price, Rule, RuleType } from '../types/pack';
import { useTranslation } from '../i18n/LanguageContext';
import RuleForm from './RuleForm';
import { loadPack, savePack } from '../services/storage';

interface QuestionFormProps {
  questions: Question[];
  onQuestionsChange: (questions: Question[]) => void;
  getNextQuestionId: () => number;
}

const QuestionForm: React.FC<QuestionFormProps> = ({ questions, onQuestionsChange, getNextQuestionId }) => {
  const { t } = useTranslation();
  const [currentQuestion, setCurrentQuestion] = useState<Partial<Question>>({
    id: getNextQuestionId(),
    type: QuestionType.Normal,
    price: {
      text: ((questions.length + 1) * 100).toString(),
      correct: (questions.length + 1) * 100,
      incorrect: -(questions.length + 1) * 100,
      random_range: 'null'
    },
    rules: [],
    after_round: []
  });

  // Update currentQuestion ID when questions change
  useEffect(() => {
    setCurrentQuestion(prev => ({
      ...prev,
      id: getNextQuestionId()
    }));
  }, [questions, getNextQuestionId]);

  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  const handleAddQuestion = () => {
    if (currentQuestion.type) {
      const newQuestion = {
        ...currentQuestion,
        id: getNextQuestionId()
      } as Question;

      onQuestionsChange([...questions, newQuestion]);

      setCurrentQuestion({
        id: getNextQuestionId(),
        type: QuestionType.Normal,
        price: {
          text: ((questions.length + 2) * 100).toString(),
          correct: (questions.length + 2) * 100,
          incorrect: -(questions.length + 2) * 100,
          random_range: 'null'
        },
        rules: [],
        after_round: []
      });
    }
  };

  const handleDeleteQuestion = (index: number) => {
    const updatedQuestions = questions.filter((_, i) => i !== index);
    // Update points for remaining questions
    const updatedQuestionsWithPoints = updatedQuestions.map((q, i) => ({
      ...q,
      price: {
        ...q.price!,
        correct: (i + 1) * 100,
        incorrect: -(i + 1) * 100
      }
    }));
    onQuestionsChange(updatedQuestionsWithPoints);
  };

  const handlePriceChange = (field: keyof Price, value: string | number) => {
    setCurrentQuestion(prev => ({
      ...prev,
      price: {
        ...prev.price!,
        [field]: field === 'text' ? value.toString() : value
      }
    }));
    // Explicitly call onQuestionsChange after price update
    const updatedQuestions = questions.map(q =>
      q.id === currentQuestion.id ? {
        ...q,
        price: {
          ...q.price!,
          [field]: field === 'text' ? value.toString() : value
        }
      } : q
    );
    onQuestionsChange(updatedQuestions);
  };

  const handleRulesChange = (index: number, rules: Rule[]) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index].rules = rules;
    onQuestionsChange(updatedQuestions);
  };

  const handleAfterRoundChange = (index: number, rules: Rule[]) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index].after_round = rules;
    onQuestionsChange(updatedQuestions);
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle1" gutterBottom>
        {t('questionForm.questions')}
      </Typography>

      {/* Add Question Form */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            label={t('question.priceText')}
            value={currentQuestion.price?.text || ''}
            onChange={(e) => handlePriceChange('text', e.target.value)}
          />
          <TextField
            fullWidth
            type="number"
            label={t('question.correctPoints')}
            value={currentQuestion.price?.correct || (questions.length + 1) * 100}
            onChange={(e) => handlePriceChange('correct', parseInt(e.target.value))}
          />
          <TextField
            fullWidth
            type="number"
            label={t('question.incorrectPoints')}
            value={currentQuestion.price?.incorrect || -(questions.length + 1) * 100}
            onChange={(e) => handlePriceChange('incorrect', parseInt(e.target.value))}
          />

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddQuestion}
          >
            {t('question.addQuestion')}
          </Button>
        </Box>
      </Paper>

      {/* Questions List */}
      <List>
        {questions.map((question, index) => (
          <React.Fragment key={index}>
            <ListItem>
              <ListItemText
                primary={t('questionForm.questionItem', { id: question.id, type: question.type })}
                secondary={
                  question.type !== QuestionType.Empty ? (
                    <>
                      {t('questionForm.priceLabel')} {question.price?.text}<br />
                      {t('questionForm.correctLabel')} {question.price?.correct}<br />
                      {t('questionForm.incorrectLabel')} {question.price?.incorrect}
                    </>
                  ) : t('questionForm.emptyQuestion')
                }
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={() => setExpandedQuestion(expandedQuestion === index ? null : index)}
                >
                  <ExpandMoreIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  onClick={() => handleDeleteQuestion(index)}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
            <Collapse in={expandedQuestion === index}>
              <Box sx={{ pl: 4, pr: 4, pb: 2 }}>
                <RuleForm
                  rules={question.rules || []}
                  onRulesChange={(rules) => handleRulesChange(index, rules)}
                  title={t('questionForm.rules')}
                  draftRule={{}}
                  onDraftRuleChange={() => { }}
                />
                <RuleForm
                  rules={question.after_round || []}
                  onRulesChange={(rules) => handleAfterRoundChange(index, rules)}
                  title={t('questionForm.afterRoundRules')}
                  draftRule={{}}
                  onDraftRuleChange={() => { }}
                />
              </Box>
            </Collapse>
            {index < questions.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>
    </Box>
  );
};

export default QuestionForm; 