// 計算ドリル用の追加ジェネレーター。各 check() は別の方法で答えを計算し直す。
import { phi } from './more';
import { eliminate, gcd, identity, matMul, round, texMat, texVec, unimodular2, det2, type GeneratedProblem, type Generator, type Mat } from './util';

const num = (p: GeneratedProblem) => (p.answer as { value: number }).value;
const tup = (p: GeneratedProblem) => (p.answer as { value: number[] }).value;
const fmt = (x: number, d = 4) => String(round(x, d));
const dot = (u: number[], v: number[]) => u.reduce((s, x, i) => s + x * v[i], 0);
const norm = (u: number[]) => Math.sqrt(dot(u, u));

/** 1次式 a1 x + a2 y + a3 z を見やすく（係数 0 は省略、1 は省略） */
function linTex(coef: number[], vars: string[]): string {
  let s = '';
  coef.forEach((c, i) => {
    if (c === 0) return;
    const abs = Math.abs(c);
    const term = `${abs === 1 ? '' : abs}${vars[i]}`;
    s += s === '' ? (c < 0 ? `-${term}` : term) : c < 0 ? ` - ${term}` : ` + ${term}`;
  });
  return s || '0';
}

// ───────────── 線形代数 ─────────────

const solveSystem: Generator = {
  id: 'la.solve-system',
  generate(rng) {
    for (;;) {
      const A = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => rng.int(-3, 3)));
      const d = eliminate(A).det;
      if (d.isZero() || Math.abs(d.n / d.d) > 30) continue;
      const x = [rng.int(-3, 3), rng.int(-3, 3), rng.int(-3, 3)];
      const b = A.map((row) => dot(row, x));
      const eqs = A.map((row, i) => `${linTex(row, ['x', 'y', 'z'])} &= ${b[i]}`).join(' \\\\ ');
      return {
        prompt: `連立方程式 $$\\begin{aligned} ${eqs} \\end{aligned}$$ の解 $(x, y, z)$ を求めよ。`,
        answer: { type: 'tuple', value: x },
        solution:
          `係数行列の行列式は $${d.n / d.d} \\ne 0$ なので解はただ1つ。拡大係数行列を行基本変形（ガウスの消去法）で階段形にし、後退代入する。\n\n` +
          `解は $(x, y, z) = (${x.join(', ')})$。検算: 各式に代入して右辺と一致することを確かめよう。`,
        data: { A, b },
      };
    }
  },
  check(p) {
    const { A, b } = p.data as { A: Mat; b: number[] };
    const x = tup(p);
    return !eliminate(A).det.isZero() && A.every((row, i) => dot(row, x) === b[i]);
  },
};

const projection: Generator = {
  id: 'la.projection',
  generate(rng) {
    let v: number[];
    do v = [rng.int(-3, 3), rng.int(-3, 3), rng.int(-3, 3)];
    while (dot(v, v) === 0);
    const u = [rng.int(-4, 4), rng.int(-4, 4), rng.int(-4, 4)];
    const c = dot(u, v) / dot(v, v);
    const pr = v.map((x) => x * c);
    return {
      prompt: `$u = ${texVec(u)}$ の $v = ${texVec(v)}$ 方向への正射影 $\\operatorname{proj}_v u$ を求めよ（分数可、成分を順に）。`,
      answer: { type: 'tuple', value: pr, tol: 1e-6 },
      solution:
        `$$\\operatorname{proj}_v u = \\frac{\\langle u, v \\rangle}{\\langle v, v \\rangle} v = \\frac{${dot(u, v)}}{${dot(v, v)}}${texVec(v)}$$\n\n` +
        `$\\approx (${pr.map((x) => fmt(x)).join(', ')})$。$u - \\operatorname{proj}_v u$ は $v$ と直交する（コーシー・シュワルツの証明で使った分解）。`,
      data: { u, v },
    };
  },
  check(p) {
    const { u, v } = p.data as { u: number[]; v: number[] };
    const pr = tup(p);
    const r = u.map((x, i) => x - pr[i]);
    // 残差が v と直交し、射影が v と平行（外積が 0）
    const cross = [pr[1] * v[2] - pr[2] * v[1], pr[2] * v[0] - pr[0] * v[2], pr[0] * v[1] - pr[1] * v[0]];
    return Math.abs(dot(r, v)) < 1e-9 && cross.every((x) => Math.abs(x) < 1e-9);
  },
};

const matrixPower: Generator = {
  id: 'la.matrix-power',
  generate(rng) {
    for (;;) {
      const P = unimodular2(rng, 2);
      const dP = det2(P);
      const Pinv = [
        [P[1][1] * dP, -P[0][1] * dP],
        [-P[1][0] * dP, P[0][0] * dP],
      ];
      const l = [rng.pick([-1, 1, 2, -2]), rng.pick([-1, 1, 2, 3])];
      if (l[0] === l[1]) continue; // 固有値が等しいと A がスカラー行列になり自明
      const k = rng.int(3, 6);
      const A = matMul(matMul(P, [[l[0], 0], [0, l[1]]]), Pinv);
      const Ak = matMul(matMul(P, [[l[0] ** k, 0], [0, l[1] ** k]]), Pinv);
      if (A.flat().some((x) => Math.abs(x) > 12) || Ak.flat().some((x) => Math.abs(x) > 400)) continue;
      return {
        prompt: `$A = ${texMat(A)}$ のとき $A^{${k}}$ を求めよ。（ヒント: 固有値で対角化する）`,
        answer: { type: 'matrix', value: Ak },
        solution:
          `$A = PDP^{-1}$, $P = ${texMat(P)}$, $D = ${texMat([[l[0], 0], [0, l[1]]])}$ と対角化できる（$P$ の列が固有ベクトル）。\n\n` +
          `$A^{${k}} = PD^{${k}}P^{-1}$ で、$D^{${k}} = ${texMat([[l[0] ** k, 0], [0, l[1] ** k]])}$。\n\n$$A^{${k}} = ${texMat(Ak)}$$\n\n` +
          `$k$ が大きくても対角成分のべきを計算するだけで済む。漸化式やマルコフ連鎖の長期的な振る舞いはこれで分かる。`,
        data: { A, k },
      };
    }
  },
  check(p) {
    const { A, k } = p.data as { A: Mat; k: number };
    let M = identity(2);
    for (let i = 0; i < k; i++) M = matMul(M, A);
    const v = (p.answer as { value: number[][] }).value;
    return M.every((r, i) => r.every((x, j) => x === v[i][j]));
  },
};

