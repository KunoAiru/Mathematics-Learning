import { useEffect, useRef, useState } from 'react';
import { getItem, ITEM_BY_ID } from '../content';
import { SUBJECTS } from '../content/types';
import { exportBackup, importBackup, requestPersist, type Backup } from '../store/persist';
import { defaultState, type AppState } from '../store/state';

export function Settings({ state, update, replace }: { state: AppState; update: (fn: (s: AppState) => AppState) => void; replace: (s: AppState) => void }) {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const st = state.settings;

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const set = (patch: Partial<AppState['settings']>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  const toggle = (id: (typeof SUBJECTS)[number]['id']) => {
    const on = st.subjects.includes(id);
    if (on && st.subjects.length === 1) return;
    set({ subjects: on ? st.subjects.filter((x) => x !== id) : [...st.subjects, id] });
  };

  const download = async () => {
    const b = await exportBackup(state);
    const blob = new Blob([JSON.stringify(b)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `math-dojo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const upload = async (f: File) => {
    try {
      const b = JSON.parse(await f.text()) as Backup;
      if (!confirm('現在の学習記録をバックアップの内容で置き換えます。よろしいですか？')) return;
      replace(await importBackup(b));
      alert('復元しました');
    } catch (e) {
      alert(`復元できませんでした: ${(e as Error).message}`);
    }
  };

  const open = state.reports.filter((r) => !r.resolved);
  const reportText = open
    .map((r) => {
      const it = ITEM_BY_ID.has(r.itemId) ? getItem(r.itemId) : undefined;
      return `- ${r.itemId}${r.cardId ? `（${r.cardId.split('#')[1]}）` : ''} ${it ? `「${it.title}」` : ''}: ${r.comment}`;
    })
    .join('\n');
  const copyReports = async () => {
    await navigator.clipboard.writeText(`教材の誤り報告を直してください:\n${reportText}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="page settings">
      <h2>設定</h2>

      <section className="panel">
        <h3>学ぶ科目</h3>
        <div className="toggles">
          {SUBJECTS.map((s) => (
            <label key={s.id} className="toggle">
              <input type="checkbox" checked={st.subjects.includes(s.id)} onChange={() => toggle(s.id)} />
              <span style={{ color: s.color }}>●</span> {s.name}
            </label>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>1日の復習枚数の上限</h3>
        <div className="row">
          <input type="range" min={5} max={60} step={5} value={st.reviewCap} onChange={(e) => set({ reviewCap: Number(e.target.value) })} />
          <b>{st.reviewCap} 枚</b>
        </div>
        <p className="muted small">復習がたまっても、1日にこれ以上は出しません（残りは翌日以降）。</p>
      </section>

      <section className="panel">
        <h3>手書きメモ</h3>
        <label className="toggle">
          <input type="checkbox" checked={st.penOnly} onChange={(e) => set({ penOnly: e.target.checked })} />
          ペンのみで書く（指はスクロール。Apple Pencil などを使うとき）
        </label>
      </section>

      <section className="panel">
        <h3>誤り報告（{open.length} 件）</h3>
        {open.length === 0 ? (
          <p className="muted small">学習中に ⚑ ボタンで報告したものがここにたまります。</p>
        ) : (
          <>
            <pre className="report-list">{reportText}</pre>
            <p className="muted small">コピーして Claude Code にそのまま貼り付ければ、教材を直してもらえます。</p>
            <div className="row">
              <button className="primary" onClick={copyReports}>
                {copied ? 'コピーしました' : 'まとめてコピー'}
              </button>
              <button
                className="ghost"
                onClick={() => update((s) => ({ ...s, reports: s.reports.map((r) => ({ ...r, resolved: true })) }))}
              >
                対応済みにする
              </button>
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <h3>バックアップ</h3>
        <p className="muted small">
          学習記録と手書きメモはこの端末の中だけに保存されています。機種変更やブラウザのデータ削除に備えて、ときどき書き出しておこう。
          {persisted === true && ' （この端末では保存領域が保護されています）'}
        </p>
        <div className="row wrap">
          <button className="primary" onClick={download}>
            書き出す
          </button>
          <button className="ghost" onClick={() => fileRef.current?.click()}>
            読み込む
          </button>
          {persisted === false && (
            <button className="ghost" onClick={async () => setPersisted(await requestPersist())}>
              データ保護を要求
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = '';
            }}
          />
        </div>
      </section>

      <section className="panel danger-zone">
        <h3>リセット</h3>
        <button
          className="ghost danger"
          onClick={() => {
            if (confirm('学習記録をすべて消します（手書きメモは残ります）。本当によいですか？')) replace({ ...defaultState(), settings: st });
          }}
        >
          学習記録を消す
        </button>
      </section>
    </div>
  );
}
