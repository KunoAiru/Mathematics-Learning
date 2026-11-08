// 代数・最適化・統計の追加ジェネレーター。各 check() は別の方法で答えを計算し直す。
import { gcd, round, texMat, texVec, type GeneratedProblem, type Generator, Rng } from './util';

const num = (p: GeneratedProblem) => (p.answer as { value: number }).value;
const tup = (p: GeneratedProblem) => (p.answer as { value: number[] }).value;
const fmt = (x: number, d = 4) => String(round(x, d));
const signed = (x: number) => (x >= 0 ? `+ ${x}` : `- ${-x}`);
/** 係数 1 を省いた 1 次式 c1 x + c2 y（係数はすべて正） */
const lin = (c1: number, c2: number) => `${c1 === 1 ? '' : c1}x + ${c2 === 1 ? '' : c2}y`;

// ───────────── 抽象代数学 ─────────────

const crt: Generator = {
  id: 'alg.crt',
  generate(rng) {
    const mods = [3, 4, 5, 7, 8, 9, 11, 13];
    let m: number, n: number;
    do {
      m = rng.pick(mods);
      n = rng.pick(mods);
    } while (m === n || gcd(m, n) !== 1);
    const a = rng.int(0, m - 1);
    const b = rng.int(0, n - 1);
    // x = a + m t, m t ≡ b - a (mod n), t = (b - a) m^{-1} mod n
    let inv = 1;
    while ((m * inv) % n !== 1) inv++;
    const t = ((((b - a) % n) + n) % n) * inv % n;
    const x = a + m * t;
    return {
      prompt: `連立合同式 $x \\equiv ${a} \\pmod{${m}}$, $x \\equiv ${b} \\pmod{${n}}$ を満たす $x$ を $0 \\le x < ${m * n}$ で求めよ。`,
      answer: { type: 'numeric', value: x },
      solution:
        `$\\gcd(${m}, ${n}) = 1$ なので中国剰余定理より $\\bmod ${m * n}$ でただ1つの解がある。\n\n` +
        `$x = ${a} + ${m}t$ とおくと $${m}t \\equiv ${b} - ${a} \\pmod{${n}}$。$${m}^{-1} \\equiv ${inv} \\pmod{${n}}$ より $t \\equiv ${t}$。\n\n` +
        `よって $x = ${a} + ${m} \\cdot ${t} = ${x}$。検算: $${x} \\bmod ${m} = ${x % m}$, $${x} \\bmod ${n} = ${x % n}$。`,
      data: { a, b, m, n },
    };
  },
  check(p) {
    const { a, b, m, n } = p.data;
    const sols = Array.from({ length: m * n }, (_, x) => x).filter((x) => x % m === a && x % n === b);
    return sols.length === 1 && sols[0] === num(p);
  },
};

function cycles(perm: number[]): number[][] {
  const seen = new Array(perm.length).fill(false);
  const out: number[][] = [];
  for (let i = 0; i < perm.length; i++) {
    if (seen[i]) continue;
    const c: number[] = [];
    for (let j = i; !seen[j]; j = perm[j]) {
      seen[j] = true;
      c.push(j + 1);
    }
    out.push(c);
  }
  return out;
}

const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

const permOrder: Generator = {
  id: 'alg.perm-order',
  generate(rng) {
    const n = rng.pick([6, 7, 8]);
    const perm = rng.shuffle(Array.from({ length: n }, (_, i) => i));
    const cs = cycles(perm);
    const ord = cs.reduce((acc, c) => lcm(acc, c.length), 1);
    const top = Array.from({ length: n }, (_, i) => i + 1);
    const bottom = perm.map((x) => x + 1);
    const cycTex = cs
      .filter((c) => c.length > 1)
      .map((c) => `(${c.join('\\,')})`)
      .join('');
    return {
      prompt: `対称群 $S_${n}$ の元 $\\sigma = ${texMat([top, bottom])}$ の位数を求めよ。`,
      answer: { type: 'numeric', value: ord },
      solution:
        `巡回置換の積に分解する: $\\sigma = ${cycTex || '\\mathrm{id}'}$（長さ ${cs.map((c) => c.length).join(', ')}）。\n\n` +
        `互いに素な巡回置換は可換で、長さ $\\ell$ の巡回置換の位数は $\\ell$ なので、$\\sigma$ の位数は長さの最小公倍数 $${ord}$。`,
      data: { perm },
    };
  },
  check(p) {
    const perm = p.data.perm as number[];
    let cur = [...perm];
    for (let k = 1; k <= 1000; k++) {
      if (cur.every((v, i) => v === i)) return k === num(p);
      cur = cur.map((v) => perm[v]);
    }
    return false;
  },
};

