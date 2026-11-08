import { useEffect, useState } from 'react';
import { MemoThumb } from '../components/Memo';
import { MdInline } from '../components/Tex';
import { listMemos, type Memo } from '../store/persist';

export function Notes({ openMemo, version }: { openMemo: (id: string, title: string, deletable?: boolean) => void; version: number }) {
  const [memos, setMemos] = useState<Memo[] | null>(null);
  useEffect(() => {
    listMemos().then(setMemos);
  }, [version]);

  const create = () => {
    const now = new Date();
    const title = `ノート ${now.toLocaleDateString('ja-JP')} ${now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
    openMemo(`note:${now.getTime()}`, title, true);
  };

  return (
    <div className="page notes">
      <div className="row between">
        <h2>手書きノート</h2>
        <button className="primary" onClick={create}>
          ＋ 新しいノート
        </button>
      </div>
      <p className="muted small">学習中に「メモ」から書いたものは、その概念ごとにここに保存されます。自由な計算用紙として新しいノートも作れます。</p>
      {memos === null ? null : memos.length === 0 ? (
        <p className="empty">まだノートはありません。カードの右上の「✍️ メモ」から書いてみよう。</p>
      ) : (
        <div className="memo-grid">
          {memos.map((m) => (
            <button key={m.id} className="memo-card" onClick={() => openMemo(m.id, m.title, true)}>
              <MemoThumb memo={m} />
              <span className="memo-card-title">
                <MdInline src={m.title} />
              </span>
              <small className="muted">{new Date(m.updatedAt).toLocaleDateString('ja-JP')}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
