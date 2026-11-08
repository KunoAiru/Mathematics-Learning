import type { AnswerSpec } from '../content/types';

/** "3/4", "-0.25", "1e-3", 全角数字・全角マイナスも受け付ける。読めなければ NaN。 */
export function parseNumber(input: string | number): number {
  if (typeof input === 'number') return input;
  const s = input.normalize('NFKC').replace(/[−–—ー]/g, '-').replace(/\s+/g, '');
  if (s === '') return NaN;
  const frac = s.match(/^([+-]?[\d.]+(?:e[+-]?\d+)?)\/([+-]?[\d.]+(?:e[+-]?\d+)?)$/i);
  if (frac) {
    const a = Number(frac[1]);
    const b = Number(frac[2]);
    return b === 0 ? NaN : a / b;
  }
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}

/** "1, 2, 3" / "1 2 3" / "(1,2)" などを数の並びに分ける */
export function parseList(input: string): number[] {
  const s = input.normalize('NFKC').replace(/[()（）[\]{}]/g, ' ');
  const parts = s.split(/[,、;\s]+/).filter((p) => p.length > 0);
  return parts.map(parseNumber);
}

const DEFAULT_TOL = 1e-9;

const close = (x: number, v: number, tol: number) => Number.isFinite(x) && Math.abs(x - v) <= tol * Math.max(1, Math.abs(v));

export type UserAnswer = string | number | string[][];

export function checkAnswer(spec: AnswerSpec, input: UserAnswer): boolean {
  switch (spec.type) {
    case 'numeric':
      return close(parseNumber(input as string), parseNumber(spec.value), spec.tol ?? DEFAULT_TOL);
    case 'tuple': {
      const xs = parseList(input as string);
      const vs = spec.value.map(parseNumber);
      return xs.length === vs.length && xs.every((x, i) => close(x, vs[i], spec.tol ?? DEFAULT_TOL));
    }
    case 'set': {
      const xs = parseList(input as string).sort((a, b) => a - b);
      const vs = spec.value.map(parseNumber).sort((a, b) => a - b);
      return xs.length === vs.length && xs.every((x, i) => close(x, vs[i], spec.tol ?? DEFAULT_TOL));
    }
    case 'matrix': {
      const m = input as string[][];
      const v = spec.value;
      return (
        m.length === v.length &&
        m.every((row, i) => row.length === v[i].length && row.every((x, j) => close(parseNumber(x), parseNumber(v[i][j]), spec.tol ?? DEFAULT_TOL)))
      );
    }
    case 'choice':
      return input === spec.value;
    case 'self':
      return true;
  }
}

/** 正解を表示用の文字列にする */
export function formatAnswer(spec: AnswerSpec): string {
  const f = (v: number | string) => {
    if (typeof v !== 'number' || Number.isInteger(v)) return String(v);
    return Math.abs(v) >= 0.01 ? String(Math.round(v * 1e4) / 1e4) : v.toPrecision(4);
  };
  switch (spec.type) {
    case 'numeric':
      return f(spec.value);
    case 'tuple':
      return `(${spec.value.map(f).join(', ')})`;
    case 'set':
      return `{${spec.value.map(f).join(', ')}}`;
    case 'matrix':
      return spec.value.map((r) => r.map(f).join('  ')).join('\n');
    case 'choice':
      return spec.choices[spec.value];
    case 'self':
      return spec.value;
  }
}

/** 正解を数式マークアップで（画面表示用） */
export function answerMarkup(spec: AnswerSpec): string {
  if (spec.type === 'choice' || spec.type === 'self') return formatAnswer(spec);
  if (spec.type === 'matrix') {
    const rows = formatAnswer(spec)
      .split('\n')
      .map((r) => r.split(/\s+/).join(' & '))
      .join(' \\\\ ');
    return `$\\begin{pmatrix} ${rows} \\end{pmatrix}$`;
  }
  return `$${formatAnswer(spec).replace(/[{}]/g, (c) => '\\' + c)}$`;
}

export const inputHint = (spec: AnswerSpec): string => {
  switch (spec.type) {
    case 'numeric':
      return '数値（分数 3/4 も可）';
    case 'tuple':
      return '順番どおりカンマ区切り（例: 1, -2）';
    case 'set':
      return 'カンマ区切り・順不同（例: 2, 5）';
    default:
      return '';
  }
};
