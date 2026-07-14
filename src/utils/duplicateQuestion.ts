import { Question, Quiz } from '../types/quiz';

export const getNextQuestionId = (quiz: Quiz): number => {
  let maxId = 0;

  quiz.rounds.forEach((round) => {
    round.themes.forEach((theme) => {
      theme.questions.forEach((question) => {
        maxId = Math.max(maxId, question.id || 0);
      });
    });
  });

  return maxId + 1;
};

// Quiz questions are JSON data. Serializing here creates an independent copy
// of every nested rule, answer option and embedded-media field.
export const duplicateQuestion = (question: Question, id: number): Question => ({
  ...(JSON.parse(JSON.stringify(question)) as Question),
  id,
});
