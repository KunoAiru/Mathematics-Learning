// 教材の自動チェック
//   npm run validate            構造・前提関係・数式・ジェネレーターの検算
//   npm run validate -- --code  さらに C++/Rust のコードを実際にコンパイル・実行して確かめる
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import katex from 'katex';
import { parseContent } from '../src/content/parse';
import type { AnswerSpec, Item } from '../src/content/types';
import { GENERATORS, Rng } from '../src/generators';
import { mathSegments } from '../src/lib/markup';
import { parseNumber } from '../src/lib/answer';

const root = join(import.meta.dirname, '..');
const errors: string[] = [];
const err = (m: string) => errors.push(m);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.yaml') ? [p] : [];
  });
}

const files: Record<string, string> = {};
for (const p of walk(join(root, 'content'))) files['/' + relative(root, p)] = readFileSync(p, 'utf8');

let items: Item[] = [];
try {
  items = parseContent(files);
} catch (e) {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
}

// ── 数式が KaTeX で描画できるか ──
function checkTex(where: string, text: string | undefined) {
  if (!text) return;
  for (const { tex, display } of mathSegments(text)) {
    try {
      katex.renderToString(tex, { throwOnError: true, displayMode: display, strict: 'ignore' });
    } catch (e) {
      err(`${where}: 数式エラー: ${(e as Error).message.split('\n')[0]}\n    $${tex}$`);
    }
  }
}

function checkAnswerSpec(where: string, a: AnswerSpec) {
  const nums = (vs: (number | string)[]) => vs.forEach((v) => Number.isFinite(parseNumber(v)) || err(`${where}: 答えの値 "${v}" が数として読めません`));
  if (a.type === 'numeric') nums([a.value]);
  if (a.type === 'tuple' || a.type === 'set') nums(a.value);
  if (a.type === 'matrix') a.value.forEach(nums);
  if (a.type === 'choice') a.choices.forEach((c, i) => checkTex(`${where} choice[${i}]`, c));
  if (a.type === 'self') checkTex(where, a.value);
}

for (const it of items) {
  const w = it.id;
  checkTex(w, it.why);
  it.questions?.forEach((q, i) => {
    checkTex(`${w} questions[${i}].q`, q.q);
    checkTex(`${w} questions[${i}].a`, q.a);
  });
  switch (it.kind) {
    case 'definition':
    case 'theorem':
      checkTex(w, it.statement);
      if (it.kind === 'theorem') it.proof?.forEach((s, i) => checkTex(`${w} proof[${i}]`, s));
      break;
    case 'problem':
      if (it.generator) {
        const g = GENERATORS[it.generator];
        if (!g) {
          err(`${w}: ジェネレーター "${it.generator}" がありません`);
          break;
        }
        // 300 個の問題を作り、別の方法で答えを計算し直して一致を確かめる
        for (let seed = 1; seed <= 300; seed++) {
          const p = g.generate(new Rng(seed));
          if (!g.check(p, new Rng(seed * 7919))) {
            err(`${w}: seed=${seed} で検算が一致しません\n    ${p.prompt}`);
            break;
          }
          checkAnswerSpec(`${w} seed=${seed}`, p.answer);
          if (seed <= 20) {
            checkTex(`${w} seed=${seed} prompt`, p.prompt);
            checkTex(`${w} seed=${seed} solution`, p.solution);
          }
        }
      } else {
        checkTex(w, it.prompt);
        checkTex(w, it.solution);
        checkAnswerSpec(w, it.answer!);
      }
      break;
    case 'code':
      checkTex(w, it.prompt);
      checkTex(w, it.explanation);
      checkAnswerSpec(w, it.answer);
      break;
    case 'exercise':
      checkTex(w, it.prompt);
      it.checklist?.forEach((c, i) => checkTex(`${w} checklist[${i}]`, c));
      break;
  }
}

// ── コードを実際にコンパイル・実行する ──
const has = (cmd: string) => spawnSync('which', [cmd]).status === 0;

/** 演習: starter 中の同名関数を solution で置き換えた完全なプログラム */
export const BEGIN_MARK = '// ---- 解答欄 ----';
export const END_MARK = '// ---- ここまで ----';

/**
 * 演習: starter の「解答欄」マーカーの間（なければ同名の関数）を solution で置き換えた完全なプログラム。
 * クラスや複数の関数を書かせる演習はマーカー方式にする。
 */
