import { getItem, ITEMS } from '../content';
import { isConcept, SUBJECTS } from '../content/types';
import { buildDailySet, buildExtra, masteryOf, type Step } from '../store/daily';
import { addDays, dayKey, streak, type AppState } from '../store/state';
import { MdInline } from '../components/Tex';

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

export function Today({ state, start }: { state: AppState; start: (steps: Step[]) => void }) {
  const now = new Date();
  const set = buildDailySet(state, now);
  const reviews = set.filter((s) => s.kind === 'card' && s.label === '復習').length;
  const learn = set.find((s) => s.kind === 'learn');
  const problem = set.find((s) => s.kind === 'card' && s.label === '今日の1問');
  const problemItem = problem && problem.kind === 'card' ? getItem(problem.cardId.split('#')[0]) : undefined;
  const doneToday = (state.activity[dayKey(now)] ?? 0) > 0;
  const st = streak(state.activity, now);
  const minutes = Math.max(3, Math.round(reviews * 0.4 + (learn ? 3 : 0) + (problemItem ? 3 : 0)));
  const days = Array.from({ length: 7 }, (_, k) => addDays(now, k - 6));

  const concepts = ITEMS.filter((it) => isConcept(it) && state.settings.subjects.includes(it.subject));
  const learnedCount = concepts.filter((it) => state.introduced[it.id]).length;
  const masteredCount = concepts.filter((it) => masteryOf(state, it) === 'mastered').length;
  const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;

  return (
    <div className="page today">
      <header className="streak">
        <div className="streak-num">
          <span className="flame">{st.days > 0 ? '🔥' : '🌱'}</span>
          <span className="big">{st.days}</span>
          <span>日連続</span>
        </div>
        <div className="week">
          {days.map((d) => {
            const k = dayKey(d);
            const on = (state.activity[k] ?? 0) > 0;
            return (
              <div key={k} className={`day ${on ? 'on' : ''} ${k === dayKey(now) ? 'today' : ''}`}>
                <div className="dot" />
                <small>{WEEK[d.getDay()]}</small>
              </div>
            );
          })}
        </div>
        <p className="muted small">
          週に1日までは休んでも連続が途切れません{st.freezeUsed ? '（今週のおやすみは使用済み）' : ''}
        </p>
      </header>

      {set.length > 0 ? (
        <section className="panel">
          <h3>{doneToday ? '続きをやる' : '今日のセット'}</h3>
          <ul className="plan">
            <li>
              <span className="plan-k">復習</span>
              <span>{reviews > 0 ? `${reviews} 枚` : 'なし'}</span>
            </li>
            <li>
              <span className="plan-k">新しい概念</span>
              <span>{learn && learn.kind === 'learn' ? <MdInline src={getItem(learn.itemId).title} /> : '—'}</span>
            </li>
            <li>
              <span className="plan-k">今日の1問</span>
              <span>{problemItem ? <MdInline src={problemItem.title} /> : '—'}</span>
            </li>
          </ul>
          <button className="primary wide big-btn" onClick={() => start(set)}>
            はじめる（約 {minutes} 分）
          </button>
          <p className="muted small center">1枚だけでも今日は達成。疲れた日は最初の1枚だけやろう。</p>
        </section>
      ) : (
        <section className="panel">
          <h3>{doneToday ? '今日は達成 ✓' : 'いま出題できるものはありません'}</h3>
          <div className="col">
            <button className="ghost wide" onClick={() => start(buildExtra(state, now, 'concept'))} disabled={buildExtra(state, now, 'concept').length === 0}>
              ＋ 新しい概念を学ぶ
            </button>
            <button className="ghost wide" onClick={() => start(buildExtra(state, now, 'problem'))} disabled={buildExtra(state, now, 'problem').length === 0}>
              ＋ 問題を解く
            </button>
          </div>
        </section>
      )}

      <section className="panel">
        <h3>全体の進み具合</h3>
        <div className="totals">
          <div>
            <b>{learnedCount}</b>
            <small>学習済み</small>
          </div>
          <div>
            <b>{masteredCount}</b>
            <small>定着</small>
          </div>
          <div>
            <b>{concepts.length}</b>
            <small>概念の総数</small>
          </div>
        </div>
        {SUBJECTS.filter((s) => state.settings.subjects.includes(s.id)).map((s) => {
          const cs = ITEMS.filter((it) => it.subject === s.id);
          const learned = cs.filter((it) => state.introduced[it.id]).length;
          const mastered = cs.filter((it) => masteryOf(state, it) === 'mastered').length;
          return (
            <div key={s.id} className="subject-row">
              <span className="subject-name">{s.name}</span>
              <div className="bar">
                <div className="bar-learned" style={{ width: `${(learned / cs.length) * 100}%`, background: s.color }} />
                <div className="bar-mastered" style={{ width: `${(mastered / cs.length) * 100}%`, background: s.color }} />
              </div>
              <span className="muted small">
                {learned}/{cs.length}
              </span>
            </div>
          );
        })}
      </section>

      {!standalone && (
        <section className="panel hint">
          <b>ホーム画面に追加しよう</b>
          <p className="small">
            iPhone: Safari の共有ボタン →「ホーム画面に追加」。Android: Chrome のメニュー →「ホーム画面に追加」。アプリとして全画面で開け、学習記録が消えにくくなります。
          </p>
        </section>
      )}
    </div>
  );
}
