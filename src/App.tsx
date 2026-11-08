import { useCallback, useEffect, useState } from 'react';
import { MemoEditor } from './components/Memo';
import { getItem } from './content';
import type { Step } from './store/daily';
import { loadState, requestPersist, saveState } from './store/persist';
import type { AppState } from './store/state';
import { ItemDetail } from './views/ItemDetail';
import { MapView } from './views/MapView';
import { Notes } from './views/Notes';
import { Session } from './views/Session';
import { Settings } from './views/Settings';
import { Today } from './views/Today';

type Tab = 'today' | 'map' | 'notes' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: '今日', icon: '◉' },
  { id: 'map', label: 'マップ', icon: '◇' },
  { id: 'notes', label: 'ノート', icon: '✎' },
  { id: 'settings', label: '設定', icon: '⚙' },
];

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [session, setSession] = useState<Step[] | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [detail, setDetail] = useState<string[]>([]);
  const [memo, setMemo] = useState<{ id: string; title: string; deletable?: boolean } | null>(null);
  const [memoVersion, setMemoVersion] = useState(0);
  const [report, setReport] = useState<{ itemId: string; cardId?: string } | null>(null);

  useEffect(() => {
    loadState().then(setState);
    void requestPersist();
  }, []);

  const update = useCallback((fn: (s: AppState) => AppState) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      void saveState(next);
      return next;
    });
  }, []);

  const replace = (s: AppState) => {
    void saveState(s);
    setState(s);
  };

  if (!state) return <div className="loading">読み込み中…</div>;

  const start = (steps: Step[]) => {
    if (steps.length === 0) return;
    setDetail([]);
    setSession(steps);
    setSessionKey((k) => k + 1);
  };
  const openItem = (id: string) => setDetail((d) => [...d, id]);
  const openMemo = (id: string, title: string, deletable?: boolean) => setMemo({ id, title, deletable });

  return (
    <div className="app">
      {session ? (
        <Session
          key={sessionKey}
          initial={session}
          state={state}
          update={update}
          onExit={() => setSession(null)}
          openMemo={openMemo}
          openReport={(itemId, cardId) => setReport({ itemId, cardId })}
        />
      ) : (
        <>
          <main>
            {tab === 'today' && <Today state={state} start={start} />}
            {tab === 'map' && <MapView state={state} openItem={openItem} />}
            {tab === 'notes' && <Notes openMemo={openMemo} version={memoVersion} />}
            {tab === 'settings' && <Settings state={state} update={update} replace={replace} />}
          </main>
          <nav className="tabbar">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
                <span className="tab-icon">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </>
      )}

      {detail.length > 0 && !session && (
        <ItemDetail
          key={detail[detail.length - 1]}
          state={state}
          itemId={detail[detail.length - 1]}
          onClose={() => setDetail((d) => d.slice(0, -1))}
          openItem={openItem}
          start={start}
          openMemo={openMemo}
          openReport={(itemId) => setReport({ itemId })}
        />
      )}

      {memo && (
        <MemoEditor
          key={memo.id}
          id={memo.id}
          title={memo.title}
          deletable={memo.deletable}
          penOnly={state.settings.penOnly}
          onClose={() => {
            setMemo(null);
            setMemoVersion((v) => v + 1);
          }}
        />
      )}

      {report && (
        <ReportDialog
          title={getItem(report.itemId).title}
          onCancel={() => setReport(null)}
          onSubmit={(comment) => {
            update((s) => ({ ...s, reports: [...s.reports, { ...report, comment, at: new Date().toISOString() }] }));
            setReport(null);
          }}
        />
      )}
    </div>
  );
}

function ReportDialog({ title, onCancel, onSubmit }: { title: string; onCancel: () => void; onSubmit: (c: string) => void }) {
  const [text, setText] = useState('');
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>誤りを報告</h3>
        <p className="muted small">「{title}」のどこがおかしいですか？ 報告は設定画面にたまり、まとめて Claude Code に渡して直せます。</p>
        <textarea autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="例: 証明の3ステップ目で λ が複素数のまま実ベクトルをとっている" />
        <div className="row end">
          <button className="ghost" onClick={onCancel}>
            やめる
          </button>
          <button className="primary" disabled={!text.trim()} onClick={() => onSubmit(text.trim())}>
            報告する
          </button>
        </div>
      </div>
    </div>
  );
}