const sqrtMod: Generator = {
  id: 'alg.sqrt-mod',
  generate(rng) {
    const p = rng.pick([7, 11, 13, 17, 19, 23, 29, 31]);
    const r = rng.int(1, p - 1);
    const a = (r * r) % p;
    const roots = [r, p - r].sort((x, y) => x - y);
    return {
      prompt: `$x^2 \\equiv ${a} \\pmod{${p}}$ を満たす $x$（$0 \\le x < ${p}$）をすべて求めよ。`,
      answer: { type: 'set', value: roots },
      solution:
        `$${roots[0]}^2 = ${roots[0] ** 2} \\equiv ${a}$ なので $x = ${roots[0]}$ は解。$(-x)^2 = x^2$ より $${p} - ${roots[0]} = ${roots[1]}$ も解。\n\n` +
        `$\\mathbb{Z}/${p}\\mathbb{Z}$ は体なので、2次多項式 $x^2 - ${a}$ の根は高々 $2$ 個。よって解は $${roots[0]}, ${roots[1]}$ ですべて。` +
        `（体でない $\\mathbb{Z}/8\\mathbb{Z}$ では $x^2 \\equiv 1$ の解が $1, 3, 5, 7$ の4個ある。）`,
      data: { a, p },
    };
  },
  check(pr) {
    const { a, p } = pr.data;
    const sols = Array.from({ length: p }, (_, x) => x).filter((x) => (x * x) % p === a);
    const v = tup(pr);
    return sols.length === v.length && sols.every((s, i) => s === v[i]);
  },
};

// ───────────── 凸解析・最適化 ─────────────

const lagrangeEq: Generator = {
  id: 'cvx.lagrange-eq',
  generate(rng) {
    let a: number, b: number;
    do {
      a = rng.int(-4, 4);
      b = rng.int(-4, 4);
    } while (a === 0 && b === 0);
    const c = rng.int(1, 10);
    const s = a * a + b * b;
    const x = (c * a) / s;
    const y = (c * b) / s;
    return {
      prompt: `$x^2 + y^2$ を、制約 $${a}x ${signed(b)}y = ${c}$ のもとで最小化する点 $(x^*, y^*)$ を求めよ（分数可）。`,
      answer: { type: 'tuple', value: [x, y], tol: 1e-6 },
      solution:
        `ラグランジュ関数 $L = x^2 + y^2 - \\lambda(${a}x ${signed(b)}y - ${c})$。$\\partial L/\\partial x = 2x - ${a}\\lambda = 0$, $\\partial L/\\partial y = 2y ${signed(-b)}\\lambda = 0$ より $(x, y) = \\tfrac{\\lambda}{2}(${a}, ${b})$。\n\n` +
        `制約に代入して $\\tfrac{\\lambda}{2} \\cdot ${s} = ${c}$、よって $(x^*, y^*) = \\left(\\tfrac{${c * a}}{${s}}, \\tfrac{${c * b}}{${s}}\\right) \\approx (${fmt(x)}, ${fmt(y)})$。\n\n` +
        `幾何的には、原点から直線への垂線の足。最適点では目的関数の勾配が制約の法線 $(${a}, ${b})$ と平行になる。`,
      data: { a, b, c },
    };
  },
  check(p, rng) {
    const { a, b, c } = p.data;
    const [x, y] = tup(p);
    if (Math.abs(a * x + b * y - c) > 1e-9) return false;
    const f = (u: number, v: number) => u * u + v * v;
    for (let k = 0; k < 20; k++) {
      const t = (rng.next() - 0.5) * 4;
      if (f(x + t * b, y - t * a) < f(x, y) - 1e-12) return false; // 直線上を動いても減らない
    }
    return true;
  },
};

