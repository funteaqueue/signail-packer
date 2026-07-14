import { Question, QuestionType } from '../types/quiz';

// The board uses this to distinguish a saved question from an empty price
// slot. Image-native question types intentionally keep rules/after_round empty,
// so their authored media and targets are the content signal instead.
export const questionHasContent = (question?: Question): boolean => {
  if (!question) return false;

  switch (question.type) {
    case QuestionType.FindACat:
      return !!question.image;
    case QuestionType.PointOnImage:
      return !!question.image && !!question.correct_point;
    case QuestionType.Karaoke:
      return !!question.media;
    default:
      return !!(
        (question.rules && question.rules.length > 0)
        || (question.after_round && question.after_round.length > 0)
      );
  }
};

// Every theme starts with the classic five Jeopardy slots, but authored
// questions are not capped at five. Additional questions continue the default
// price sequence and remain visible/editable in the editor.
export const getQuestionSlotPrices = (questionCount: number): number[] =>
  Array.from(
    { length: Math.max(5, Math.max(0, questionCount)) },
    (_, index) => (index + 1) * 100
  );
