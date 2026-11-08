// 教材のデータ形式。content/**/*.yaml はこの形に従う。

export type SubjectId =
  | 'linear-algebra'
  | 'probability'
  | 'statistics'
  | 'algebra'
  | 'convex'
  | 'cpp'
  | 'rust';

export interface Subject {
  id: SubjectId;
  name: string;
  short: string;
  group: 'math' | 'code';
  color: string;
  source: string;
}

export const SUBJECTS: Subject[] = [
  { id: 'linear-algebra', name: '線形代数', short: '線形', group: 'math', color: '#3b82f6', source: 'Axler, Linear Algebra Done Right 4th ed.（オープンアクセス）' },
  { id: 'probability', name: '確率論', short: '確率', group: 'math', color: '#10b981', source: 'Grinstead & Snell, Introduction to Probability（無料公開）' },
  { id: 'statistics', name: '統計学', short: '統計', group: 'math', color: '#14b8a6', source: 'OpenIntro Statistics 4th ed.（無料公開）' },
  { id: 'algebra', name: '抽象代数学', short: '代数', group: 'math', color: '#a855f7', source: 'Judson, Abstract Algebra: Theory and Applications（無料公開）' },
  { id: 'convex', name: '凸解析・最適化', short: '最適化', group: 'math', color: '#f59e0b', source: 'Boyd & Vandenberghe, Convex Optimization（無料公開）' },
  { id: 'cpp', name: 'C++', short: 'C++', group: 'code', color: '#ef4444', source: 'cppreference.com / learncpp.com' },
  { id: 'rust', name: 'Rust', short: 'Rust', group: 'code', color: '#f97316', source: 'The Rust Programming Language（無料公開）' },
];

export const subjectOf = (id: SubjectId): Subject => SUBJECTS.find((s) => s.id === id)!;

/** 概念に付ける確認問題（仮定を外すと？逆は？など）。自己採点。 */
export interface Question {
  q: string;
  a: string;
}

export type AnswerSpec =
  | { type: 'numeric'; value: number | string; tol?: number }
  | { type: 'tuple'; value: (number | string)[]; tol?: number }
  | { type: 'set'; value: (number | string)[]; tol?: number }
  | { type: 'matrix'; value: (number | string)[][]; tol?: number }
  | { type: 'choice'; choices: string[]; value: number }
  | { type: 'self'; value: string };

interface ItemBase {
  id: string;
  subject: SubjectId;
  title: string;
  requires: string[];
  source?: string;
  /** なぜ重要か・どこで使うか（研究・セキュリティ・実装との関係） */
  why?: string;
  questions?: Question[];
}

export interface DefinitionItem extends ItemBase {
  kind: 'definition';
  statement: string;
}

export interface TheoremItem extends ItemBase {
  kind: 'theorem';
  statement: string;
  /** 証明のステップ（3つ以上あれば並べ替えカードを作る） */
  proof?: string[];
}

export interface ProblemItem extends ItemBase {
  kind: 'problem';
  /** generator を指定すると毎回数値の違う問題を作る */
  generator?: string;
  prompt?: string;
  answer?: AnswerSpec;
  solution?: string;
}

export interface CodeItem extends ItemBase {
  kind: 'code';
  lang: 'cpp' | 'rust';
  code: string;
  prompt: string;
  answer: AnswerSpec;
  explanation: string;
  /** scripts/validate.ts --code で実際にコンパイル・実行して確かめる内容 */
  verify?: { build?: 'ok' | 'error'; stdout?: string; panics?: boolean };
}

export interface ExerciseItem extends ItemBase {
  kind: 'exercise';
  lang: 'cpp' | 'rust';
  prompt: string;
  starter: string;
  solution: string;
  /** 自分の実装を確かめるためのチェック項目 */
  checklist?: string[];
}

export type Item = DefinitionItem | TheoremItem | ProblemItem | CodeItem | ExerciseItem;

export const isConcept = (it: Item): it is DefinitionItem | TheoremItem =>
  it.kind === 'definition' || it.kind === 'theorem';

export const KIND_LABEL: Record<Item['kind'], string> = {
  definition: '定義',
  theorem: '定理',
  problem: '問題',
  code: 'コード',
  exercise: '実装演習',
};

/** カード = 復習スケジュールの単位。1つの Item から複数できる。 */
export type CardVariant =
  | { type: 'recall' }
  | { type: 'order' }
  | { type: 'question'; index: number }
  | { type: 'problem' }
  | { type: 'code' }
  | { type: 'exercise' };

export interface CardDef {
  id: string; // `${itemId}#${variantKey}`
  itemId: string;
  variant: CardVariant;
}