const nullity: Generator = {
  id: 'la.nullity',
  generate(rng) {
    const r = rng.int(1, 3);
    const base = Array.from({ length: r }, () => Array.from({ length: 5 }, () => rng.int(-2, 2)));
    const rows = [...base];
    while (rows.length < 3) {
      const c = base.map(() => rng.int(-1, 1));
      rows.push([0, 1, 2, 3, 4].map((j) => base.reduce((s, row, i) => s + c[i] * row[j], 0)));
    }
    const A = rng.shuffle(rows);
    const rank = eliminate(A).rank;
    return {
      prompt: `$A = ${texMat(A)}$ について、$Ax = 0$ の解空間（核）の次元 $\\dim\\operatorname{null}A$ を求めよ。`,
      answer: { type: 'numeric', value: 5 - rank },
      solution:
        `行基本変形で階段形にすると $\\operatorname{rank}A = ${rank}$。次元定理より\n\n$$\\dim\\operatorname{null}A = (\\text{列の数}) - \\operatorname{rank}A = 5 - ${rank} = ${5 - rank}$$\n\n` +
        `これは連立方程式の解に含まれる自由なパラメータの個数。`,
      data: { A },
    };
  },
  check(p) {
    const { A } = p.data as { A: Mat };
    const At = A[0].map((_, j) => A.map((row) => row[j])); // 転置の階数で計算し直す
    return 5 - eliminate(At).rank === num(p);
  },
};

const cosAngle: Generator = {
  id: 'la.cos-angle',
  generate(rng) {
    let u: number[], v: number[];
    do {
      u = [rng.int(-3, 3), rng.int(-3, 3), rng.int(-3, 3)];
      v = [rng.int(-3, 3), rng.int(-3, 3), rng.int(-3, 3)];
    } while (dot(u, u) === 0 || dot(v, v) === 0);
    const c = dot(u, v) / (norm(u) * norm(v));
    return {
      prompt: `$u = ${texVec(u)}$, $v = ${texVec(v)}$ のなす角 $\\theta$ について $\\cos\\theta$ を求めよ（誤差 0.001 まで）。`,
      answer: { type: 'numeric', value: c, tol: 1e-3 },
      solution:
        `$$\\cos\\theta = \\frac{\\langle u, v\\rangle}{\\|u\\|\\|v\\|} = \\frac{${dot(u, v)}}{\\sqrt{${dot(u, u)}}\\sqrt{${dot(v, v)}}} \\approx ${fmt(c)}$$\n\n` +
        `コーシー・シュワルツの不等式があるので、右辺は必ず $[-1, 1]$ に入り、角度として定義できる。機械学習の「コサイン類似度」と同じ式。`,
      data: { u, v },
    };
  },
  check(p) {
    const { u, v } = p.data as { u: number[]; v: number[] };
    const w = u.map((x, i) => x - v[i]);
    // 余弦定理 |u - v|² = |u|² + |v|² - 2|u||v|cosθ から計算し直す
    const c = (dot(u, u) + dot(v, v) - dot(w, w)) / (2 * norm(u) * norm(v));
    return Math.abs(c - num(p)) < 1e-9;
  },
};

// ───────────── 確率論 ─────────────

const meanVar: Generator = {
  id: 'prob.mean-var',
  generate(rng) {
    const k = rng.int(3, 4);
    const xs = rng.shuffle([-2, -1, 0, 1, 2, 3, 4, 5]).slice(0, k).sort((a, b) => a - b);
    // 確率は 0.1 刻み
    let ws: number[];
    do ws = xs.map(() => rng.int(1, 5));
    while (ws.reduce((s, w) => s + w, 0) !== 10);
    const ps = ws.map((w) => w / 10);
    const mu = dot(xs, ps);
    const v = xs.reduce((s, x, i) => s + ps[i] * (x - mu) ** 2, 0);
    const table = `\\begin{array}{c|${'c'.repeat(k)}} x & ${xs.join(' & ')} \\\\ \\hline P(X = x) & ${ps.join(' & ')} \\end{array}`;
    return {
      prompt: `確率変数 $X$ の分布が $$${table}$$ のとき、$(E[X], \\operatorname{Var}(X))$ を求めよ。`,
      answer: { type: 'tuple', value: [mu, v], tol: 1e-6 },
      solution:
        `$E[X] = \\sum x P(X = x) = ${fmt(mu)}$。$E[X^2] = ${fmt(dot(xs.map((x) => x * x), ps))}$ なので\n\n` +
        `$$\\operatorname{Var}(X) = E[X^2] - (E[X])^2 = ${fmt(dot(xs.map((x) => x * x), ps))} - ${fmt(mu)}^2 = ${fmt(v)}$$`,
      data: { xs, ps },
    };
  },
  check(p) {
    const { xs, ps } = p.data as { xs: number[]; ps: number[] };
    const mu = dot(xs, ps);
    const v2 = dot(xs.map((x) => x * x), ps) - mu * mu;
    const [m, v] = tup(p);
    return Math.abs(m - mu) < 1e-12 && Math.abs(v - v2) < 1e-9 && Math.abs(ps.reduce((s, q) => s + q, 0) - 1) < 1e-12;
  },
};

