import {
  det2,
  eliminate,
  eqMat,
  Frac,
  fmtFrac,
  gcd,
  identity,
  matMul,
  round,
  texMat,
  texVec,
  unimodular2,
  type GeneratedProblem,
  type Generator,
  type Mat,
  Rng,
} from './util';

export { Rng } from './util';
export type { GeneratedProblem, Generator } from './util';

const par = (x: number) => (x < 0 ? `(${x})` : `${x}`);

// ───────────── 線形代数 ─────────────

const matmul: Generator = {
  id: 'la.matmul-2x2',
  generate(rng) {
    const r = () => [rng.int(-3, 3), rng.int(-3, 3)];
    const A = [r(), r()];
    const B = [r(), r()];
    const C = matMul(A, B);
    return {
      prompt: `$A = ${texMat(A)},\\quad B = ${texMat(B)}$ のとき、積 $AB$ を求めよ。`,
      answer: { type: 'matrix', value: C },
      solution:
        `$(AB)_{ij} = \\sum_k A_{ik}B_{kj}$（$A$ の $i$ 行と $B$ の $j$ 列の内積）。\n\n` +
        `例: $(AB)_{11} = ${par(A[0][0])}\\cdot ${par(B[0][0])} + ${par(A[0][1])}\\cdot ${par(B[1][0])} = ${C[0][0]}$\n\n` +
        `$$AB = ${texMat(C)}$$`,
      data: { A, B },
    };
  },
  check(p, rng) {
    const { A, B } = p.data as { A: Mat; B: Mat };
    // (AB)x = A(Bx) をランダムな x で確かめる
    const C = (p.answer as { value: number[][] }).value;
    for (let t = 0; t < 3; t++) {
      const x = [[rng.int(-5, 5)], [rng.int(-5, 5)]];
      if (!eqMat(matMul(C, x), matMul(A, matMul(B, x)))) return false;
    }
    return true;
  },
};

const det3: Generator = {
  id: 'la.det-3x3',
  generate(rng) {
    const A = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => rng.int(-3, 3)));
    const [[a, b, c], [d, e, f], [g, h, i]] = A;
    const m1 = e * i - f * h;
    const m2 = d * i - f * g;
    const m3 = d * h - e * g;
    const det = a * m1 - b * m2 + c * m3;
    return {
      prompt: `$A = ${texMat(A)}$ の行列式 $\\det A$ を求めよ。`,
      answer: { type: 'numeric', value: det },
      solution:
        `1行目で余因子展開する:\n\n` +
        `$$\\det A = ${par(a)}\\cdot(${m1}) - ${par(b)}\\cdot(${m2}) + ${par(c)}\\cdot(${m3}) = ${det}$$\n\n` +
        `括弧の中は 2×2 の小行列式（例: $${par(e)}\\cdot${par(i)} - ${par(f)}\\cdot${par(h)} = ${m1}$）。` +
        `検算には行基本変形で上三角にして対角成分の積をとる方法も使える。`,
      data: { A },
    };
  },
  check(p) {
    const { A } = p.data as { A: Mat };
    const d = eliminate(A).det;
    return d.d === 1 && d.n === (p.answer as { value: number }).value;
  },
};

const inverse2: Generator = {
  id: 'la.inverse-2x2',
  generate(rng) {
    const A = unimodular2(rng, 5);
    const D = det2(A);
    const [[a, b], [c, d]] = A;
    const inv = [
      [D * d, -D * b],
      [-D * c, D * a],
    ].map((r) => r.map((x) => x + 0)); // -0 を 0 に
    return {
      prompt: `$A = ${texMat(A)}$ の逆行列 $A^{-1}$ を求めよ。`,
      answer: { type: 'matrix', value: inv },
      solution:
        `$\\det A = ${par(a)}\\cdot${par(d)} - ${par(b)}\\cdot${par(c)} = ${D}$。\n\n` +
        `2×2 の公式 $\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}^{-1} = \\dfrac{1}{ad-bc}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}$ より\n\n` +
        `$$A^{-1} = ${texMat(inv)}$$\n\n検算: $AA^{-1} = I$ を必ず確かめよう。`,
      data: { A },
    };
  },
  check(p) {
    const { A } = p.data as { A: Mat };
    return eqMat(matMul(A, (p.answer as { value: number[][] }).value), identity(2));
  },
};

