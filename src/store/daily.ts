import { CARDS, CARDS_BY_ITEM, ITEMS } from '../content';
import { isConcept, SUBJECTS, type Item } from '../content/types';
import { dayKey, isDue, isMastered, type AppState } from './state';

export type Step =
  | { kind: 'learn'; itemId: string }
  | { kind: 'card'; cardId: string; label: '復習' | '新規' | '今日の1問' | '再挑戦' | 'ドリル' };

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
 * 学習済みの項目なのに、まだ一度も答えていないカード。
 * （確認問題の途中でやめた場合や、教材にあとから確認問題を追加した場合）
 */
export function pendingCards(s: AppState): string[] {
  return CARDS.filter((c) => {
    const it = ITEMS.find((i) => i.id === c.itemId)!;
    return s.introduced[c.itemId] && enabled(s, it) && !s.cards[c.id];
  }).map((c) => c.id);
}

export const isDayComplete = (s: AppState, now: Date) => !!s.completed[dayKey(now)];

/**
 * 次に学ぶ概念。解放済みで未学習のもののうち、最近学んでいない科目を優先し、
 * 同じ科目内ではファイル順（= 教材の並び順）。
 */
export function nextConcept(s: AppState, exclude: string[] = [], pickedToday: string[] = []): Item | undefined {
  // 同じセットで先に選んだ概念は学習済みとみなして前提を判定する
  const known = (id: string) => !!s.introduced[id] || pickedToday.includes(id);
  const candidates = ITEMS.filter(
    (it) => isConcept(it) && enabled(s, it) && !known(it.id) && it.requires.every(known) && !exclude.includes(it.id),
  );
  if (candidates.length === 0) return undefined;
  const lastBySubject = new Map<string, string>();
  for (const [id, at] of Object.entries(s.introduced)) {
    const it = ITEMS.find((i) => i.id === id);
    if (!it) continue;
    const prev = lastBySubject.get(it.subject);
    if (!prev || prev < at) lastBySubject.set(it.subject, at);
  }
  for (const id of pickedToday) lastBySubject.set(ITEMS.find((i) => i.id === id)!.subject, '9999');
  const order = (it: Item) => SUBJECTS.findIndex((x) => x.id === it.subject);
  return [...candidates].sort(
    (a, b) => (lastBySubject.get(a.subject) ?? '').localeCompare(lastBySubject.get(b.subject) ?? '') || order(a) - order(b),
  )[0];
}

/** 今日の1問: 数学とコードを日替わりにし、未挑戦の解放済み問題を優先 */
export function dailyProblem(s: AppState, now: Date, exclude: string[] = [], learningToday: string[] = []): Item | undefined {
  // 今日のセットで学ぶ概念は、学習済みとみなして解放を判定する
  const known = (id: string) => !!s.introduced[id] || learningToday.includes(id);
  const problems = ITEMS.filter(
    (it) => !isConcept(it) && enabled(s, it) && it.requires.every(known) && !exclude.includes(it.id),
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

/** 今日始めた項目（概念・問題）の数 */
function startedToday(s: AppState, now: Date, concept: boolean): number {
  const today = dayKey(now);
  return Object.entries(s.introduced).filter(([id, at]) => {
    const it = ITEMS.find((i) => i.id === id);
    return it && isConcept(it) === concept && dayKey(new Date(at)) === today;
  }).length;
}

/**
 * 今日のセット: 復習 → 新しい概念1つ（読む→すぐ確認）→ 今日の1問。
 * 新しい概念と今日の1問は1日1回まで（それ以上は「もっとやる」から）。
 * 途中でやめても、答えたカードは期限が先に延びるので、残りだけが「続き」として出る。
 */
export function buildDailySet(s: AppState, now: Date): Step[] {
  const steps: Step[] = [];
  const due = dueCards(s, now).slice(0, s.settings.reviewCap);
  for (const id of due) steps.push({ kind: 'card', cardId: id, label: '復習' });
  for (const id of pendingCards(s)) steps.push({ kind: 'card', cardId: id, label: '新規' });
  const picked: string[] = [];
  for (let k = startedToday(s, now, true); k < (s.settings.newPerDay ?? 1); k++) {
    const concept = nextConcept(s, picked, picked);
    if (!concept) break;
    picked.push(concept.id);
    steps.push({ kind: 'learn', itemId: concept.id });
    for (const c of CARDS_BY_ITEM.get(concept.id) ?? []) steps.push({ kind: 'card', cardId: c.id, label: '新規' });
  }
  const prob = startedToday(s, now, false) > 0 ? undefined : dailyProblem(s, now, [], picked);
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
