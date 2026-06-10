export interface Pack {
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
}

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
  ProgressiveReveal = 'progressive-reveal'
}

export enum RuleType {
  App = 'app',
  Embedded = 'embedded'
} 