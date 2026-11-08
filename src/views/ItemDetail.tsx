import { CARDS_BY_ITEM, getItem, ITEMS } from '../content';
import { isConcept, subjectOf } from '../content/types';
import { isUnlocked, masteryOf, type Step } from '../store/daily';
import type { AppState } from '../store/state';
import { MdInline } from '../components/Tex';
import { ItemContent, KindBadge } from './ItemContent';

const variantLabel = (key: string) =>
  key === 'recall' ? '主張・定義を思い出す' : key === 'order' ? '証明の並べ替え' : key.startsWith('q') ? `確認問題 ${Number(key.slice(1)) + 1}` : '問題';

export function ItemDetail({
  state,
  itemId,
  onClose,
  openItem,
  start,
  openMemo,
  openReport,
}: {
  state: AppState;
  itemId: string;
  onClose: () => void;
  openItem: (id: string) => void;
  start: (steps: Step[]) => void;
  openMemo: (id: string, title: string) => void;
  openReport: (itemId: string) => void;
}) {
  const item = getItem(itemId);
  const m = masteryOf(state, item);
  const cards = CARDS_BY_ITEM.get(itemId) ?? [];
  const usedBy = ITEMS.filter((it) => it.requires.includes(itemId));
  const unlocked = isUnlocked(state, item);
  const practice = (): Step[] => [
    ...(isConcept(item) && !state.introduced[itemId] ? [{ kind: 'learn' as const, itemId }] : []),
    ...cards.map((c) => ({ kind: 'card' as const, cardId: c.id, label: '新規' as const })),
  ];

  return (
    <div className="sheet" role="dialog">
      <div className="sheet-bar">
        <button className="icon" onClick={onClose} aria-label="閉じる">
          ←
        </button>
        <KindBadge item={item} />
        <span className={`mastery m-${m}`}>{{ locked: '未解放', open: '学べる', learning: '学習中', mastered: '定着' }[m]}</span>
      </div>
      <div className="sheet-body">
        <h2>
          <MdInline src={item.title} />
        </h2>
        {item.requires.length > 0 && (
          <div className="reqs">
            <span className="muted small">前提:</span>
            {item.requires.map((r) => {
              const ri = getItem(r);
              return (
                <button key={r} className={`chip-sm ${state.introduced[r] ? 'ok' : ''}`} onClick={() => openItem(r)}>
                  {state.introduced[r] ? '✓ ' : ''}
                  <MdInline src={ri.title} />
                  {ri.subject !== item.subject && <small>（{subjectOf(ri.subject).short}）</small>}
                </button>
              );
            })}
          </div>
        )}
        {unlocked || state.introduced[itemId] ? (
          <ItemContent item={item} />
        ) : (
          <p className="muted">前提の概念を学ぶと解放されます（先に中身を見ることもできます）。</p>
        )}
        {!unlocked && !state.introduced[itemId] && (
          <details>
            <summary>それでも中身を見る</summary>
            <ItemContent item={item} />
          </details>
        )}
        <div className="row wrap">
          <button className="primary" onClick={() => start(practice())}>
            {state.introduced[itemId] ? 'この項目を練習する' : '今すぐ学ぶ'}
          </button>
          <button className="ghost" onClick={() => openMemo(itemId, item.title)}>
            ✍️ メモ
          </button>
          <button className="ghost" onClick={() => openReport(itemId)}>
            ⚑ 誤りを報告
          </button>
        </div>
        {state.introduced[itemId] && (
          <div className="panel">
            <h4>カード</h4>
            <ul className="card-states">
              {cards.map((c) => {
                const st = state.cards[c.id];
                const key = c.id.split('#')[1];
                return (
                  <li key={c.id}>
                    <span>{variantLabel(key)}</span>
                    <span className="muted small">
                      {st ? `次回 ${new Date(st.due).toLocaleDateString('ja-JP')}・安定度 ${st.stability.toFixed(1)} 日` : '未回答'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {usedBy.length > 0 && (
          <div className="reqs">
            <span className="muted small">これを使う項目:</span>
            {usedBy.map((u) => (
              <button key={u.id} className="chip-sm" onClick={() => openItem(u.id)}>
                <MdInline src={u.title} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
