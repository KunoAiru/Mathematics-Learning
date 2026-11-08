import type { AnswerSpec } from '../content/types';

export interface GeneratedProblem {
  prompt: string;
  answer: AnswerSpec;
  solution: string;
  /** 検算用の内部データ（画面には出さない） */
  data?: any;
}

export interface Generator {
  id: string;
  generate(rng: Rng): GeneratedProblem;
  /** 別の方法で答えを計算し直して一致を確かめる（scripts/validate.ts で何百回も実行） */
  check(p: GeneratedProblem, rng: Rng): boolean;
}

/** 再現可能な乱数（mulberry32） */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** [lo, hi] の整数 */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }
  nonzero(lo: number, hi: number): number {
    for (;;) {
      const x = this.int(lo, hi);
      if (x !== 0) return x;
    }
  }
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)];
  }
  shuffle<T>(xs: T[]): T[] {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

export type Mat = number[][];

export const texMat = (m: Mat): string =>
  `\\begin{pmatrix} ${m.map((r) => r.join(' & ')).join(' \\\\ ')} \\end{pmatrix}`;

export const texVec = (v: number[]): string => texMat(v.map((x) => [x]));

export const matMul = (a: Mat, b: Mat): Mat =>
  a.map((row) => b[0].map((_, j) => row.reduce((s, x, k) => s + x * b[k][j], 0)));

export const identity = (n: number): Mat => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

export const eqMat = (a: Mat, b: Mat, tol = 1e-9) =>
  a.length === b.length && a.every((r, i) => r.length === b[i].length && r.every((x, j) => Math.abs(x - b[i][j]) <= tol));

/** 整数行列で行列式 ±1 のもの（基本変形を積み重ねて作る） */
export function unimodular2(rng: Rng, maxEntry = 4): Mat {
  for (;;) {
    let m = identity(2);
    const steps = rng.int(2, 3);
    for (let s = 0; s < steps; s++) {
      const k = rng.nonzero(-2, 2);
      const e = s % 2 === 0 ? [[1, k], [0, 1]] : [[1, 0], [k, 1]];
      m = matMul(m, e);
    }
    if (rng.next() < 0.5) m = matMul(m, [[0, 1], [1, 0]]);
    if (m.flat().every((x) => Math.abs(x) <= maxEntry)) return m;
  }
}

export const det2 = (m: Mat) => m[0][0] * m[1][1] - m[0][1] * m[1][0];

/** 有理数の厳密計算（小さい整数の範囲で使う） */
export const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};

export class Frac {
  readonly n: number;
  readonly d: number;
  constructor(n: number, d = 1) {
    if (d === 0) throw new Error('division by zero');
    const g = gcd(n, d) || 1;
    const s = d < 0 ? -1 : 1;
    this.n = (s * n) / g;
    this.d = (s * d) / g;
  }
  add(o: Frac) {
    return new Frac(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Frac) {
    return new Frac(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Frac) {
    return new Frac(this.n * o.n, this.d * o.d);
  }
  div(o: Frac) {
    return new Frac(this.n * o.d, this.d * o.n);
  }
  isZero() {
    return this.n === 0;
  }
}

/** 有理数でのガウスの消去法による階数と行列式 */
export function eliminate(m: Mat): { rank: number; det: Frac } {
  const a = m.map((r) => r.map((x) => new Frac(x)));
  const rows = a.length;
  const cols = a[0].length;
  let rank = 0;
  let det = new Frac(1);
  for (let c = 0; c < cols && rank < rows; c++) {
    const p = a.findIndex((r, i) => i >= rank && !r[c].isZero());
    if (p < 0) {
      det = new Frac(0);
      continue;
    }
    if (p !== rank) {
      [a[p], a[rank]] = [a[rank], a[p]];
      det = det.mul(new Frac(-1));
    }
    det = det.mul(a[rank][c]);
    for (let i = rank + 1; i < rows; i++) {
      const f = a[i][c].div(a[rank][c]);
      for (let j = c; j < cols; j++) a[i][j] = a[i][j].sub(f.mul(a[rank][j]));
    }
    rank++;
  }
  if (rows !== cols || rank < rows) det = new Frac(0);
  return { rank, det };
}

export const round = (x: number, digits: number) => {
  const p = 10 ** digits;
  return Math.round(x * p) / p;
};

export const fmtFrac = (f: Frac) => (f.d === 1 ? `${f.n}` : `${f.n}/${f.d}`);