const geometric: Generator = {
  id: 'prob.geometric',
  generate(rng) {
    const den = rng.pick([2, 3, 4, 5, 6]);
    const pv = 1 / den;
    const k = rng.int(1, 5);
    const askMean = rng.next() < 0.3;
    const v = askMean ? den : (1 - pv) ** (k - 1) * pv;
    return {
      prompt: askMean
        ? `成功確率 $1/${den}$ の独立な試行を、初めて成功するまで繰り返す。必要な試行回数の期待値を求めよ。`
        : `成功確率 $1/${den}$ の独立な試行を繰り返すとき、**初めて**成功するのがちょうど $${k}$ 回目である確率を求めよ（分数可、誤差 0.0001 まで）。`,
      answer: { type: 'numeric', value: v, tol: 1e-4 },
      solution: askMean
        ? `試行回数 $X$ は幾何分布に従い $E[X] = 1/p = ${den}$。導き方: 1回目で成功しなければ「最初からやり直し」なので $E[X] = 1 + (1 - p)E[X]$、これを解く。`
        : `最初の $${k - 1}$ 回が失敗し $${k}$ 回目が成功する確率なので $$(1 - p)^{${k - 1}}p = \\left(\\tfrac{${den - 1}}{${den}}\\right)^{${k - 1}}\\cdot\\tfrac{1}{${den}} \\approx ${fmt(v, 5)}$$`,
      data: { pv, k, askMean },
    };
  },
  check(p) {
    const { pv, k, askMean } = p.data;
    if (askMean) {
      let e = 0;
      for (let j = 1; j < 2000; j++) e += j * (1 - pv) ** (j - 1) * pv; // 級数で計算し直す
      return Math.abs(e - num(p)) < 1e-6;
    }
    const alt = (1 - pv) ** (k - 1) - (1 - pv) ** k; // P(X > k-1) - P(X > k)
    return Math.abs(alt - num(p)) < 1e-12;
  },
};

const choose = (n: number, k: number) => {
  if (k < 0 || k > n) return 0;
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
  return Math.round(c);
};

const hypergeom: Generator = {
  id: 'prob.hypergeom',
  generate(rng) {
    const r = rng.int(2, 5);
    const w = rng.int(2, 5);
    const n = rng.int(2, Math.min(4, r + w - 1));
    const k = rng.int(Math.max(0, n - w), Math.min(n, r));
    const v = (choose(r, k) * choose(w, n - k)) / choose(r + w, n);
    return {
      prompt: `赤玉 $${r}$ 個と白玉 $${w}$ 個が入った袋から、同時に $${n}$ 個取り出す。赤玉がちょうど $${k}$ 個である確率を求めよ（分数可、誤差 0.0001 まで）。`,
      answer: { type: 'numeric', value: v, tol: 1e-4 },
      solution:
        `取り出し方は全部で $\\binom{${r + w}}{${n}} = ${choose(r + w, n)}$ 通りで、どれも同様に確からしい。赤 $${k}$ 個・白 $${n - k}$ 個の選び方は $\\binom{${r}}{${k}}\\binom{${w}}{${n - k}} = ${choose(r, k) * choose(w, n - k)}$ 通り。\n\n` +
        `$$P = \\frac{${choose(r, k) * choose(w, n - k)}}{${choose(r + w, n)}} \\approx ${fmt(v, 5)}$$（超幾何分布。戻さずに取り出すので二項分布とは違う。）`,
      data: { r, w, n, k },
    };
  },
  check(p) {
    const { r, w, n, k } = p.data;
    // 玉に番号を付けて、すべての部分集合を数え上げる
    const N = r + w;
    let total = 0;
    let hit = 0;
    for (let mask = 0; mask < 1 << N; mask++) {
      let cnt = 0;
      let red = 0;
      for (let i = 0; i < N; i++)
        if (mask & (1 << i)) {
          cnt++;
          if (i < r) red++;
        }
      if (cnt !== n) continue;
      total++;
      if (red === k) hit++;
    }
    return Math.abs(hit / total - num(p)) < 1e-12;
  },
};

