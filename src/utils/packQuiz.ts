// Pack a quiz for download: walk every field that can hold an externally-hosted
// image and inline it as a base64 data URL, so the exported file stays
// self-contained. A remote host that disappears, goes offline, or blocks
// hotlinking at game time would otherwise leave the question with a broken
// image. URLs that can't be fetched (CORS, 404, offline) are left untouched.

import { Quiz, Question, Rule, ChoiceOption } from '../types/quiz';
import { embedExternalImages, fetchAsDataUrl } from './embedImages';

const isExternalUrl = (src: string | undefined): src is string => !!src && /^https?:\/\//i.test(src);

// Inline a bare image-URL field (e.g. Question.image), leaving it unchanged when
// it is already a data URL or could not be fetched.
const packImageField = async (value: string | undefined): Promise<string | undefined> => {
  if (!isExternalUrl(value)) return value;
  const dataUrl = await fetchAsDataUrl(value);
  return dataUrl ?? value;
};

const packRule = async (rule: Rule): Promise<Rule> =>
  rule.content ? { ...rule, content: await embedExternalImages(rule.content) } : rule;

const packOption = async (option: ChoiceOption): Promise<ChoiceOption> =>
  option.content ? { ...option, content: await embedExternalImages(option.content) } : option;

const packQuestion = async (question: Question): Promise<Question> => {
  const [image, rules, afterRound, options] = await Promise.all([
    packImageField(question.image),
    question.rules ? Promise.all(question.rules.map(packRule)) : undefined,
    question.after_round ? Promise.all(question.after_round.map(packRule)) : undefined,
    question.options ? Promise.all(question.options.map(packOption)) : undefined,
  ]);
  return { ...question, image, rules, after_round: afterRound, options };
};

// Returns a deep-cloned quiz with every external image fetched and inlined as a
// base64 data URL. Network fetches across the whole quiz run concurrently.
export const packQuiz = async (quiz: Quiz): Promise<Quiz> => ({
  ...quiz,
  rounds: await Promise.all(
    quiz.rounds.map(async (round) => ({
      ...round,
      themes: await Promise.all(
        round.themes.map(async (theme) => ({
          ...theme,
          description: theme.description ? await embedExternalImages(theme.description) : theme.description,
          questions: await Promise.all(theme.questions.map(packQuestion)),
        }))
      ),
    }))
  ),
});
