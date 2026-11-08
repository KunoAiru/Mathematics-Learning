import { useState } from 'react';
import { CARDS_BY_ITEM, ITEMS } from '../content';
import { SUBJECTS, type Item, type SubjectId } from '../content/types';
import { isUnlocked, type Step } from '../store/daily';
import type { AppState } from '../store/state';
import { MdInline } from '../components/Tex';

/** 毎回数値が変わる計算問題（ジェネレーター付きの問題） */
const DRILLS = ITEMS.filter((it) => it.kind === 'problem' && it.generator);

const drillSteps = (items: Item[], count: number): Step[] =>
  Array.from({ length: count }, (_, k) => {
    const it = items[k % items.length];
    return { kind: 'card' as const, cardId: CARDS_BY_ITEM.get(it.id)![0].id, label: 'ドリル' as const };
  });

const shuffle = <T,>(xs: T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function Drill({ state, start }: { state: AppState; start: (steps: Step[]) => void }) {
  const [count, setCount] = useState(5);
  const subjects = SUBJECTS.filter((s) => DRILLS.some((d) => d.subject === s.id));
  const learned = (it: Item) => isUnlocked(state, it);
  const mixPool = DRILLS.filter((it) => learned(it) && state.settings.subjects.includes(it.subject));

  const mix = (pool: Item[]) => {
    if (pool.length === 0) return;
    // なるべく別の種類が続くように、シャッフルした順に巡回する
    const order = shuffle(pool);
    start(drillSteps(order, count));
  };
  const total = Object.values(state.drill ?? {}).reduce((s, r) => s + r.n, 0);

  return (
    <div className="page drill">
      <h2>計算ドリル</h2>
      <p className="muted small">
        毎回数値の変わる問題を好きなだけ解けます。ここでの結果は復習のスケジュールには影響しません（これまでに {total} 問）。
      </p>

      <section className="panel">
        <div className="row between">
          <b>1回の問題数</b>
          <div className="row">
            {[5, 10, 20].map((n) => (
              <button key={n} className={`chip-sm ${count === n ? 'ok' : ''}`} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <button className="primary wide big-btn" style={{ marginTop: 12 }} disabled={mixPool.length === 0} onClick={() => mix(mixPool)}>
          学習済みの範囲からミックス（{count} 問）
        </button>
        {mixPool.length === 0 && <p className="muted small center">概念を学ぶと、その範囲の問題がミックスに入ります。下から個別に選ぶこともできます。</p>}
      </section>

      {subjects.map((s) => (
        <DrillSubject key={s.id} subject={s.id} state={state} count={count} start={start} onMix={mix} />
      ))}
    </div>
  );
}

function DrillSubject({
  subject,
  state,
  count,
  start,
  onMix,
}: {
  subject: SubjectId;
  state: AppState;
  count: number;
  start: (steps: Step[]) => void;
  onMix: (pool: Item[]) => void;
}) {
  const s = SUBJECTS.find((x) => x.id === subject)!;
  const list = DRILLS.filter((d) => d.subject === subject);
  return (
    <section className="panel">
      <div className="row between">
        <h3 style={{ color: s.color, margin: 0 }}>{s.name}</h3>
        <button className="link" onClick={() => onMix(list)}>
          この科目でミックス
        </button>
      </div>
      <ul className="drill-list">
        {list.map((it) => {
          const rec = state.drill?.[it.id];
          const open = isUnlocked(state, it);
          return (
            <li key={it.id}>
              <button className="drill-item" onClick={() => start(drillSteps([it], count))}>
                <span className="drill-title">
                  <MdInline src={it.title.replace(/（計算）$/, '')} />
                  {!open && <small className="muted">（前提を未学習）</small>}
                </span>
                <span className="muted small">{rec ? `${rec.ok}/${rec.n} 正解` : '未挑戦'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