const poisson: Generator = {
  id: 'prob.poisson',
  generate(rng) {
    const lam = rng.pick([0.5, 1, 2, 3, 4]);
    const k = rng.int(0, 5);
    let fact = 1;
    for (let i = 2; i <= k; i++) fact *= i;
    const v = (Math.exp(-lam) * lam ** k) / fact;
    return {
      prompt: `1時間に平均 $${lam}$ 件の問い合わせが（ポアソン分布に従って）来る。ある1時間にちょうど $${k}$ 件来る確率を求めよ（誤差 0.0001 まで）。`,
      answer: { type: 'numeric', value: v, tol: 1e-4 },
      solution:
        `$$P(X = ${k}) = \\frac{e^{-\\lambda}\\lambda^{${k}}}{${k}!} = \\frac{e^{-${lam}} \\cdot ${lam}^{${k}}}{${fact}} \\approx ${fmt(v, 5)}$$\n\n` +
        `ポアソン分布は「試行回数 $n$ が大きく、1回あたりの確率 $p$ が小さい二項分布」の極限（$np = \\lambda$）。サーバーへのアクセス数や故障件数のモデル。`,
      data: { lam, k },
    };
  },
  check(p) {
    const { lam, k } = p.data;
    const n = 1e6;
    const q = lam / n;
    let c = 1;
    for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
    const binom = c * q ** k * (1 - q) ** (n - k); // 二項分布の極限で計算し直す
    return Math.abs(binom - num(p)) < 1e-5;
  },
};

function simpson(f: (x: number) => number, a: number, b: number, n = 2000): number {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

const normalProb: Generator = {
  id: 'prob.normal',
  generate(rng) {
    const mu = rng.int(40, 70);
    const sigma = rng.pick([2, 4, 5, 10]);
    let z1 = rng.pick([-2, -1.5, -1, -0.5, 0]);
    let z2 = rng.pick([0.5, 1, 1.5, 2, 2.5]);
    if (rng.next() < 0.3) [z1, z2] = [-Infinity, z2];
    const a = mu + z1 * sigma;
    const b = mu + z2 * sigma;
    const v = phi(z2) - (z1 === -Infinity ? 0 : phi(z1));
    const range = z1 === -Infinity ? `X \\le ${b}` : `${a} \\le X \\le ${b}`;
    return {
      prompt:
        `$X \\sim N(${mu}, ${sigma}^2)$ のとき $P(${range})$ を求めよ（誤差 0.002 まで）。` +
        `参考: $\\Phi(0.5) = 0.6915$, $\\Phi(1) = 0.8413$, $\\Phi(1.5) = 0.9332$, $\\Phi(2) = 0.9772$, $\\Phi(2.5) = 0.9938$。`,
      answer: { type: 'numeric', value: v, tol: 2e-3 },
      solution:
        `標準化 $Z = (X - ${mu})/${sigma} \\sim N(0, 1)$ すると ${
          z1 === -Infinity ? `$P(Z \\le ${z2}) = \\Phi(${z2})$` : `$P(${z1} \\le Z \\le ${z2}) = \\Phi(${z2}) - \\Phi(${z1})$`
        }。\n\n` +
        `$\\Phi(-z) = 1 - \\Phi(z)$ を使って表の値から計算すると $\\approx ${fmt(v)}$。` +
        `（$\\mu \\pm \\sigma$ に約 68%、$\\mu \\pm 2\\sigma$ に約 95% が入る。）`,
      data: { z1, z2 },
    };
  },
  check(p) {
    const { z1, z2 } = p.data;
    const pdf = (x: number) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
    const lo = z1 === -Infinity ? -12 : z1;
    return Math.abs(simpson(pdf, lo, z2, 4000) - num(p)) < 1e-5;
  },
};

const markov2: Generator = {
  id: 'prob.markov2',
  generate(rng) {
    const a = rng.pick([0.1, 0.2, 0.3, 0.4, 0.5]);
    const b = rng.pick([0.1, 0.2, 0.3, 0.4, 0.6]);
    const pi = [b / (a + b), a / (a + b)];
    const P = [
      [round(1 - a, 2), a],
      [b, round(1 - b, 2)],
    ];
    return {
      prompt:
        `状態 1（正常）と状態 2（故障）を行き来するマルコフ連鎖の推移確率行列が $P = ${texMat(P)}$（$P_{ij}$ は $i$ から $j$ へ移る確率）のとき、定常分布 $(\\pi_1, \\pi_2)$ を求めよ（分数可）。`,
      answer: { type: 'tuple', value: pi, tol: 1e-6 },
      solution:
        `定常分布は $\\pi P = \\pi$, $\\pi_1 + \\pi_2 = 1$ を満たす。1行目から $\\pi_1 \\cdot ${a} = \\pi_2 \\cdot ${b}$（出ていく量 = 入ってくる量）。\n\n` +
        `よって $\\pi = \\left(\\frac{${b}}{${round(a + b, 2)}}, \\frac{${a}}{${round(a + b, 2)}}\\right) \\approx (${fmt(pi[0])}, ${fmt(pi[1])})$。\n\n` +
        `$\\pi$ は $P^\\top$ の固有値 $1$ の固有ベクトル。長い時間がたつと、どこから始めてもこの割合に近づく（稼働率の計算）。`,
      data: { a, b },
    };
  },
  check(p) {
    const { a, b } = p.data;
    let x = [1, 0]; // べき乗法で計算し直す
    for (let t = 0; t < 5000; t++) x = [x[0] * (1 - a) + x[1] * b, x[0] * a + x[1] * (1 - b)];
    const v = tup(p);
    return Math.abs(x[0] - v[0]) < 1e-9 && Math.abs(x[1] - v[1]) < 1e-9;
  },
};

// ───────────── 統計学 ─────────────

const sampleStats = (xs: number[]) => {
  const n = xs.length;
  const m = xs.reduce((s, x) => s + x, 0) / n;
  const s2 = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1);
  return { n, m, s2 };
};