const eigen2: Generator = {
  id: 'la.eigen-2x2',
  generate(rng) {
    for (;;) {
      const P = unimodular2(rng, 3);
      const Pinv = [
        [P[1][1], -P[0][1]],
        [-P[1][0], P[0][0]],
      ].map((r) => r.map((x) => x * det2(P)));
      const l1 = rng.int(-5, 5);
      let l2 = rng.int(-5, 5);
      if (l1 === l2) l2 = l1 + rng.pick([1, 2, 3]);
      const A = matMul(matMul(P, [[l1, 0], [0, l2]]), Pinv);
      if (A.flat().some((x) => Math.abs(x) > 20)) continue;
      const tr = A[0][0] + A[1][1];
      const dt = det2(A);
      return {
        prompt: `$A = ${texMat(A)}$ の固有値をすべて求めよ。`,
        answer: { type: 'set', value: [l1, l2] },
        solution:
          `特性多項式は $\\det(\\lambda I - A) = \\lambda^2 - (\\operatorname{tr}A)\\lambda + \\det A$。\n\n` +
          `$\\operatorname{tr}A = ${tr}$, $\\det A = ${dt}$ より $\\lambda^2 ${tr >= 0 ? '-' : '+'} ${Math.abs(tr)}\\lambda ${dt >= 0 ? '+' : '-'} ${Math.abs(dt)} = (\\lambda ${l1 >= 0 ? '-' : '+'} ${Math.abs(l1)})(\\lambda ${l2 >= 0 ? '-' : '+'} ${Math.abs(l2)})$。\n\n` +
          `よって固有値は $${l1},\\ ${l2}$。検算: 和 = トレース、積 = 行列式。`,
        data: { A },
      };
    }
  },
  check(p) {
    const { A } = p.data as { A: Mat };
    const [l1, l2] = (p.answer as { value: number[] }).value;
    return l1 + l2 === A[0][0] + A[1][1] && l1 * l2 === det2(A);
  },
};

/** 余因子展開による整数行列式（検算用） */
function detInt(m: Mat): number {
  if (m.length === 1) return m[0][0];
  return m[0].reduce((s, x, j) => s + (j % 2 ? -1 : 1) * x * detInt(m.slice(1).map((r) => r.filter((_, k) => k !== j))), 0);
}

function combinations(n: number, k: number): number[][] {
  if (k === 0) return [[]];
  const out: number[][] = [];
  for (let i = 0; i < n; i++) for (const rest of combinations(n, k - 1)) if (rest.every((x) => x > i)) out.push([i, ...rest]);
  return out;
}

const rank34: Generator = {
  id: 'la.rank-3x4',
  generate(rng) {
    const r = rng.int(1, 3);
    const base = Array.from({ length: r }, () => Array.from({ length: 4 }, () => rng.int(-2, 2)));
    const rows = [...base];
    while (rows.length < 3) {
      const coef = base.map(() => rng.int(-2, 2));
      rows.push([0, 1, 2, 3].map((j) => base.reduce((s, row, i) => s + coef[i] * row[j], 0)));
    }
    const A = rng.shuffle(rows);
    const rank = eliminate(A).rank;
    return {
      prompt: `$A = ${texMat(A)}$ の階数 $\\operatorname{rank} A$ を求めよ。`,
      answer: { type: 'numeric', value: rank },
      solution:
        `行基本変形で階段形にし、0 でない行の数を数える。階数 = 1次独立な行（列）の最大個数。\n\n` +
        `この行列の階数は $${rank}$。ある行が他の行の組み合わせで書けていないか探してみよう。`,
      data: { A },
    };
  },
  check(p) {
    const { A } = p.data as { A: Mat };
    // 0 でない k 次小行列式が存在する最大の k
    let r = 0;
    for (let k = 1; k <= 3; k++) {
      const ok = combinations(3, k).some((rs) => combinations(4, k).some((cs) => detInt(rs.map((i) => cs.map((j) => A[i][j]))) !== 0));
      if (ok) r = k;
    }
    return r === (p.answer as { value: number }).value;
  },
};

