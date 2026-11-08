import { useMemo, useState } from 'react';
import { ITEM_BY_ID, ITEMS } from '../content';
import { depths } from '../content/parse';
import { KIND_LABEL, SUBJECTS, subjectOf, type SubjectId } from '../content/types';
import { masteryOf, type Mastery } from '../store/daily';
import type { AppState } from '../store/state';
import { MdInline } from '../components/Tex';

const MASTERY_LABEL: Record<Mastery, string> = {
  locked: '未解放',
  open: '学べる',
  learning: '学習中',
  mastered: '定着',
};

export function MapView({ state, openItem }: { state: AppState; openItem: (id: string) => void }) {
  const [subject, setSubject] = useState<SubjectId>(state.settings.subjects[0] ?? 'linear-algebra');
  const depth = useMemo(() => depths(ITEMS), []);
  const items = ITEMS.filter((it) => it.subject === subject);
  const levels: (typeof items)[] = [];
  for (const it of items) (levels[depth.get(it.id)!] ??= []).push(it);
  const s = subjectOf(subject);
  const count = (m: Mastery) => items.filter((it) => masteryOf(state, it) === m).length;

  return (
    <div className="page map">
      <div className="subject-tabs">
        {SUBJECTS.map((x) => (
          <button
            key={x.id}
            className={`chip ${x.id === subject ? 'on' : ''}`}
            style={{ ['--c' as string]: x.color }}
            onClick={() => setSubject(x.id)}
          >
            {x.short}
          </button>
        ))}
      </div>
      <h2 style={{ color: s.color }}>{s.name}</h2>
      <p className="muted small">教科書: {s.source}</p>
      <div className="legend">
        {(['mastered', 'learning', 'open', 'locked'] as Mastery[]).map((m) => (
          <span key={m} className={`legend-item m-${m}`}>
            <i /> {MASTERY_LABEL[m]} {count(m)}
          </span>
        ))}
      </div>
      <div className="levels" style={{ ['--c' as string]: s.color }}>
        {levels.map((lv, d) =>
          lv ? (
            <div key={d} className="level">
              <div className="level-label">{d === 0 ? '基礎' : `段 ${d}`}</div>
              <div className="nodes">
                {lv.map((it) => {
                  const m = masteryOf(state, it);
                  const cross = it.requires.filter((r) => ITEM_BY_ID.get(r)!.subject !== it.subject);
                  return (
                    <button key={it.id} className={`node m-${m}`} onClick={() => openItem(it.id)}>
                      <span className="node-kind">{KIND_LABEL[it.kind]}</span>
                      <span className="node-title">
                        <MdInline src={it.title} />
                      </span>
                      {cross.length > 0 && (
                        <span className="node-cross">← {[...new Set(cross.map((r) => subjectOf(ITEM_BY_ID.get(r)!.subject).short))].join('・')}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null,
        )}
      </div>
      <p className="muted small">下の段ほど、上の段の概念を前提にしています。前提をすべて学ぶと解放されます。</p>
    </div>
  );
}