const meanVarData: Generator = {
  id: 'stat.mean-var',
  generate(rng) {
    let xs: number[];
    do xs = Array.from({ length: rng.int(4, 6) }, () => rng.int(1, 12));
    while (new Set(xs).size === 1);
    const { n, m, s2 } = sampleStats(xs);
    return {
      prompt: `データ ${xs.join(', ')} の標本平均 $\\bar{x}$ と不偏分散 $s^2 = \\frac{1}{n-1}\\sum(x_i - \\bar{x})^2$ を $(\\bar{x}, s^2)$ の順に求めよ（分数可）。`,
      answer: { type: 'tuple', value: [m, s2], tol: 1e-6 },
      solution:
        `$\\bar{x} = ${xs.reduce((s, x) => s + x, 0)}/${n} = ${fmt(m)}$。偏差の2乗和は $${fmt(xs.reduce((s, x) => s + (x - m) ** 2, 0))}$ なので $s^2 = ${fmt(xs.reduce((s, x) => s + (x - m) ** 2, 0))}/${n - 1} \\approx ${fmt(s2)}$。\n\n` +
        `手計算では $\\sum x_i^2 - n\\bar{x}^2$ を使うと楽（ただし数値計算では桁落ちしやすいので、プログラムでは偏差から計算するか Welford の方法を使う）。`,
      data: { xs },
    };
  },
  check(p) {
    const xs = p.data.xs as number[];
    const n = xs.length;
    const sx = xs.reduce((s, x) => s + x, 0);
    const sxx = xs.reduce((s, x) => s + x * x, 0);
    const [m, s2] = tup(p);
    return Math.abs(m - sx / n) < 1e-12 && Math.abs(s2 - (sxx - (sx * sx) / n) / (n - 1)) < 1e-9;
  },
};

const sampleSize: Generator = {
  id: 'stat.sample-size',
  generate(rng) {
    const sigma = rng.int(2, 20);
    const E = rng.pick([0.5, 1, 1.5, 2, 3]);
    const n = Math.ceil(((1.96 * sigma) / E) ** 2 - 1e-12);
    return {
      prompt: `母標準偏差 $\\sigma = ${sigma}$ の母集団の平均を、95% 信頼区間の半分の幅（誤差の幅）が $${E}$ 以下になるように推定したい。必要な標本の大きさ $n$ の最小値を求めよ。`,
      answer: { type: 'numeric', value: n },
      solution:
        `誤差の幅は $1.96\\,\\sigma/\\sqrt{n}$。$1.96 \\cdot ${sigma}/\\sqrt{n} \\le ${E}$ を解くと $$n \\ge \\left(\\frac{1.96 \\cdot ${sigma}}{${E}}\\right)^2 \\approx ${fmt(((1.96 * sigma) / E) ** 2, 2)}$$\n\n` +
        `よって $n = ${n}$。精度を2倍にするには $n$ を4倍にする必要がある。`,
      data: { sigma, E },
    };
  },
  check(p) {
    const { sigma, E } = p.data;
    const n = num(p);
    return (1.96 * sigma) / Math.sqrt(n) <= E + 1e-12 && (n === 1 || (1.96 * sigma) / Math.sqrt(n - 1) > E);
  },
};

const tStat: Generator = {
  id: 'stat.t-stat',
  generate(rng) {
    let xs: number[];
    do xs = Array.from({ length: rng.int(5, 8) }, () => rng.int(10, 30));
    while (new Set(xs).size === 1);
    const { n, m, s2 } = sampleStats(xs);
    const mu0 = Math.round(m + rng.pick([-3, -2, -1, 1, 2, 3]));
    const t = (m - mu0) / Math.sqrt(s2 / n);
    return {
      prompt: `データ ${xs.join(', ')} から、$H_0: \\mu = ${mu0}$ の1標本 t 検定の統計量 $t = \\dfrac{\\bar{x} - \\mu_0}{s/\\sqrt{n}}$ を求めよ（誤差 0.01 まで）。`,
      answer: { type: 'numeric', value: t, tol: 1e-2 },
      solution:
        `$n = ${n}$, $\\bar{x} = ${fmt(m)}$, $s^2 = ${fmt(s2)}$（$n - 1$ で割る）より $s/\\sqrt{n} \\approx ${fmt(Math.sqrt(s2 / n))}$。\n\n` +
        `$$t = \\frac{${fmt(m)} - ${mu0}}{${fmt(Math.sqrt(s2 / n))}} \\approx ${fmt(t, 3)}$$\n\n` +
        `$H_0$ のもとで自由度 $${n - 1}$ の t 分布に従う。両側 5% の棄却点は $n$ が小さいと $2$ より大きい（自由度 $${n - 1}$ なら約 ${{ 4: '2.78', 5: '2.57', 6: '2.45', 7: '2.36' }[n - 1]}）。`,
      data: { xs, mu0 },
    };
  },
  check(p) {
    const { xs, mu0 } = p.data as { xs: number[]; mu0: number };
    const n = xs.length;
    const sx = xs.reduce((s, x) => s + x, 0);
    const sxx = xs.reduce((s, x) => s + x * x, 0);
    const s2 = (sxx - (sx * sx) / n) / (n - 1);
    return Math.abs((sx / n - mu0) / Math.sqrt(s2 / n) - num(p)) < 1e-9;
  },
};

// ───────────── 抽象代数学 ─────────────