// ───────────── 確率論 ─────────────

const choose = (n: number, k: number) => {
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
  return Math.round(c);
};

const binomial: Generator = {
  id: 'prob.binomial-pmf',
  generate(rng) {
    const n = rng.int(4, 10);
    const p = rng.pick([new Frac(1, 2), new Frac(1, 3), new Frac(1, 4), new Frac(2, 3), new Frac(1, 5)]);
    const k = rng.int(0, n);
    const pv = p.n / p.d;
    const v = choose(n, k) * pv ** k * (1 - pv) ** (n - k);
    return {
      prompt: `成功確率 $p = ${fmtFrac(p)}$ の独立な試行を $n = ${n}$ 回行う。成功回数を $X$ とするとき $P(X = ${k})$ を求めよ（小数、誤差 0.001 まで可）。`,
      answer: { type: 'numeric', value: v, tol: 1e-3 },
      solution:
        `$X \\sim \\mathrm{Bin}(${n}, ${fmtFrac(p)})$ なので\n\n` +
        `$$P(X=${k}) = \\binom{${n}}{${k}} p^{${k}}(1-p)^{${n - k}} = ${choose(n, k)} \\cdot (${fmtFrac(p)})^{${k}} \\cdot (${fmtFrac(new Frac(1).sub(p))})^{${n - k}} \\approx ${round(v, 4)}$$\n\n` +
        `$\\binom{n}{k}$ は「どの $k$ 回が成功か」の選び方の数。`,
      data: { n, pv, k },
    };
  },
  check(p) {
    const { n, pv, k } = p.data as { n: number; pv: number; k: number };
    // 漸化式 P(j+1) = P(j)·(n-j)/(j+1)·p/(1-p) で計算し直す
    let q = (1 - pv) ** n;
    let total = q;
    let at = k === 0 ? q : NaN;
    for (let j = 0; j < n; j++) {
      q = (q * (n - j)) / (j + 1) * (pv / (1 - pv));
      total += q;
      if (j + 1 === k) at = q;
    }
    return Math.abs(total - 1) < 1e-9 && Math.abs(at - (p.answer as { value: number }).value) < 1e-12;
  },
};

const bayes: Generator = {
  id: 'prob.bayes-test',
  generate(rng) {
    const prev = rng.pick([0.001, 0.005, 0.01, 0.02, 0.05]);
    const sens = rng.pick([0.9, 0.95, 0.99]);
    const fpr = rng.pick([0.01, 0.02, 0.05, 0.1]);
    const v = (sens * prev) / (sens * prev + fpr * (1 - prev));
    const pct = (x: number) => `${round(x * 100, 2)}\\%`;
    return {
      prompt:
        `ある病気の有病率は $${pct(prev)}$。検査は、病気の人を $${pct(sens)}$ の確率で陽性と判定し、` +
        `病気でない人を $${pct(fpr)}$ の確率で誤って陽性と判定する。陽性と出た人が本当に病気である確率を求めよ（小数、誤差 0.001 まで可）。`,
      answer: { type: 'numeric', value: v, tol: 1e-3 },
      solution:
        `$D$ = 病気, $+$ = 陽性。ベイズの定理より\n\n` +
        `$$P(D\\mid +) = \\frac{P(+\\mid D)P(D)}{P(+\\mid D)P(D) + P(+\\mid D^c)P(D^c)} = \\frac{${sens}\\cdot ${prev}}{${sens}\\cdot ${prev} + ${fpr}\\cdot ${round(1 - prev, 3)}} \\approx ${round(v, 4)}$$\n\n` +
        `直感: 10万人いれば病気の人は ${round(prev * 1e5, 0)} 人、そのうち陽性 ${round(sens * prev * 1e5, 1)} 人。健康な人の偽陽性は ${round(fpr * (1 - prev) * 1e5, 1)} 人。` +
        `有病率が低いと偽陽性が多数派になる（侵入検知のアラートが誤報だらけになるのと同じ構造）。`,
      data: { prev, sens, fpr },
    };
  },
  check(p) {
    const { prev, sens, fpr } = p.data as { prev: number; sens: number; fpr: number };
    const N = 1e8; // 自然頻度で数え直す
    const sick = N * prev;
    const tp = sick * sens;
    const fp = (N - sick) * fpr;
    return Math.abs(tp / (tp + fp) - (p.answer as { value: number }).value) < 1e-9;
  },
};

