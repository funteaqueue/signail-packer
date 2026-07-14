// Shared question-type model (packer editor copy).
//
// Two legacy "types" are really cross-cutting options on a normal question:
//   secret      -> a question with user_selection (one chosen player)
//   text-answer -> a question answered via a text field instead of buzzing
//
// normalizeQuestion() rewrites those legacy types so the editor opens old packs
// in the new option-based shape. It is idempotent.
//
// Mirror of signail/backend/src/questionModel.js and
// signail/frontend/src/utils/questionModel.js — keep the three in sync.

import { Question } from '../types/quiz';

const LEGACY_TYPE_MAP: Record<string, Partial<Question>> = {
  secret: { type: 'normal' as Question['type'], user_selection: true },
  'text-answer': { type: 'normal' as Question['type'], response: 'text' },
  choice: { type: 'normal' as Question['type'], response: 'choice' },
};

export function normalizeQuestion(q: Question): Question {
  if (!q || typeof q !== 'object') return q;
  const legacy = LEGACY_TYPE_MAP[q.type as string];
  if (legacy) return { ...q, ...legacy };
  // Progressive-reveal is now an inline-image option: migrate the question-level
  // image + effect/curve into a normal question whose content is a reveal image.
  if ((q.type as string) === 'progressive-reveal') {
    const effect = q.effect || 'blur';
    const curve = q.curve || 'linear';
    const content = `<p><img src="${q.image || ''}" data-reveal="true" data-effect="${effect}" data-curve="${curve}"></p>`;
    return {
      ...q,
      type: 'normal' as Question['type'],
      rules: [{ type: 'embedded', content, duration: q.duration || 60 }] as Question['rules'],
      image: undefined,
      effect: undefined,
      curve: undefined,
    } as Question;
  }
  // Crocodile: fold the legacy crocodile_mode into the unified response axis.
  if (q.type === 'crocodile' && q.response === undefined && q.crocodile_mode) {
    return { ...q, response: (q.crocodile_mode === 'dixit' ? 'text' : 'buzz') as Question['response'] };
  }
  return q;
}

export const SELECTION_EXCLUSIVE_TYPES = ['normal', 'progressive-reveal'];
export const SELECTION_PARALLEL_TYPES = ['find-a-cat'];
export const SELECTION_MANDATORY_TYPES = ['karaoke', 'crocodile', 'spectrum'];

// Types that expose the "user selection" option (optionally, in the editor).
export const SELECTION_OPTIONAL_TYPES = [...SELECTION_EXCLUSIVE_TYPES, ...SELECTION_PARALLEL_TYPES];

export function hasUserSelection(q: Question): boolean {
  if (!q) return false;
  if (SELECTION_MANDATORY_TYPES.includes(q.type as string)) return true;
  if (SELECTION_OPTIONAL_TYPES.includes(q.type as string)) return !!q.user_selection;
  return false;
}

// Types whose answer method (buzz / text field / choice) can be chosen.
export const RESPONSE_TOGGLE_TYPES = ['normal', 'progressive-reveal', 'crocodile'];

// Response methods offered by the answer-method picker. 'multi-buzz' is a
// buzz race where the host's verdict consumes the buzz instead of ending the
// player's participation — the same player may buzz again while the timer
// runs (for open questions with many valid answers).
export type ResponseMethodOption = 'buzz' | 'multi-buzz' | 'text' | 'choice';