const gcdGen: Generator = {
  id: 'alg.gcd',
  generate(rng) {
    const g = rng.pick([1, 2, 3, 6, 7, 12, 14, 18, 21, 24]);
    let a: number, b: number;
    do {
      a = g * rng.int(5, 60);
      b = g * rng.int(5, 60);
    } while (a === b);
    const steps: string[] = [];
    let [x, y] = [Math.max(a, b), Math.min(a, b)];
    while (y) {
      steps.push(`$${x} = ${Math.floor(x / y)} \\cdot ${y} + ${x % y}$`);
      [x, y] = [y, x % y];
    }
    return {
      prompt: `$\\gcd(${a}, ${b})$ をユークリッドの互除法で求めよ。`,
      answer: { type: 'numeric', value: x },
      solution: `${steps.join('\n\n')}\n\n余りが $0$ になる直前の割る数 $${x}$ が最大公約数。$\\gcd(a, b) = \\gcd(b, a \\bmod b)$ を繰り返す。回数は $O(\\log \\min(a, b))$。`,
      data: { a, b },
    };
  },
  check(p) {
    const { a, b } = p.data;
    let best = 1;
    for (let d = 1; d <= Math.min(a, b); d++) if (a % d === 0 && b % d === 0) best = d;
    return best === num(p);
  },
};

function factorize(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let p = 2; p * p <= n; p++) {
    let e = 0;
    while (n % p === 0) {
      n /= p;
      e++;
    }
    if (e) out.push([p, e]);
  }
  if (n > 1) out.push([n, 1]);
  return out;
}

const eulerPhi: Generator = {
  id: 'alg.euler-phi',
  generate(rng) {
    const n = rng.int(12, 300);
    const f = factorize(n);
    const v = f.reduce((s, [p, e]) => s * p ** (e - 1) * (p - 1), 1);
    const fTex = f.map(([p, e]) => (e > 1 ? `${p}^{${e}}` : `${p}`)).join(' \\cdot ');
    return {
      prompt: `オイラーの関数 $\\varphi(${n})$（$1$ 以上 $${n}$ 以下で $${n}$ と互いに素な整数の個数）を求めよ。`,
      answer: { type: 'numeric', value: v },
      solution:
        `$${n} = ${fTex}$ と素因数分解すると、$\\varphi(n) = n\\prod_{p \\mid n}\\left(1 - \\frac1p\\right)$ より\n\n` +
        `$$\\varphi(${n}) = ${f.map(([p, e]) => (e > 1 ? `${p}^{${e - 1}}(${p} - 1)` : `(${p} - 1)`)).join(' \\cdot ')} = ${v}$$\n\n` +
        `（中国剰余定理から、互いに素な $m, n$ で $\\varphi(mn) = \\varphi(m)\\varphi(n)$ が成り立つことを使っている。）`,
      data: { n },
    };
  },
  check(p) {
    const { n } = p.data;
    let c = 0;
    for (let k = 1; k <= n; k++) if (gcd(k, n) === 1) c++;
    return c === num(p);
  },
};

const rsaKey: Generator = {
  id: 'alg.rsa-key',
  generate(rng) {
    const primes = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
    let p: number, q: number, e: number, ph: number;
    do {
      p = rng.pick(primes);
      q = rng.pick(primes);
      ph = (p - 1) * (q - 1);
      e = rng.pick([3, 5, 7, 11, 13, 17]);
    } while (p === q || gcd(e, ph) !== 1);
    let d = 1;
    while ((e * d) % ph !== 1) d++;
    return {
      prompt: `RSA で $p = ${p}$, $q = ${q}$, 公開指数 $e = ${e}$ とする。秘密指数 $d$（$ed \\equiv 1 \\pmod{\\varphi(n)}$, $0 < d < \\varphi(n)$）を求めよ。`,
      answer: { type: 'numeric', value: d },
      solution:
        `$n = ${p * q}$, $\\varphi(n) = (p - 1)(q - 1) = ${ph}$。拡張ユークリッドの互除法で $${e}d \\equiv 1 \\pmod{${ph}}$ を解くと $d = ${d}$。\n\n` +
        `検算: $${e} \\cdot ${d} = ${e * d} = ${Math.floor((e * d) / ph)} \\cdot ${ph} + 1$。$p, q$ を知らない人は $\\varphi(n)$ が計算できないので $d$ も求められない。`,
      data: { p, q, e },
    };
  },
  check(pr) {
    const { p, q, e } = pr.data;
    const n = BigInt(p * q);
    const d = BigInt(num(pr));
    // 実際に暗号化・復号して元に戻ることを確かめる
    const pow = (b: bigint, x: bigint) => {
      let r = 1n;
      for (b %= n; x > 0n; x >>= 1n, b = (b * b) % n) if (x & 1n) r = (r * b) % n;
      return r;
    };
    for (let m = 2n; m < 30n; m++) if (pow(pow(m, BigInt(e)), d) !== m) return false;
    return num(pr) > 0 && num(pr) < (p - 1) * (q - 1);
  },
};

const cyclicOrder: Generator = {
  id: 'alg.cyclic-order',
  generate(rng) {
    const n = rng.pick([12, 15, 18, 20, 24, 30, 36, 40, 42]);
    const k = rng.int(1, n - 1);
    const o = n / gcd(n, k);
    return {
      prompt: `加法群 $\\mathbb{Z}/${n}\\mathbb{Z}$ において、元 $${k}$ の位数（$${k}$ が生成する部分群の大きさ）を求めよ。`,
      answer: { type: 'numeric', value: o },
      solution:
        `$${k}$ を $m$ 回足して初めて $0$（$\\bmod ${n}$）になる $m$ が位数。$mk$ が $${n}$ の倍数になる最小の $m$ なので\n\n` +
        `$$\\frac{n}{\\gcd(n, k)} = \\frac{${n}}{${gcd(n, k)}} = ${o}$$\n\n生成する部分群は $\\{0, ${gcd(n, k)}, ${2 * gcd(n, k)}, \\dots\\}$。`,
      data: { n, k },
    };
  },
  check(p) {
    const { n, k } = p.data;
    let m = 1;
    while ((m * k) % n !== 0) m++;
    return m === num(p);
  },
};