const birthday: Generator = {
  id: 'prob.birthday',
  generate(rng) {
    const useHash = rng.next() < 0.5;
    const m = useHash ? 65536 : 365;
    const n = useHash ? rng.pick([100, 200, 300, 400, 500]) : rng.pick([10, 15, 20, 23, 25, 30]);
    let none = 1;
    for (let i = 0; i < n; i++) none *= 1 - i / m;
    const v = 1 - none;
    const approx = 1 - Math.exp((-n * (n - 1)) / (2 * m));
    const ctx = useHash
      ? `16 ビットのハッシュ値（$m = 2^{16} = 65536$ 通り、一様ランダムとみなす）を $n = ${n}$ 個の異なる入力について計算する。少なくとも1組のハッシュ値が衝突する確率`
      : `$n = ${n}$ 人の誕生日（$m = 365$ 日、一様・独立とみなす）で、同じ誕生日の人が少なくとも1組いる確率`;
    return {
      prompt: `${ctx}を求めよ（小数、誤差 0.015 まで可。近似式を使ってよい）。`,
      answer: { type: 'numeric', value: v, tol: 0.015 },
      solution:
        `余事象「全部ちがう」の確率は $\\prod_{i=0}^{n-1}\\left(1 - \\frac{i}{m}\\right)$。$1-x \\approx e^{-x}$ を使うと\n\n` +
        `$$P(\\text{衝突}) \\approx 1 - \\exp\\left(-\\frac{n(n-1)}{2m}\\right) = ${round(approx, 4)}$$\n\n` +
        `正確な値は $${round(v, 4)}$。衝突は $n \\approx \\sqrt{m}$ 程度で起き始める。` +
        `これが「$b$ ビットのハッシュは約 $2^{b/2}$ 回の試行で衝突が見つかる」（誕生日攻撃）の根拠。`,
      data: { m, n },
    };
  },
  check(p) {
    const { m, n } = p.data as { m: number; n: number };
    let none = 1;
    for (let i = n - 1; i >= 0; i--) none *= (m - i) / m; // 逆順・別の式で
    const approx = 1 - Math.exp((-n * (n - 1)) / (2 * m));
    const v = (p.answer as { value: number }).value;
    return Math.abs(1 - none - v) < 1e-12 && Math.abs(approx - v) <= 0.015;
  },
};

const ballsEmpty: Generator = {
  id: 'prob.balls-empty',
  generate(rng) {
    const n = rng.pick([4, 5, 8, 10, 16]);
    const m = rng.int(n - 2, 2 * n);
    const v = n * (1 - 1 / n) ** m;
    return {
      prompt: `$m = ${m}$ 個のボールを $n = ${n}$ 個の箱にそれぞれ独立・一様にランダムに入れる。空の箱の個数の期待値を求めよ（小数、誤差 0.01 まで可）。`,
      answer: { type: 'numeric', value: v, tol: 0.01 },
      solution:
        `指示変数 $I_j = \\mathbf{1}\\{\\text{箱 } j \\text{ が空}\\}$ を使う。空箱の数は $\\sum_j I_j$ で、期待値の線形性より\n\n` +
        `$$E\\left[\\sum_{j=1}^{n} I_j\\right] = \\sum_{j=1}^{n} P(\\text{箱 } j \\text{ が空}) = n\\left(1-\\frac{1}{n}\\right)^{m} \\approx ${round(v, 4)}$$\n\n` +
        `$I_j$ どうしは独立ではないが、線形性には独立性は不要。ハッシュテーブルの空きバケット数の見積もりと同じ計算。`,
      data: { n, m },
    };
  },
  check(p) {
    const { n, m } = p.data as { n: number; m: number };
    // 埋まっている箱の数の分布を1個ずつ更新する別解
    let dist = new Array(n + 1).fill(0);
    dist[0] = 1;
    for (let t = 0; t < m; t++) {
      const next = new Array(n + 1).fill(0);
      for (let k = 0; k <= n; k++) {
        if (!dist[k]) continue;
        next[k] += (dist[k] * k) / n;
        if (k < n) next[k + 1] += (dist[k] * (n - k)) / n;
      }
      dist = next;
    }
    const occupied = dist.reduce((s, q, k) => s + q * k, 0);
    return Math.abs(n - occupied - (p.answer as { value: number }).value) < 1e-9;
  },
};

