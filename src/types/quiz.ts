export interface Quiz {
  author: string;
  name: string;
  rounds: Round[];
}

export interface Round {
  name: string;
  themes: Theme[];
}

export interface Theme {
  id: number;
  name: string;
  description?: string;
  ordered: boolean;
  questions: Question[];
}

export interface Question {
  id: number;
  price?: Price;
  type: QuestionType;
  rules?: Rule[];
  after_round?: Rule[];
  /** Find-a-cat task text shown to players; supports %total% and %left% placeholders */
  task?: string;
  /** @deprecated Legacy find-a-cat target name (e.g. "котиків"); converted to `task` on edit */
  name?: string;
  image?: string;
  map?: MapArea[];
  duration?: number;
  max_clicks?: number;
  first_place_bonus?: number;
  answer?: number;
  perfect_bonus?: number;
  multiple?: boolean;
  options?: ChoiceOption[];
  effect?: RevealEffect;
  curve?: RevealCurve;
  /** Karaoke track (audio or video) as a base64 data URL */
  media?: string;
  /** Karaoke lyrics: plain text or LRC "[mm:ss.xx] line" depending on lyrics_format */
  lyrics?: string;
  lyrics_format?: LyricsFormat;
  /** Crocodile scoring mode: 'fastest' (only the quickest correct guesser scores) or 'dixit' (everyone submits a text guess and anyone can score) */
  crocodile_mode?: CrocodileMode;
  /** Voting visibility: 'open' (everyone sees votes live) or 'closed' (hidden until the host reveals) */
  vote_mode?: VoteMode;
  // ----- Cross-cutting options (replace the old `secret`/`text-answer` types) -----
  /** Designate one player: the only one who may answer (buzz types) or the only one who can score (parallel types). Mandatory for karaoke/crocodile. */
  user_selection?: boolean;
  /** When user_selection is on, the picker may choose themselves. */
  allow_self_pick?: boolean;
  /** Answer method for normal/progressive-reveal/crocodile questions: buzz race, multi-buzz (a judged answer lets the player buzz again), text field or choice. Defaults to 'buzz'. */
  response?: ResponseMethod;
  /** Keep submitted answers masked from other players until the host reveals them. Defaults by type (text/numeric hidden, choice live). */
  hidden_until_reveal?: boolean;
}

export type ResponseMethod = 'buzz' | 'multi-buzz' | 'text' | 'choice';

export type LyricsFormat = 'plain' | 'lrc';

export type CrocodileMode = 'fastest' | 'dixit';

export type VoteMode = 'open' | 'closed';

export interface ChoiceOption {
  content: string;
  correct: boolean;
}

export type RevealEffect = 'blur' | 'pixelate' | 'zoom';

export type RevealCurve = 'linear' | 'slow-start' | 'fast-start';

export interface MapArea {
  width: string;
  height: string;
  left: string;
  top: string;
  color?: string;
}

export interface Price {
  text: string;
  correct: number;
  incorrect: number;
  random_range: string;
}

export interface Rule {
  type: RuleType;
  content?: string;
  duration?: number;
  path?: string;
}

export enum QuestionType {
  Normal = 'normal',
  Secret = 'secret',
  Empty = 'empty',
  FindACat = 'find-a-cat',
  CloseEnough = 'close-enough',
  Choice = 'choice',
  TextAnswer = 'text-answer',
  ProgressiveReveal = 'progressive-reveal',
  Karaoke = 'karaoke',
  Crocodile = 'crocodile',
  Voting = 'voting'
}

export enum RuleType {
  App = 'app',
  Embedded = 'embedded'
} 