const permSign: Generator = {
  id: 'alg.perm-sign',
  generate(rng) {
    const n = rng.int(5, 7);
    const perm = rng.shuffle(Array.from({ length: n }, (_, i) => i));
    const seen = new Array(n).fill(false);
    const lens: number[] = [];
    for (let i = 0; i < n; i++) {
      if (seen[i]) continue;
      let l = 0;
      for (let j = i; !seen[j]; j = perm[j]) {
        seen[j] = true;
        l++;
      }
      lens.push(l);
    }
    const sign = lens.reduce((s, l) => s * (l % 2 === 0 ? -1 : 1), 1);
    const top = Array.from({ length: n }, (_, i) => i + 1);
    return {
      prompt: `置換 $\\sigma = ${texMat([top, perm.map((x) => x + 1)])}$ の符号 $\\operatorname{sgn}\\sigma$（$1$ か $-1$）を求めよ。`,
      answer: { type: 'numeric', value: sign },
      solution:
        `巡回置換に分解すると長さは ${lens.join(', ')}。長さ $\\ell$ の巡回置換は $\\ell - 1$ 個の互換の積なので、符号は $\\prod(-1)^{\\ell - 1} = ${sign}$。\n\n` +
        `別解: 転倒数（$i < j$ かつ $\\sigma(i) > \\sigma(j)$ となる組の数）の偶奇でも求まる。`,
      data: { perm },
    };
  },
  check(p) {
    const perm = p.data.perm as number[];
    let inv = 0;
    for (let i = 0; i < perm.length; i++) for (let j = i + 1; j < perm.length; j++) if (perm[i] > perm[j]) inv++;
    return (inv % 2 === 0 ? 1 : -1) === num(p);
  },
};

// ───────────── 凸解析・最適化 ─────────────

const convexCheck: Generator = {
  id: 'cvx.convexity-check',
  generate(rng) {
    const a = rng.int(-2, 4);
    const b = rng.int(-5, 5);
    const c = rng.int(-2, 4);
    const convex = a >= 0 && c >= 0 && 4 * a * c - b * b >= 0;
    const f = linTex([a, b, c], ['x^2', 'xy', 'y^2']);
    return {
      prompt: `$f(x, y) = ${f}$ は $\\mathbb{R}^2$ 上の凸関数か？`,
      answer: { type: 'choice', choices: ['凸である', '凸でない'], value: convex ? 0 : 1 },
      solution:
        `ヘッセ行列は $H = ${texMat([[2 * a, b], [b, 2 * c]])}$（定数）。$f$ が凸 $\\iff H \\succeq 0$（半正定値）。\n\n` +
        `$2 \\times 2$ の対称行列が半正定値 $\\iff$ 対角成分がともに $\\ge 0$ かつ $\\det H \\ge 0$。ここで対角成分は $${2 * a}, ${2 * c}$、$\\det H = ${4 * a * c - b * b}$ なので、` +
        (convex ? `凸である。` : `凸でない（ある方向に沿って下に凸でない）。`),
      data: { a, b, c },
    };
  },
  check(p, rng) {
    const { a, b, c } = p.data;
    const f = (x: number, y: number) => a * x * x + b * x * y + c * y * y;
    // 中点凸性をランダムな2点で調べ、反例が見つかるかどうかで判定し直す
    let violated = false;
    for (let k = 0; k < 4000 && !violated; k++) {
      const x1 = (rng.next() - 0.5) * 10;
      const y1 = (rng.next() - 0.5) * 10;
      const x2 = (rng.next() - 0.5) * 10;
      const y2 = (rng.next() - 0.5) * 10;
      if (f((x1 + x2) / 2, (y1 + y2) / 2) > (f(x1, y1) + f(x2, y2)) / 2 + 1e-9) violated = true;
    }
    const claimedConvex = (p.answer as { value: number }).value === 0;
    return claimedConvex === !violated;
  },
};

const kkt1d: Generator = {
  id: 'cvx.kkt-1d',
  generate(rng) {
    const a = rng.int(-5, 8);
    const b = rng.int(-3, 5);
    const x = Math.min(a, b);
    const lam = Math.max(0, 2 * (a - b));
    return {
      prompt: `$\\min_x (x ${a >= 0 ? '-' : '+'} ${Math.abs(a)})^2$ s.t. $x \\le ${b}$ の最適解 $x^*$ と、KKT 条件のラグランジュ乗数 $\\lambda^* \\ge 0$ を $(x^*, \\lambda^*)$ の順に求めよ。`,
      answer: { type: 'tuple', value: [x, lam] },
      solution:
        `$L = (x - ${a})^2 + \\lambda(x - ${b})$。KKT 条件: 停留性 $2(x - ${a}) + \\lambda = 0$、$\\lambda \\ge 0$、$x \\le ${b}$、相補性 $\\lambda(x - ${b}) = 0$。\n\n` +
        (a <= b
          ? `制約のない最小点 $x = ${a}$ が $x \\le ${b}$ を満たすので制約は効いておらず $\\lambda^* = 0$。よって $(${x}, 0)$。`
          : `制約のない最小点 $${a}$ は実行不可能なので、制約が効いて $x^* = ${b}$。停留性から $\\lambda^* = -2(${b} - ${a}) = ${lam}$。`) +
        `\n\n$\\lambda^*$ は「制約を $1$ だけ緩めたときに最適値がどれだけ下がるか」を表す。`,
      data: { a, b },
    };
  },
  check(p) {
    const { a, b } = p.data;
    const [x, lam] = tup(p);
    const stat = Math.abs(2 * (x - a) + lam) < 1e-12;
    const feas = x <= b + 1e-12 && lam >= 0;
    const comp = Math.abs(lam * (x - b)) < 1e-12;
    // 格子上の全探索でも最小であることを確かめる
    let best = Infinity;
    for (let t = -20; t <= b; t += 0.01) best = Math.min(best, (t - a) ** 2);
    return stat && feas && comp && (x - a) ** 2 <= best + 1e-9;
  },
};

