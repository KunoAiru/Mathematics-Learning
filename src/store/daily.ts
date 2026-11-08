import { CARDS, CARDS_BY_ITEM, ITEMS } from '../content';
import { isConcept, SUBJECTS, type Item } from '../content/types';
import { dayKey, isDue, isMastered, type AppState } from './state';

export type Step =
  | { kind: 'learn'; itemId: string }
  | { kind: 'card'; cardId: string; label: '復習' | '新規' | '今日の1問' | '再挑戦' };

const enabled = (s: AppState, it: Item) => s.settings.subjects.includes(it.subject);

/** 前提がすべて学習済みなら解放 */
export const isUnlocked = (s: AppState, it: Item) => it.requires.every((r) => !!s.introduced[r]);

export type Mastery = 'locked' | 'open' | 'learning' | 'mastered';

export function masteryOf(s: AppState, it: Item): Mastery {
  if (!s.introduced[it.id]) return isUnlocked(s, it) ? 'open' : 'locked';
  const cards = CARDS_BY_ITEM.get(it.id) ?? [];
  return cards.every((c) => isMastered(s.cards[c.id])) ? 'mastered' : 'learning';
}

export function dueCards(s: AppState, now: Date): string[] {
  return CARDS.filter((c) => {
    const st = s.cards[c.id];
    const it = ITEMS.find((i) => i.id === c.itemId)!;
    return st && enabled(s, it) && isDue(st, now);
  })
    .sort((a, b) => new Date(s.cards[a.id].due).getTime() - new Date(s.cards[b.id].due).getTime())
    .map((c) => c.id);
}

/**
 * 次に学ぶ概念。解放済みで未学習のもののうち、最近学んでいない科目を優先し、
 * 同じ科目内ではファイル順（= 教材の並び順）。
 */
export function nextConcept(s: AppState, exclude: string[] = []): Item | undefined {
  const candidates = ITEMS.filter((it) => isConcept(it) && enabled(s, it) && !s.introduced[it.id] && isUnlocked(s, it) && !exclude.includes(it.id));
  if (candidates.length === 0) return undefined;
  const lastBySubject = new Map<string, string>();
  for (const [id, at] of Object.entries(s.introduced)) {
    const it = ITEMS.find((i) => i.id === id);
    if (!it) continue;
    const prev = lastBySubject.get(it.subject);
    if (!prev || prev < at) lastBySubject.set(it.subject, at);
  }
  const order = (it: Item) => SUBJECTS.findIndex((x) => x.id === it.subject);
  return [...candidates].sort(
    (a, b) => (lastBySubject.get(a.subject) ?? '').localeCompare(lastBySubject.get(b.subject) ?? '') || order(a) - order(b),
  )[0];
}

/** 今日の1問: 数学とコードを日替わりにし、未挑戦の解放済み問題を優先 */
export function dailyProblem(s: AppState, now: Date, exclude: string[] = []): Item | undefined {
  const problems = ITEMS.filter(
    (it) => !isConcept(it) && enabled(s, it) && isUnlocked(s, it) && !exclude.includes(it.id),
  );
  if (problems.length === 0) return undefined;
  const dayNum = Math.floor(now.getTime() / 864e5);
  const wantCode = dayNum % 2 === 1;
  const fresh = problems.filter((it) => !s.introduced[it.id]);
  const pool = fresh.length > 0 ? fresh : problems.filter((it) => (CARDS_BY_ITEM.get(it.id) ?? []).every((c) => !s.cards[c.id] || !isDue(s.cards[c.id], now)));
  const preferred = pool.filter((it) => (it.subject === 'cpp' || it.subject === 'rust') === wantCode);
  const list = preferred.length > 0 ? preferred : pool;
  if (list.length === 0) return undefined;
  return list[dayNum % list.length];
}

/** 今日すでに始めた項目（概念・問題）があるか */
function startedToday(s: AppState, now: Date, concept: boolean): boolean {
  const today = dayKey(now);
  return Object.entries(s.introduced).some(([id, at]) => {
    const it = ITEMS.find((i) => i.id === id);
    return it && isConcept(it) === concept && dayKey(new Date(at)) === today;
  });
}

/**
 * 今日のセット: 復習 → 新しい概念1つ（読む→すぐ確認）→ 今日の1問。
 * 新しい概念と今日の1問は1日1回まで（それ以上は「もっとやる」から）。
 */
export function buildDailySet(s: AppState, now: Date): Step[] {
  const steps: Step[] = [];
  const due = dueCards(s, now).slice(0, s.settings.reviewCap);
  for (const id of due) steps.push({ kind: 'card', cardId: id, label: '復習' });
  const concept = startedToday(s, now, true) ? undefined : nextConcept(s);
  if (concept) {
    steps.push({ kind: 'learn', itemId: concept.id });
    for (const c of CARDS_BY_ITEM.get(concept.id) ?? []) steps.push({ kind: 'card', cardId: c.id, label: '新規' });
  }
  const prob = startedToday(s, now, false) ? undefined : dailyProblem(s, now);
  if (prob) {
    for (const c of CARDS_BY_ITEM.get(prob.id) ?? []) {
      if (!due.includes(c.id)) steps.push({ kind: 'card', cardId: c.id, label: '今日の1問' });
    }
  }
  return steps;
}

/** 「もっとやる」: 新しい概念をもう1つ、または問題をもう1問 */
export function buildExtra(s: AppState, now: Date, what: 'concept' | 'problem'): Step[] {
  if (what === 'concept') {
    const c = nextConcept(s);
    if (!c) return [];
    return [{ kind: 'learn', itemId: c.id }, ...(CARDS_BY_ITEM.get(c.id) ?? []).map((x) => ({ kind: 'card' as const, cardId: x.id, label: '新規' as const }))];
  }
  const fresh = ITEMS.filter((it) => !isConcept(it) && enabled(s, it) && isUnlocked(s, it) && !s.introduced[it.id]);
  const pick = fresh[0] ?? dailyProblem(s, new Date(now.getTime() + 864e5));
  if (!pick) return [];
  return (CARDS_BY_ITEM.get(pick.id) ?? []).map((x) => ({ kind: 'card' as const, cardId: x.id, label: '今日の1問' as const }));
}
