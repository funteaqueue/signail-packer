import { QuestionType } from '../types/quiz';
import { duplicateQuestion, getNextQuestionId } from './duplicateQuestion';

describe('duplicateQuestion', () => {
  test('preserves type-specific data while assigning a new id', () => {
    const source = {
      id: 7,
      type: QuestionType.Spectrum,
      spectrum_left: 'Cold',
      spectrum_right: 'Hot',
      spectrum_range: 12,
      spectrum_target_mode: 'fixed',
      spectrum_target: 96,
      rules: [{ type: 'app', content: 'Question' }],
    };

    const copy = duplicateQuestion(source, 12);

    expect(copy).toEqual({ ...source, id: 12 });
    expect(copy.rules).not.toBe(source.rules);
  });

  test('finds the next id across every round and theme', () => {
    expect(getNextQuestionId({
      author: '',
      name: '',
      rounds: [
        { name: 'One', themes: [{ id: 1, name: 'A', ordered: false, questions: [{ id: 3 }] }] },
        { name: 'Two', themes: [{ id: 2, name: 'B', ordered: false, questions: [{ id: 19 }] }] },
      ],
    })).toBe(20);
  });
});
