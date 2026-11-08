import { createStore, del, get, keys, set } from 'idb-keyval';
import { defaultState, type AppState } from './state';

const store = createStore('math-dojo', 'kv');
const STATE_KEY = 'state';

export interface Stroke {
  color: string;
  width: number;
  eraser?: boolean;
  /** x, y, pressure の並び（キャンバス座標、CSS px） */
  points: number[];
}

export interface Memo {
  id: string; // itemId または `note:<時刻>`
  title: string;
  strokes: Stroke[];
  height: number;
  updatedAt: string;
}

export async function loadState(): Promise<AppState> {
  const s = (await get<AppState>(STATE_KEY, store)) ?? defaultState();
  const d = defaultState();
  return { ...d, ...s, settings: { ...d.settings, ...s.settings } };
}

export const saveState = (s: AppState) => set(STATE_KEY, s, store);

export const loadMemo = (id: string) => get<Memo>(`memo:${id}`, store);
export const saveMemo = (m: Memo) => set(`memo:${m.id}`, m, store);
export const deleteMemo = (id: string) => del(`memo:${id}`, store);

export async function listMemos(): Promise<Memo[]> {
  const ks = (await keys(store)).filter((k) => typeof k === 'string' && k.startsWith('memo:')) as string[];
  const ms = await Promise.all(ks.map((k) => get<Memo>(k, store)));
  return (ms.filter(Boolean) as Memo[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export interface Backup {
  app: 'math-dojo';
  exportedAt: string;
  state: AppState;
  memos: Memo[];
}

export async function exportBackup(state: AppState): Promise<Backup> {
  return { app: 'math-dojo', exportedAt: new Date().toISOString(), state, memos: await listMemos() };
}

export async function importBackup(b: Backup): Promise<AppState> {
  if (b.app !== 'math-dojo' || !b.state) throw new Error('バックアップファイルの形式が違います');
  await saveState(b.state);
  for (const m of b.memos ?? []) await saveMemo(m);
  return loadState();
}

/** ブラウザに保存データを消さないよう頼む（ホーム画面に追加した PWA では通ることが多い） */
export async function requestPersist(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