// ───────────── 統計学 ─────────────

const zInterval: Generator = {
  id: 'stat.z-interval',
  generate(rng) {
    const n = rng.pick([16, 25, 36, 49, 64, 100]);
    const sigma = rng.int(2, 12);
    const xbar = round(rng.int(100, 900) / 10, 1);
    const half = (1.96 * sigma) / Math.sqrt(n);
    return {
      prompt:
        `母標準偏差 $\\sigma = ${sigma}$ が既知の正規母集団から大きさ $n = ${n}$ の標本をとり、標本平均 $\\bar{x} = ${xbar}$ を得た。` +
        `母平均 $\\mu$ の 95% 信頼区間 $[L, U]$ を求めよ（$L, U$ の順に、誤差 0.01 まで可）。`,
      answer: { type: 'tuple', value: [xbar - half, xbar + half], tol: 0.01 },
      solution:
        `$\\bar{X} \\sim N(\\mu, \\sigma^2/n)$ より $P\\left(|\\bar{X} - \\mu| \\le 1.96\\,\\sigma/\\sqrt{n}\\right) = 0.95$。\n\n` +
        `$$\\bar{x} \\pm 1.96\\frac{\\sigma}{\\sqrt{n}} = ${xbar} \\pm 1.96\\cdot\\frac{${sigma}}{${Math.sqrt(n)}} = ${xbar} \\pm ${round(half, 3)}$$\n\n` +
        `よって $[${round(xbar - half, 2)},\\ ${round(xbar + half, 2)}]$。「$\\mu$ がこの区間に入る確率が 95%」ではなく、「この手順で作った区間が $\\mu$ を含む割合が 95%」と読む。`,
      data: { n, sigma, xbar },
    };
  },
  check(p) {
    const { n, sigma, xbar } = p.data as { n: number; sigma: number; xbar: number };
    const half = 1.96 * Math.sqrt((sigma * sigma) / n);
    const [l, u] = (p.answer as { value: number[] }).value;
    return Math.abs(l - (xbar - half)) < 1e-9 && Math.abs(u - (xbar + half)) < 1e-9;
  },
};

// ───────────── 抽象代数学 ─────────────

const modpowBig = (a: number, b: number, n: number) => Number(BigInt(a) ** BigInt(b) % BigInt(n));

const modpow: Generator = {
  id: 'alg.modpow',
  generate(rng) {
    const p = rng.pick([5, 7, 11, 13, 17, 19, 23]);
    const a = rng.int(2, p - 1);
    const b = rng.int(30, 300);
    const r = b % (p - 1);
    const v = modpowBig(a, b, p);
    return {
      prompt: `$${a}^{${b}} \\bmod ${p}$ を求めよ（$0$ 以上 $${p - 1}$ 以下で）。`,
      answer: { type: 'numeric', value: v },
      solution:
        `$${p}$ は素数で $${a}$ は $${p}$ の倍数でないので、フェルマーの小定理より $${a}^{${p - 1}} \\equiv 1 \\pmod{${p}}$。\n\n` +
        `$${b} = ${p - 1}\\cdot ${Math.floor(b / (p - 1))} + ${r}$ より $${a}^{${b}} \\equiv ${a}^{${r}} \\equiv ${v} \\pmod{${p}}$。\n\n` +
        `指数を $p-1$ で割った余りに落とすのがコツ。プログラムでは繰り返し二乗法で $O(\\log b)$ 回の掛け算で計算する。`,
      data: { a, b, p },
    };
  },
  check(p) {
    const { a, b, p: m } = p.data as { a: number; b: number; p: number };
    // 素朴なループで計算し直す
    let x = 1;
    for (let i = 0; i < b; i++) x = (x * a) % m;
    return x === (p.answer as { value: number }).value;
  },
};