const conditionNumber: Generator = {
  id: 'cvx.condition-number',
  generate(rng) {
    const a = rng.int(3, 10);
    const b = rng.int(-(a - 1), a - 1);
    const lmax = a + Math.abs(b);
    const lmin = a - Math.abs(b);
    const kappa = lmax / lmin;
    return {
      prompt: `$f(x) = \\tfrac12 x^\\top A x$, $A = ${texMat([[a, b], [b, a]])}$ について、$L$-平滑性の定数 $L$、強凸性の定数 $\\mu$、条件数 $\\kappa = L/\\mu$ を $(L, \\mu, \\kappa)$ の順に求めよ（分数可）。`,
      answer: { type: 'tuple', value: [lmax, lmin, kappa], tol: 1e-6 },
      solution:
        `$\\nabla^2 f = A$ なので $L = \\lambda_{\\max}(A)$, $\\mu = \\lambda_{\\min}(A)$。$A$ の固有値は $${a} \\pm ${Math.abs(b)}$（固有ベクトル $(1, 1)$, $(1, -1)$）。\n\n` +
        `よって $L = ${lmax}$, $\\mu = ${lmin}$, $\\kappa = ${lmax}/${lmin} \\approx ${fmt(kappa)}$。\n\n` +
        `ステップ幅 $1/L$ の勾配法は誤差を毎回 $(1 - 1/\\kappa)$ 倍程度にしか減らさないので、$\\kappa$ が大きい（等高線が細長い）ほど遅い。`,
      data: { a, b },
    };
  },
  check(p) {
    const { a, b } = p.data;
    // 2次方程式 λ² - 2aλ + (a² - b²) = 0 を解いて計算し直す
    const tr = 2 * a;
    const det = a * a - b * b;
    const disc = Math.sqrt(tr * tr - 4 * det);
    const l1 = (tr + disc) / 2;
    const l2 = (tr - disc) / 2;
    const [L, mu, k] = tup(p);
    return Math.abs(L - l1) < 1e-9 && Math.abs(mu - l2) < 1e-9 && Math.abs(k - l1 / l2) < 1e-9;
  },
};

const gdIterates: Generator = {
  id: 'cvx.gd-iterates',
  generate(rng) {
    const a = rng.int(1, 6);
    const eta = rng.pick([0.1, 0.2, 0.25, 0.5]);
    const x0 = rng.pick([-8, -4, 4, 8, 16]);
    const k = rng.int(2, 4);
    const r = 1 - eta * a;
    const xk = r ** k * x0;
    return {
      prompt: `$f(x) = \\frac{${a}}{2}x^2$ に、ステップ幅 $\\eta = ${eta}$ の勾配降下法を $x_0 = ${x0}$ から $${k}$ 回適用したときの $x_{${k}}$ を求めよ（分数可）。収束するかどうかも考えよ。`,
      answer: { type: 'numeric', value: xk, tol: 1e-6 },
      solution:
        `$f'(x) = ${a}x$ なので $x_{t+1} = x_t - ${eta} \\cdot ${a}x_t = (1 - ${round(eta * a, 4)})x_t = ${round(r, 4)}\\,x_t$。\n\n` +
        `よって $x_{${k}} = (${round(r, 4)})^{${k}} \\cdot ${x0} = ${fmt(xk, 6)}$。\n\n` +
        (Math.abs(r) < 1
          ? `$|1 - \\eta a| = ${fmt(Math.abs(r))} < 1$ なので $0$ に収束する${r < 0 ? '（符号を変えながら振動して）' : ''}。`
          : Math.abs(r) === 1
            ? `$|1 - \\eta a| = 1$ なので収束しない（振動し続ける）。$\\eta < 2/a$ が必要。`
            : `$|1 - \\eta a| > 1$ なので発散する。$\\eta < 2/a$ が必要。`),
      data: { a, eta, x0, k },
    };
  },
  check(p) {
    const { a, eta, x0, k } = p.data;
    let x = x0;
    for (let t = 0; t < k; t++) x -= eta * a * x;
    return Math.abs(x - num(p)) < 1e-9;
  },
};

export const DRILL_GENERATORS: Generator[] = [
  solveSystem,
  projection,
  matrixPower,
  nullity,
  cosAngle,
  meanVar,
  geometric,
  hypergeom,
  poisson,
  normalProb,
  markov2,
  meanVarData,
  sampleSize,
  tStat,
  gcdGen,
  eulerPhi,
  rsaKey,
  cyclicOrder,
  permSign,
  convexCheck,
  kkt1d,
  conditionNumber,
  gdIterates,
];
