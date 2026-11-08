import { createEmptyCard, fsrs, Rating, State, type CardInput, type Grade } from 'ts-fsrs';
import type { SubjectId } from '../content/types';

/** 保存する FSRS カード（Date は ISO 文字列で持つ） */
export type StoredCard = Omit<CardInput, 'due' | 'last_review'> & { due: string; last_review?: string | null };

export interface Report {
  itemId: string;
  cardId?: string;
  comment: string;
  at: string;
  resolved?: boolean;
}

export interface Settings {
  subjects: SubjectId[];
  /** 1日の復習カードの上限 */
  reviewCap: number;
  /** 今日のセットで学ぶ新しい概念の数 */
  newPerDay: number;
  /** 手書きメモでペン入力のみを受け付ける（手のひらの誤タッチ防止） */
  penOnly: boolean;
}

export interface AppState {
  version: 1;
  cards: Record<string, StoredCard>;
  /** 概念を初めて学んだ日時 */
  introduced: Record<string, string>;
  /** 日付(YYYY-MM-DD) → その日に回答したカード数 */
  activity: Record<string, number>;
  /** 日付(YYYY-MM-DD) → その日の「今日のセット」を最後までやり終えた */
  completed: Record<string, boolean>;
  reports: Report[];
  /** 計算ドリルの成績（項目 id → 解いた数・正解数）。復習スケジュールとは別 */
  drill: Record<string, { n: number; ok: number }>;
  settings: Settings;
}

export const defaultState = (): AppState => ({
  version: 1,
  cards: {},
  introduced: {},
  activity: {},
  completed: {},
  reports: [],
  drill: {},
  settings: {
    subjects: ['linear-algebra', 'probability', 'statistics', 'algebra', 'convex', 'cpp', 'rust'],
    reviewCap: 20,
    newPerDay: 2,
    penOnly: false,
  },
});

const scheduler = fsrs({ enable_fuzz: true, request_retention: 0.9 });

export const toStored = (c: { due: Date; last_review?: Date } & Omit<CardInput, 'due' | 'last_review'>): StoredCard => ({
  ...c,
  due: c.due.toISOString(),
  last_review: c.last_review ? c.last_review.toISOString() : null,
});

export const newCard = (now: Date): StoredCard => toStored(createEmptyCard(now));

export function review(card: StoredCard | undefined, grade: Grade, now: Date): StoredCard {
  const base = card ?? newCard(now);
  return toStored(scheduler.next(base, now, grade).card);
}

/** 各評価を選んだときの次回までの間隔（表示用） */
export function previewIntervals(card: StoredCard | undefined, now: Date): Record<Grade, string> {
  const base = card ?? newCard(now);
  const log = scheduler.repeat(base, now);
  const fmt = (d: Date) => {
    const min = (d.getTime() - now.getTime()) / 60000;
    if (min < 60) return `${Math.max(1, Math.round(min))}分`;
    if (min < 60 * 24) return `${Math.round(min / 60)}時間`;
    const days = min / 60 / 24;
    if (days < 30) return `${Math.round(days)}日`;
    if (days < 365) return `${Math.round(days / 30)}か月`;
    return `${(days / 365).toFixed(1)}年`;
  };
  return {
    [Rating.Again]: fmt(log[Rating.Again].card.due),
    [Rating.Hard]: fmt(log[Rating.Hard].card.due),
    [Rating.Good]: fmt(log[Rating.Good].card.due),
    [Rating.Easy]: fmt(log[Rating.Easy].card.due),
  } as Record<Grade, string>;
}

export const isDue = (c: StoredCard, now: Date) => new Date(c.due).getTime() <= now.getTime();

/** 定着: 記憶の安定度（≒忘れるまでの日数）が 21 日以上で、復習中の状態 */
export const isMastered = (c: StoredCard | undefined) => !!c && c.state === State.Review && c.stability >= 21;

/** ローカル日付 YYYY-MM-DD */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * 連続日数。1回休んでも、その前後 6 日以内に別の休みがなければ途切れない（週1回の「おやすみ」）。
 * 2日続けて休むと途切れる。今日まだやっていなくても、昨日までの連続は表示する。
 */
export function streak(completed: Record<string, boolean>, today: Date): { days: number; freezeUsed: boolean } {
  const done = (d: Date) => !!completed[dayKey(d)];
  const diffDays = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 864e5);
  let cur = done(today) ? today : addDays(today, -1);
  let days = 0;
  let lastForgiven: Date | null = null;
  let freezeUsed = false;
  for (let i = 0; i < 3650; i++) {
    if (done(cur)) {
      days++;
    } else {
      const prevDone = done(addDays(cur, -1));
      const recentlyForgiven = lastForgiven !== null && diffDays(lastForgiven, cur) < 7;
      if (!prevDone || recentlyForgiven) break;
      lastForgiven = new Date(cur);
      if (diffDays(today, cur) < 7) freezeUsed = true;
    }
    cur = addDays(cur, -1);
  }
  return { days, freezeUsed };
}
