import { QuestionType } from '../types/quiz';
import { getQuestionSlotPrices, questionHasContent } from './questionContent';

const baseQuestion = {
  id: 1,
  type: QuestionType.PointOnImage,
  price: { text: '100', correct: 100, incorrect: -100, random_range: 'null' },
};

describe('questionHasContent', () => {
  test('recognizes a spectrum with two authored poles', () => {
    expect(questionHasContent({
      id: 2,
      type: QuestionType.Spectrum,
      spectrum_left: 'Cold',
      spectrum_right: 'Hot',
    })).toBe(true);
  });
  test('recognizes a complete point-on-image question as filled', () => {
    expect(questionHasContent({
      ...baseQuestion,
      image: 'data:image/png;base64,example',
      correct_point: { x: 0.5, y: 0.25 },
    })).toBe(true);
  });

  test('does not mark an incomplete point-on-image draft as filled', () => {
    expect(questionHasContent({ ...baseQuestion, image: 'data:image/png;base64,example' })).toBe(false);
  });

  test('shows every authored question beyond the five default slots', () => {
    expect(getQuestionSlotPrices(7)).toEqual([100, 200, 300, 400, 500, 600, 700]);
  });

  test('keeps five empty slots for a short theme', () => {
    expect(getQuestionSlotPrices(2)).toEqual([100, 200, 300, 400, 500]);
  });
});