const elementOrder: Generator = {
  id: 'alg.element-order',
  generate(rng) {
    const n = rng.pick([7, 9, 10, 11, 13, 14, 15, 16, 17, 18]);
    const units = Array.from({ length: n - 2 }, (_, i) => i + 2).filter((a) => gcd(a, n) === 1);
    const a = rng.pick(units);
    const pows: number[] = [];
    let x = a % n;
    while (true) {
      pows.push(x);
      if (x === 1) break;
      x = (x * a) % n;
    }
    const phi = Array.from({ length: n }, (_, i) => i).filter((k) => gcd(k, n) === 1).length;
    return {
      prompt: `乗法群 $(\\mathbb{Z}/${n}\\mathbb{Z})^\\times$ における $${a}$ の位数を求めよ。`,
      answer: { type: 'numeric', value: pows.length },
      solution:
        `$${a}$ のべきを $\\bmod ${n}$ で順に計算する: ${pows.map((v, i) => `$${a}^{${i + 1}} \\equiv ${v}$`).join(', ')}。\n\n` +
        `初めて $1$ になるのは $${pows.length}$ 乗なので位数は $${pows.length}$。` +
        `群の位数は $\\varphi(${n}) = ${phi}$ で、ラグランジュの定理より元の位数は必ず $${phi}$ の約数になる（検算に使える）。`,
      data: { a, n, phi },
    };
  },
  check(p) {
    const { a, n, phi } = p.data as { a: number; n: number; phi: number };
    const k = (p.answer as { value: number }).value;
    if (phi % k !== 0 || modpowBig(a, k, n) !== 1) return false;
    for (let j = 1; j < k; j++) if (modpowBig(a, j, n) === 1) return false;
    return true;
  },
};

const inverseMod: Generator = {
  id: 'alg.inverse-mod',
  generate(rng) {
    const n = rng.int(11, 60);
    let a: number;
    do a = rng.int(2, n - 1);
    while (gcd(a, n) !== 1);
    // 拡張ユークリッドの互除法（途中経過を記録）
    const steps: string[] = [];
    let [r0, r1, s0, s1] = [n, a, 0, 1];
    while (r1 !== 0) {
      const q = Math.floor(r0 / r1);
      steps.push(`$${r0} = ${q}\\cdot ${r1} + ${r0 - q * r1}$`);
      [r0, r1] = [r1, r0 - q * r1];
      [s0, s1] = [s1, s0 - q * s1];
    }
    const inv = ((s0 % n) + n) % n;
    return {
      prompt: `$${a}x \\equiv 1 \\pmod{${n}}$ を満たす $x$（$0 \\le x < ${n}$）を求めよ。`,
      answer: { type: 'numeric', value: inv },
      solution:
        `$\\gcd(${a}, ${n}) = 1$ なので逆元が存在する。拡張ユークリッドの互除法:\n\n${steps.join('\n\n')}\n\n` +
        `これを逆にたどると $${a}\\cdot ${s0} \\equiv 1 \\pmod{${n}}$、よって $x = ${inv}$。` +
        `RSA で秘密鍵 $d \\equiv e^{-1} \\pmod{\\varphi(n)}$ を求めるのもこの計算。`,
      data: { a, n },
    };
  },
  check(p) {
    const { a, n } = p.data as { a: number; n: number };
    const x = (p.answer as { value: number }).value;
    return x >= 0 && x < n && (a * x) % n === 1;
  },
};

// ───────────── 凸解析・最適化 ─────────────

const quadF = (A: Mat, b: number[], x: number[]) =>
  0.5 * (x[0] * (A[0][0] * x[0] + A[0][1] * x[1]) + x[1] * (A[1][0] * x[0] + A[1][1] * x[1])) + b[0] * x[0] + b[1] * x[1];

const grad = (A: Mat, b: number[], x: number[]) => [A[0][0] * x[0] + A[0][1] * x[1] + b[0], A[1][0] * x[0] + A[1][1] * x[1] + b[1]];

const texQuad = (A: Mat, b: number[]) =>
  `f(x) = \\tfrac{1}{2}x^\\top A x + b^\\top x,\\quad A = ${texMat(A)},\\ b = ${texVec(b)}`;