const newton1d: Generator = {
  id: 'cvx.newton-1d',
  generate(rng) {
    const pp = rng.int(0, 3);
    const q = rng.nonzero(-6, 6);
    const x0 = rng.pick([-2, -1, 1, 2]);
    const d1 = 4 * x0 ** 3 + 2 * pp * x0 + q;
    const d2 = 12 * x0 ** 2 + 2 * pp;
    const x1 = x0 - d1 / d2;
    return {
      prompt: `$f(x) = x^4 ${pp ? `+ ${pp}x^2` : ''} ${signed(q)}x$ を最小化するニュートン法を $x_0 = ${x0}$ から1回行ったときの $x_1$ を求めよ（分数可）。`,
      answer: { type: 'numeric', value: x1, tol: 1e-6 },
      solution:
        `ニュートン法は $x_{k+1} = x_k - f'(x_k)/f''(x_k)$（2次近似の最小点に移る）。\n\n` +
        `$f'(x) = 4x^3 ${pp ? `+ ${2 * pp}x` : ''} ${signed(q)}$, $f''(x) = 12x^2 ${pp ? `+ ${2 * pp}` : ''}$。` +
        `$f'(${x0}) = ${d1}$, $f''(${x0}) = ${d2}$ より $x_1 = ${x0} - \\tfrac{${d1}}{${d2}} \\approx ${fmt(x1, 6)}$。\n\n` +
        `$f'' > 0$（凸）なので2次近似は下に凸で、最小点が定まる。最適解の近くでは誤差が毎回ほぼ2乗で減る（2次収束）。`,
      data: { pp, q, x0 },
    };
  },
  check(p) {
    const { pp, q, x0 } = p.data;
    const f = (x: number) => x ** 4 + pp * x * x + q * x;
    const h = 1e-4;
    const d1 = (f(x0 + h) - f(x0 - h)) / (2 * h);
    const d2 = (f(x0 + h) - 2 * f(x0) + f(x0 - h)) / (h * h);
    return Math.abs(x0 - d1 / d2 - num(p)) < 1e-4;
  },
};

const lp2d: Generator = {
  id: 'cvx.lp-2d',
  generate(rng) {
    for (;;) {
      const c = [rng.int(1, 5), rng.int(1, 5)];
      const A = [
        [rng.int(1, 4), rng.int(1, 4)],
        [rng.int(1, 4), rng.int(1, 4)],
      ];
      const r = [rng.int(6, 24), rng.int(6, 24)];
      // 制約: x>=0, y>=0, A x <= r。境界の直線どうしの交点（頂点の候補）を列挙
      const lines: [number, number, number][] = [
        [1, 0, 0],
        [0, 1, 0],
        [A[0][0], A[0][1], r[0]],
        [A[1][0], A[1][1], r[1]],
      ];
      const feasible = (x: number, y: number) =>
        x >= -1e-9 && y >= -1e-9 && A[0][0] * x + A[0][1] * y <= r[0] + 1e-9 && A[1][0] * x + A[1][1] * y <= r[1] + 1e-9;
      const verts: [number, number][] = [];
      for (let i = 0; i < 4; i++)
        for (let j = i + 1; j < 4; j++) {
          const [a1, b1, c1] = lines[i];
          const [a2, b2, c2] = lines[j];
          const det = a1 * b2 - a2 * b1;
          if (det === 0) continue;
          const x = (c1 * b2 - c2 * b1) / det;
          const y = (a1 * c2 - a2 * c1) / det;
          if (feasible(x, y)) verts.push([x, y]);
        }
      if (verts.length < 3) continue;
      const vals = verts.map(([x, y]) => c[0] * x + c[1] * y);
      const best = Math.max(...vals);
      const arg = verts[vals.indexOf(best)];
      return {
        prompt:
          `次の線形計画問題の最適値を求めよ（分数可）。\n\n` +
          `$$\\begin{aligned} \\max\\ & ${lin(c[0], c[1])} \\\\ \\text{s.t.}\\ & ${lin(A[0][0], A[0][1])} \\le ${r[0]} \\\\ & ${lin(A[1][0], A[1][1])} \\le ${r[1]} \\\\ & x, y \\ge 0 \\end{aligned}$$`,
        answer: { type: 'numeric', value: best, tol: 1e-6 },
        solution:
          `実行可能領域は凸多角形で、線形関数の最大値はその**頂点**でとられる。頂点は ${verts
            .map(([x, y]) => `$(${fmt(x)}, ${fmt(y)})$`)
            .join(', ')}。\n\n` +
          `目的関数の値は ${vals.map((v) => `$${fmt(v)}$`).join(', ')} で、最大は $(${fmt(arg[0])}, ${fmt(arg[1])})$ での $${fmt(best)}$。\n\n` +
          `変数が多いときは単体法（頂点をたどる）や内点法（内部から近づく）で解く。`,
        data: { c, A, r, best },
      };
    }
  },
  check(p, rng) {
    const { c, A, r, best } = p.data as { c: number[]; A: number[][]; r: number[]; best: number };
    // ランダムな実行可能点で、最適値を超えるものがないことを確かめる
    const xmax = Math.min(r[0] / A[0][0], r[1] / A[1][0]);
    const ymax = Math.min(r[0] / A[0][1], r[1] / A[1][1]);
    let maxSeen = 0;
    for (let k = 0; k < 4000; k++) {
      const x = rng.next() * xmax;
      const y = rng.next() * ymax;
      if (A[0][0] * x + A[0][1] * y <= r[0] && A[1][0] * x + A[1][1] * y <= r[1]) maxSeen = Math.max(maxSeen, c[0] * x + c[1] * y);
    }
    return maxSeen <= best + 1e-9 && maxSeen >= best * 0.9 && num(p) === best;
  },
};

