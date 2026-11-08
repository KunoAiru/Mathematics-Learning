import yaml from 'js-yaml';
import { SUBJECTS, type CardDef, type Item } from './types';

const SUBJECT_IDS = new Set(SUBJECTS.map((s) => s.id));
const KINDS = new Set(['definition', 'theorem', 'problem', 'code', 'exercise']);

export class ContentError extends Error {}

/**
 * YAML ファイル群（パス → 中身）から Item の一覧を作る。
 * 各ファイルは Item 1つ、または Item の配列。
 * 構造の誤りは ContentError を投げる（数式の検査は scripts/validate.ts）。
 */
export function parseContent(files: Record<string, string>): Item[] {
  const items: Item[] = [];
  const paths = Object.keys(files).sort();
  for (const path of paths) {
    let doc: unknown;
    try {
      doc = yaml.load(files[path]);
    } catch (e) {
      throw new ContentError(`${path}: YAML の構文エラー: ${(e as Error).message}`);
    }
    if (doc == null) continue;
    const list = Array.isArray(doc) ? doc : [doc];
    for (const raw of list) items.push(normalize(raw, path));
  }
  checkGraph(items);
  return items;
}

function normalize(raw: unknown, path: string): Item {
  if (typeof raw !== 'object' || raw === null) throw new ContentError(`${path}: 項目がオブジェクトではありません`);
  const r = raw as Record<string, unknown>;
  const where = `${path} (${String(r.id ?? '?')})`;
  const need = (key: string) => {
    if (r[key] === undefined || r[key] === null || r[key] === '') throw new ContentError(`${where}: "${key}" がありません`);
  };
  need('id');
  need('kind');
  need('subject');
  need('title');
  if (!KINDS.has(r.kind as string)) throw new ContentError(`${where}: 不明な kind "${String(r.kind)}"`);
  if (!SUBJECT_IDS.has(r.subject as never)) throw new ContentError(`${where}: 不明な subject "${String(r.subject)}"`);
  r.requires = (r.requires as string[] | undefined) ?? [];
  if (!Array.isArray(r.requires)) throw new ContentError(`${where}: requires は配列にしてください`);

  switch (r.kind) {
    case 'definition':
    case 'theorem':
      need('statement');
      break;
    case 'problem':
      if (!r.generator) {
        need('prompt');
        need('answer');
      }
      break;
    case 'code':
      need('lang');
      need('code');
      need('prompt');
      need('answer');
      need('explanation');
      break;
    case 'exercise':
      need('lang');
      need('prompt');
      need('starter');
      need('solution');
      break;
  }
  if (r.questions !== undefined) {
    if (!Array.isArray(r.questions)) throw new ContentError(`${where}: questions は配列にしてください`);
    for (const q of r.questions as Record<string, unknown>[]) {
      if (!q.q || !q.a) throw new ContentError(`${where}: questions の各要素には q と a が必要です`);
    }
  }
  if (r.answer) checkAnswer(r.answer as Record<string, unknown>, where);
  // 「例: ...」のように ": " を含む行を引用符なしで書くと YAML ではオブジェクトになってしまう
  for (const key of ['proof', 'checklist']) {
    const v = r[key];
    if (v !== undefined && (!Array.isArray(v) || v.some((x) => typeof x !== 'string')))
      throw new ContentError(`${where}: ${key} の要素が文字列ではありません（": " を含む行は |- で書くか引用符で囲む）`);
  }
  for (const key of ['statement', 'prompt', 'solution', 'explanation', 'why', 'code', 'starter', 'title']) {
    if (r[key] !== undefined && typeof r[key] !== 'string') throw new ContentError(`${where}: ${key} が文字列ではありません`);
  }
  return r as unknown as Item;
}

function checkAnswer(a: Record<string, unknown>, where: string) {
  const t = a.type;
  if (t === 'choice') {
    if (!Array.isArray(a.choices) || a.choices.some((c) => typeof c !== 'string') || typeof a.value !== 'number' || a.value < 0 || a.value >= a.choices.length)
      throw new ContentError(`${where}: choice の answer には choices と正しい value（添字）が必要です`);
  } else if (!['numeric', 'tuple', 'set', 'matrix', 'self'].includes(t as string)) {
    throw new ContentError(`${where}: 不明な answer.type "${String(t)}"`);
  } else if (a.value === undefined) {
    throw new ContentError(`${where}: answer.value がありません`);
  }
}

function checkGraph(items: Item[]) {
  const ids = new Map<string, Item>();
  for (const it of items) {
    if (ids.has(it.id)) throw new ContentError(`id "${it.id}" が重複しています`);
    ids.set(it.id, it);
  }
  for (const it of items) {
    for (const req of it.requires) {
      if (!ids.has(req)) throw new ContentError(`${it.id}: requires の "${req}" が存在しません`);
    }
  }
  // 循環チェック
  const state = new Map<string, 1 | 2>();
  const visit = (id: string, stack: string[]) => {
    const s = state.get(id);
    if (s === 2) return;
    if (s === 1) throw new ContentError(`前提関係が循環しています: ${[...stack, id].join(' → ')}`);
    state.set(id, 1);
    for (const req of ids.get(id)!.requires) visit(req, [...stack, id]);
    state.set(id, 2);
  };
  for (const it of items) visit(it.id, []);
}

/** Item から復習カードの一覧を作る */
export function cardsOf(it: Item): CardDef[] {
  const cards: CardDef[] = [];
  const add = (key: string, variant: CardDef['variant']) => cards.push({ id: `${it.id}#${key}`, itemId: it.id, variant });
  switch (it.kind) {
    case 'definition':
      add('recall', { type: 'recall' });
      break;
    case 'theorem':
      add('recall', { type: 'recall' });
      if (it.proof && it.proof.length >= 3) add('order', { type: 'order' });
      break;
    case 'problem':
      add('problem', { type: 'problem' });
      break;
    case 'code':
      add('code', { type: 'code' });
      break;
    case 'exercise':
      add('exercise', { type: 'exercise' });
      break;
  }
  it.questions?.forEach((_, i) => add(`q${i}`, { type: 'question', index: i }));
  return cards;
}

/** 前提関係の深さ（知識マップの段） */
export function depths(items: Item[]): Map<string, number> {
  const byId = new Map(items.map((i) => [i.id, i]));
  const memo = new Map<string, number>();
  const depth = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    const it = byId.get(id)!;
    // 同じ科目内の前提だけで段を決める（他科目の前提はマップ上では注記）
    const same = it.requires.filter((r) => byId.get(r)!.subject === it.subject);
    const d = same.length === 0 ? 0 : 1 + Math.max(...same.map(depth));
    memo.set(id, d);
    return d;
  };
  for (const it of items) depth(it.id);
  return memo;
}