const gradient: Generator = {
  id: 'cvx.gradient-quadratic',
  generate(rng) {
    const off = rng.int(-3, 3);
    const A = [
      [rng.int(-3, 4), off],
      [off, rng.int(-3, 4)],
    ];
    const b = [rng.int(-4, 4), rng.int(-4, 4)];
    const x0 = [rng.int(-3, 3), rng.int(-3, 3)];
    const g = grad(A, b, x0);
    return {
      prompt: `$${texQuad(A, b)}$ について、点 $x_0 = ${texVec(x0)}$ での勾配 $\\nabla f(x_0)$ を求めよ（成分を順にカンマ区切りで）。`,
      answer: { type: 'tuple', value: g },
      solution:
        `$A$ が対称なら $\\nabla\\left(\\tfrac12 x^\\top A x\\right) = Ax$、$\\nabla(b^\\top x) = b$ なので $\\nabla f(x) = Ax + b$。\n\n` +
        `$$\\nabla f(x_0) = ${texMat(A)}${texVec(x0)} + ${texVec(b)} = ${texVec(g)}$$\n\n` +
        `（$A$ が対称でないときは $\\tfrac12(A + A^\\top)x + b$ になる点に注意。）`,
      data: { A, b, x0 },
    };
  },
  check(p) {
    const { A, b, x0 } = p.data as { A: Mat; b: number[]; x0: number[] };
    const h = 1e-5;
    const g = (p.answer as { value: number[] }).value;
    return [0, 1].every((i) => {
      const xp = [...x0];
      const xm = [...x0];
      xp[i] += h;
      xm[i] -= h;
      return Math.abs((quadF(A, b, xp) - quadF(A, b, xm)) / (2 * h) - g[i]) < 1e-5;
    });
  },
};

const gdStep: Generator = {
  id: 'cvx.gd-step',
  generate(rng) {
    const off = rng.int(-1, 1);
    const A = [
      [rng.int(2, 5), off],
      [off, rng.int(2, 5)],
    ];
    const b = [rng.int(-4, 4), rng.int(-4, 4)];
    const x0 = [rng.int(-3, 3), rng.int(-3, 3)];
    const eta = rng.pick([0.1, 0.2, 0.25]);
    const g = grad(A, b, x0);
    const x1 = [x0[0] - eta * g[0], x0[1] - eta * g[1]].map((x) => round(x, 10));
    return {
      prompt: `$${texQuad(A, b)}$ を最小化する。初期点 $x_0 = ${texVec(x0)}$、ステップ幅 $\\eta = ${eta}$ で勾配降下法を1回行ったときの $x_1$ を求めよ。`,
      answer: { type: 'tuple', value: x1, tol: 1e-6 },
      solution:
        `$x_1 = x_0 - \\eta\\nabla f(x_0)$、$\\nabla f(x) = Ax + b$。\n\n` +
        `$\\nabla f(x_0) = ${texVec(g)}$ より $x_1 = ${texVec(x0)} - ${eta}${texVec(g)} = ${texVec(x1)}$。\n\n` +
        `$A$ の最大固有値を $L$ とすると、$\\eta < 2/L$ なら $f$ は毎回減る。ここでは $L \\le 6$、$\\eta \\le 0.25 < 1/3$ なので必ず減少する。`,
      data: { A, b, x0, eta },
    };
  },
  check(p) {
    const { A, b, x0, eta } = p.data as { A: Mat; b: number[]; x0: number[]; eta: number };
    const x1 = (p.answer as { value: number[] }).value;
    const g = grad(A, b, x0);
    const same = Math.abs(x1[0] - (x0[0] - eta * g[0])) < 1e-9 && Math.abs(x1[1] - (x0[1] - eta * g[1])) < 1e-9;
    return same && quadF(A, b, x1) <= quadF(A, b, x0) + 1e-12;
  },
};

export const GENERATORS: Record<string, Generator> = Object.fromEntries(
  [matmul, det3, inverse2, eigen2, rank34, binomial, bayes, birthday, ballsEmpty, zInterval, modpow, elementOrder, inverseMod, gradient, gdStep].map(
    (g) => [g.id, g],
  ),
);

export function generate(id: string, seed: number): GeneratedProblem {
  const g = GENERATORS[id];
  if (!g) throw new Error(`unknown generator ${id}`);
  return g.generate(new Rng(seed));
}