const projHalfspace: Generator = {
  id: 'cvx.project-halfspace',
  generate(rng) {
    let a: number[];
    do a = [rng.int(-3, 3), rng.int(-3, 3)];
    while (a[0] === 0 && a[1] === 0);
    const b = rng.int(-4, 4);
    const x = [rng.int(-4, 4), rng.int(-4, 4)];
    const ax = a[0] * x[0] + a[1] * x[1];
    const nn = a[0] ** 2 + a[1] ** 2;
    const t = Math.max(0, ax - b) / nn;
    const p = [x[0] - t * a[0], x[1] - t * a[1]].map((v) => round(v, 12));
    return {
      prompt: `点 $x = ${texVec(x)}$ を半空間 $C = \\{ z : ${a[0]}z_1 ${signed(a[1])}z_2 \\le ${b} \\}$ に射影した点 $P_C(x)$ を求めよ（分数可）。`,
      answer: { type: 'tuple', value: p, tol: 1e-6 },
      solution:
        `$a = (${a[0]}, ${a[1]})$ とすると $a^\\top x = ${ax}$。` +
        (ax <= b
          ? `$${ax} \\le ${b}$ なので $x$ はすでに $C$ に入っており、$P_C(x) = x$。`
          : `$${ax} > ${b}$ なので境界へ法線方向に戻す:\n\n$$P_C(x) = x - \\frac{a^\\top x - b}{\\|a\\|^2} a = ${texVec(x)} - \\frac{${ax - b}}{${nn}}${texVec(a)} \\approx ${texVec(p.map((v) => round(v, 4)))}$$`) +
        `\n\n射影勾配法 $x_{k+1} = P_C(x_k - \\eta \\nabla f(x_k))$ はこの射影を毎回使う。`,
      data: { a, b, x },
    };
  },
  check(pr, rng) {
    const { a, b, x } = pr.data as { a: number[]; b: number; x: number[] };
    const p = tup(pr);
    if (a[0] * p[0] + a[1] * p[1] > b + 1e-9) return false;
    // 射影の特徴付け: すべての z ∈ C で (x - p)·(z - p) <= 0
    for (let k = 0; k < 200; k++) {
      const z = [(rng.next() - 0.5) * 20, (rng.next() - 0.5) * 20];
      if (a[0] * z[0] + a[1] * z[1] > b) continue;
      if ((x[0] - p[0]) * (z[0] - p[0]) + (x[1] - p[1]) * (z[1] - p[1]) > 1e-9) return false;
    }
    return true;
  },
};

// ───────────── 統計学 ─────────────