export function spliceSolution(starter: string, solution: string): string {
  const lines0 = starter.split('\n');
  const b = lines0.findIndex((l) => l.trim() === BEGIN_MARK);
  const e = lines0.findIndex((l) => l.trim() === END_MARK);
  if (b >= 0 && e > b) return [...lines0.slice(0, b), solution.trimEnd(), ...lines0.slice(e + 1)].join('\n');
  const sig = solution.split('\n').find((l) => /\w+\s*\(/.test(l) && /\{\s*$/.test(l));
  if (!sig) throw new Error('solution に関数定義が見つかりません');
  const name = sig.match(/(\w+)\s*\(/)![1];
  const lines = starter.split('\n');
  const start = lines.findIndex((l) => new RegExp(`\\b${name}\\s*\\(`).test(l) && /\{\s*$/.test(l));
  if (start < 0) throw new Error(`starter に関数 ${name} が見つかりません`);
  let end = start + 1;
  while (end < lines.length && lines[end] !== '}') end++;
  return [...lines.slice(0, start), solution.trimEnd(), ...lines.slice(end + 1)].join('\n');
}

function runCode(lang: 'cpp' | 'rust', src: string): { build: boolean; stdout: string; status: number | null; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), 'mathdojo-'));
  const file = join(dir, lang === 'cpp' ? 'main.cpp' : 'main.rs');
  const bin = join(dir, 'main');
  writeFileSync(file, src);
  const args = lang === 'cpp' ? ['-std=c++20', '-pedantic-errors', '-O0', '-pthread', '-o', bin, file] : ['--edition', '2021', '-o', bin, file];
  const b = spawnSync(lang === 'cpp' ? 'g++' : 'rustc', args, { encoding: 'utf8' });
  if (b.status !== 0) return { build: false, stdout: '', status: null, stderr: b.stderr };
  const r = spawnSync(bin, { encoding: 'utf8', timeout: 10000 });
  return { build: true, stdout: r.stdout, status: r.status, stderr: r.stderr };
}

if (process.argv.includes('--code')) {
  for (const it of items) {
    if (it.kind !== 'code' && it.kind !== 'exercise') continue;
    const compiler = it.lang === 'cpp' ? 'g++' : 'rustc';
    if (!has(compiler)) {
      console.warn(`- ${it.id}: ${compiler} がないのでスキップ`);
      continue;
    }
    if (it.kind === 'code' && it.verify) {
      const v = it.verify;
      const r = runCode(it.lang, it.code);
      if (v.build === 'error' && r.build) err(`${it.id}: コンパイルエラーになるはずが通りました`);
      if (v.build !== 'error' && !r.build) err(`${it.id}: コンパイルに失敗しました\n${r.stderr}`);
      if (v.stdout !== undefined && r.build && r.stdout !== v.stdout) err(`${it.id}: 出力が ${JSON.stringify(r.stdout)}（期待: ${JSON.stringify(v.stdout)}）`);
      if (v.panics !== undefined && r.build && (r.status !== 0) !== v.panics) err(`${it.id}: 終了コード ${r.status}（panics=${v.panics} を期待）`);
      console.log(`  ✓ ${it.id}`);
    }
    if (it.kind === 'exercise') {
      try {
        const r = runCode(it.lang, spliceSolution(it.starter, it.solution));
        if (!r.build) err(`${it.id}: 模範解答がコンパイルできません\n${r.stderr}`);
        else if (r.status !== 0) err(`${it.id}: 模範解答の実行が失敗しました（終了コード ${r.status}）\n${r.stderr}`);
        else console.log(`  ✓ ${it.id}: ${r.stdout.trim().split('\n').pop()}`);
      } catch (e) {
        err(`${it.id}: ${(e as Error).message}`);
      }
    }
  }
}

const gens = items.filter((i) => i.kind === 'problem' && i.generator).length;
if (errors.length > 0) {
  console.error(`✗ ${errors.length} 件のエラー\n` + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
const byKind = items.reduce<Record<string, number>>((m, i) => ((m[i.kind] = (m[i.kind] ?? 0) + 1), m), {});
console.log(`✓ 教材 ${items.length} 項目 ${JSON.stringify(byKind)}、ジェネレーター ${gens} 種 × 300 問の検算に成功`);