/** 標準正規分布の分布関数（Abramowitz–Stegun 7.1.26, 誤差 1.5e-7 程度） */
export function phi(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

function simpson(f: (x: number) => number, a: number, b: number, n = 2000): number {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

const zTest: Generator = {
  id: 'stat.z-test',
  generate(rng) {
    const n = rng.pick([16, 25, 36, 49, 64, 100]);
    const sigma = rng.int(2, 10);
    const mu0 = rng.int(20, 80);
    const se = sigma / Math.sqrt(n);
    const xbar = round(mu0 + rng.pick([-1, 1]) * rng.next() * 3.2 * se, 2);
    const z = (xbar - mu0) / se;
    const pval = 2 * (1 - phi(Math.abs(z)));
    return {
      prompt:
        `母標準偏差 $\\sigma = ${sigma}$ が既知の正規母集団から $n = ${n}$ 個の標本をとり $\\bar{x} = ${xbar}$ を得た。` +
        `$H_0: \\mu = ${mu0}$ 対 $H_1: \\mu \\ne ${mu0}$ の検定統計量 $z$ を求めよ（誤差 0.01 まで可）。有意水準 5% で棄却されるかも考えよ。`,
      answer: { type: 'numeric', value: z, tol: 0.01 },
      solution:
        `$H_0$ のもとで $Z = \\dfrac{\\bar{X} - \\mu_0}{\\sigma/\\sqrt{n}} \\sim N(0, 1)$。\n\n` +
        `$$z = \\frac{${xbar} - ${mu0}}{${sigma}/${Math.sqrt(n)}} \\approx ${fmt(z, 3)}$$\n\n` +
        `両側 $p$ 値は $2(1 - \\Phi(|z|)) \\approx ${fmt(pval, 4)}$。` +
        (Math.abs(z) > 1.96
          ? `$|z| > 1.96$（$p < 0.05$）なので $H_0$ を棄却する。`
          : `$|z| \\le 1.96$（$p \\ge 0.05$）なので $H_0$ は棄却されない（「$H_0$ が正しい」と示されたわけではない）。`),
      data: { xbar, mu0, se, pval },
    };
  },
  check(p) {
    const { xbar, mu0, se, pval } = p.data;
    const z = (xbar - mu0) / se;
    const pdf = (x: number) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
    const pNum = 1 - 2 * simpson(pdf, 0, Math.abs(z)); // 数値積分で p 値を計算し直す
    return Math.abs(z - num(p)) < 1e-12 && Math.abs(pNum - pval) < 1e-5;
  },
};

const mle: Generator = {
  id: 'stat.mle',
  generate(rng) {
    const model = rng.pick(['bernoulli', 'poisson', 'exponential'] as const);
    let xs: number[];
    if (model === 'bernoulli') xs = Array.from({ length: rng.int(8, 12) }, () => (rng.next() < 0.35 ? 1 : 0));
    else if (model === 'poisson') xs = Array.from({ length: rng.int(6, 8) }, () => rng.int(0, 6));
    else xs = Array.from({ length: 5 }, () => rng.int(2, 40) / 10);
    const n = xs.length;
    const mean = xs.reduce((s, x) => s + x, 0) / n;
    if (mean === 0 || (model === 'bernoulli' && mean === 1)) return mle.generate(rng);
    const est = model === 'exponential' ? 1 / mean : mean;
    const desc = {
      bernoulli: `成功確率 $p$ のベルヌーイ分布（1 = 成功）`,
      poisson: `平均 $\\lambda$ のポアソン分布 $P(X = k) = e^{-\\lambda}\\lambda^k/k!$`,
      exponential: `率 $\\lambda$ の指数分布（密度 $\\lambda e^{-\\lambda x}$）`,
    }[model];
    const param = model === 'bernoulli' ? 'p' : '\\lambda';
    const loglik = {
      bernoulli: `\\ell(p) = (\\textstyle\\sum x_i)\\log p + (n - \\textstyle\\sum x_i)\\log(1-p)`,
      poisson: `\\ell(\\lambda) = (\\textstyle\\sum x_i)\\log\\lambda - n\\lambda + \\text{const}`,
      exponential: `\\ell(\\lambda) = n\\log\\lambda - \\lambda\\textstyle\\sum x_i`,
    }[model];
    return {
      prompt: `データ ${xs.join(', ')} が ${desc} からの独立な標本だとする。$${param}$ の最尤推定値を求めよ（分数可、誤差 0.001 まで）。`,
      answer: { type: 'numeric', value: est, tol: 1e-3 },
      solution:
        `対数尤度は $${loglik}$。$${param}$ で微分して $0$ とおくと\n\n` +
        (model === 'exponential'
          ? `$n/\\lambda - \\sum x_i = 0$ より $\\hat\\lambda = n / \\sum x_i = 1/\\bar{x} = 1/${fmt(mean)} \\approx ${fmt(est)}$。`
          : `$\\hat{${param}} = \\bar{x} = ${xs.reduce((s, x) => s + x, 0)}/${n} \\approx ${fmt(est)}$。`) +
        `\n\n（2階微分が負なので最大。）`,
      data: { model, xs },
    };
  },
  check(p) {
    const { model, xs } = p.data as { model: string; xs: number[] };
    const S = xs.reduce((s, x) => s + x, 0);
    const n = xs.length;
    const ll = (t: number) =>
      model === 'bernoulli' ? S * Math.log(t) + (n - S) * Math.log(1 - t) : model === 'poisson' ? S * Math.log(t) - n * t : n * Math.log(t) - t * S;
    // 黄金分割探索で対数尤度を数値的に最大化
    let [lo, hi] = model === 'bernoulli' ? [1e-9, 1 - 1e-9] : [1e-9, 100];
    const g = (Math.sqrt(5) - 1) / 2;
    for (let k = 0; k < 200; k++) {
      const m1 = hi - g * (hi - lo);
      const m2 = lo + g * (hi - lo);
      if (ll(m1) < ll(m2)) lo = m1;
      else hi = m2;
    }
    return Math.abs((lo + hi) / 2 - num(p)) < 1e-6;
  },
};

const betaPosterior: Generator = {
  id: 'stat.beta-posterior',
  generate(rng) {
    const a = rng.int(1, 5);
    const b = rng.int(1, 5);
    const n = rng.int(5, 20);
    const k = rng.int(0, n);
    const mean = (a + k) / (a + b + n);
    return {
      prompt:
        `コインの表の確率 $\\theta$ の事前分布を $\\mathrm{Beta}(${a}, ${b})$ とする。$${n}$ 回投げて表が $${k}$ 回出た。` +
        `事後分布の平均 $E[\\theta \\mid \\text{データ}]$ を求めよ（分数可、誤差 0.001 まで）。`,
      answer: { type: 'numeric', value: mean, tol: 1e-3 },
      solution:
        `事後 $\\propto$ 尤度 $\\times$ 事前 $= \\theta^{${k}}(1-\\theta)^{${n - k}} \\cdot \\theta^{${a - 1}}(1-\\theta)^{${b - 1}}$ なので、事後分布は $\\mathrm{Beta}(${a + k}, ${b + n - k})$（共役事前分布）。\n\n` +
        `$\\mathrm{Beta}(\\alpha, \\beta)$ の平均は $\\alpha/(\\alpha + \\beta)$ より $\\tfrac{${a + k}}{${a + b + n}} \\approx ${fmt(mean)}$。\n\n` +
        `事前分布は「表 $${a}$ 回・裏 $${b}$ 回を見た」のと同じ効果を持つ。データが増えるほど標本比率 $${k}/${n}$ に近づく。`,
      data: { a, b, n, k },
    };
  },
  check(p) {
    const { a, b, n, k } = p.data;
    const dens = (t: number) => t ** (a + k - 1) * (1 - t) ** (b + n - k - 1);
    const Z = simpson(dens, 0, 1, 4000);
    const m = simpson((t) => t * dens(t), 0, 1, 4000) / Z;
    return Math.abs(m - num(p)) < 1e-6;
  },
};

function randomPoints(rng: Rng, n: number): { x: number[]; y: number[] } {
  for (;;) {
    const xs = rng.shuffle([0, 1, 2, 3, 4, 5, 6]).slice(0, n).sort((a, b) => a - b);
    const slope = rng.int(-3, 3);
    const icpt = rng.int(-3, 5);
    const ys = xs.map((x) => icpt + slope * x + rng.int(-2, 2));
    const my = ys.reduce((s, v) => s + v, 0) / n;
    if (ys.some((v) => v !== my)) return { x: xs, y: ys };
  }
}

const sums = (x: number[], y: number[]) => {
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
    sxy += (x[i] - mx) * (y[i] - my);
  }
  return { n, mx, my, sxx, syy, sxy };
};

const pointsTex = (x: number[], y: number[]) => x.map((v, i) => `$(${v}, ${y[i]})$`).join(', ');

const regression: Generator = {
  id: 'stat.regression',
  generate(rng) {
    const { x, y } = randomPoints(rng, rng.int(4, 5));
    const { mx, my, sxx, sxy } = sums(x, y);
    const slope = sxy / sxx;
    const icpt = my - slope * mx;
    return {
      prompt: `データ ${pointsTex(x, y)} に最小二乗法で直線 $y = a + bx$ をあてはめる。$(a, b)$ を求めよ（分数可、誤差 0.001 まで）。`,
      answer: { type: 'tuple', value: [icpt, slope], tol: 1e-3 },
      solution:
        `$\\bar{x} = ${fmt(mx)}$, $\\bar{y} = ${fmt(my)}$, $S_{xx} = \\sum(x_i - \\bar{x})^2 = ${fmt(sxx)}$, $S_{xy} = \\sum(x_i - \\bar{x})(y_i - \\bar{y}) = ${fmt(sxy)}$。\n\n` +
        `$$b = \\frac{S_{xy}}{S_{xx}} \\approx ${fmt(slope)}, \\qquad a = \\bar{y} - b\\bar{x} \\approx ${fmt(icpt)}$$\n\n` +
        `これは正規方程式 $X^\\top X\\beta = X^\\top y$（$X$ の列は $1$ と $x$）を解いたものと同じ。回帰直線は必ず $(\\bar{x}, \\bar{y})$ を通る。`,
      data: { x, y },
    };
  },
  check(p) {
    const { x, y } = p.data as { x: number[]; y: number[] };
    const [a, b] = tup(p);
    // 残差が定数ベクトルと x に直交すること（正規方程式）
    const r = x.map((xi, i) => y[i] - a - b * xi);
    return Math.abs(r.reduce((s, v) => s + v, 0)) < 1e-9 && Math.abs(r.reduce((s, v, i) => s + v * x[i], 0)) < 1e-9;
  },
};

const correlation: Generator = {
  id: 'stat.correlation',
  generate(rng) {
    const { x, y } = randomPoints(rng, 5);
    const { sxx, syy, sxy } = sums(x, y);
    const r = sxy / Math.sqrt(sxx * syy);
    return {
      prompt: `データ ${pointsTex(x, y)} の（標本）相関係数 $r$ を求めよ（誤差 0.001 まで）。`,
      answer: { type: 'numeric', value: r, tol: 1e-3 },
      solution:
        `$S_{xx} = ${fmt(sxx)}$, $S_{yy} = ${fmt(syy)}$, $S_{xy} = ${fmt(sxy)}$ より\n\n` +
        `$$r = \\frac{S_{xy}}{\\sqrt{S_{xx}S_{yy}}} \\approx ${fmt(r)}$$\n\n` +
        `コーシー・シュワルツの不等式から $|r| \\le 1$。$r$ は**直線的な**関係の強さだけを測る（$y = x^2$ のような関係は $r \\approx 0$ になりうる）。`,
      data: { x, y },
    };
  },
  check(p) {
    const { x, y } = p.data as { x: number[]; y: number[] };
    const n = x.length;
    const mean = (v: number[]) => v.reduce((s, t) => s + t, 0) / n;
    const sd = (v: number[]) => Math.sqrt(v.reduce((s, t) => s + (t - mean(v)) ** 2, 0) / n);
    // 標準化した値の積の平均として計算し直す
    const r = x.reduce((s, xi, i) => s + ((xi - mean(x)) / sd(x)) * ((y[i] - mean(y)) / sd(y)), 0) / n;
    return Math.abs(r - num(p)) < 1e-9;
  },
};

export const MORE_GENERATORS: Generator[] = [
  crt,
  permOrder,
  sqrtMod,
  lagrangeEq,
  newton1d,
  lp2d,
  projHalfspace,
  zTest,
  mle,
  betaPosterior,
  regression,
  correlation,
];
