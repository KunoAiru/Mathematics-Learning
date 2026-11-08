import { useEffect, useState } from 'react';
import { Rating, type Grade } from 'ts-fsrs';
import { CARD_BY_ID, CARDS_BY_ITEM, getItem } from '../content';
import { buildExtra, type Step } from '../store/daily';
import { dayKey, review, streak, type AppState } from '../store/state';
import { CardView } from './CardView';
import { ItemContent, KindBadge } from './ItemContent';
import { MdInline } from '../components/Tex';

interface Props {
  initial: Step[];
  /** 今日のセットなら、最後までやり終えたときに「達成」を記録する */
  daily: boolean;
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  onExit: () => void;
  openMemo: (id: string, title: string) => void;
  openReport: (itemId: string, cardId?: string) => void;
}

const stepItemId = (s: Step) => (s.kind === 'learn' ? s.itemId : CARD_BY_ID.get(s.cardId)!.itemId);

export function Session({ initial, daily, state, update, onExit, openMemo, openReport }: Props) {
  const [steps, setSteps] = useState<Step[]>(initial);
  const [i, setI] = useState(0);
  const [requeued, setRequeued] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ answered: 0, ok: 0 });

  const step = steps[i] as Step | undefined;
  const finished = !step;

  useEffect(() => {
    if (!finished || !daily) return;
    const k = dayKey(new Date());
    update((s) => (s.completed[k] ? s : { ...s, completed: { ...s.completed, [k]: true } }));
  }, [finished, daily, update]);

  const bump = (s: AppState, now: Date): AppState['activity'] => {
    const k = dayKey(now);
    return { ...s.activity, [k]: (s.activity[k] ?? 0) + 1 };
  };

  const grade = (cardId: string, g: Grade) => {
    const now = new Date();
    const itemId = CARD_BY_ID.get(cardId)!.itemId;
    if (step?.kind === 'card' && step.label === 'ドリル') {
      const ok = g !== Rating.Again;
      update((s) => {
        const prev = s.drill?.[itemId] ?? { n: 0, ok: 0 };
        // ドリルは今日のセットとは別扱い（activity に数えない）
        return { ...s, drill: { ...s.drill, [itemId]: { n: prev.n + 1, ok: prev.ok + (ok ? 1 : 0) } } };
      });
      setStats((st) => ({ answered: st.answered + 1, ok: st.ok + (ok ? 1 : 0) }));
      setI(i + 1);
      return;
    }
    update((s) => ({
      ...s,
      cards: { ...s.cards, [cardId]: review(s.cards[cardId], g, now) },
      introduced: s.introduced[itemId] ? s.introduced : { ...s.introduced, [itemId]: now.toISOString() },
      activity: bump(s, now),
    }));
    setStats((st) => ({ answered: st.answered + 1, ok: st.ok + (g === Rating.Again ? 0 : 1) }));
    // 「もう一度」はこのセッションの最後にもう一度出す（2回まで）
    if (g === Rating.Again && (requeued[cardId] ?? 0) < 2) {
      setRequeued({ ...requeued, [cardId]: (requeued[cardId] ?? 0) + 1 });
      setSteps([...steps, { kind: 'card', cardId, label: '再挑戦' }]);
    }
    setI(i + 1);
  };

  const learned = () => setI(i + 1);

  const more = (what: 'concept' | 'problem') => {
    const extra = buildExtra(state, new Date(), what);
    if (extra.length === 0) return;
    setSteps([...steps, ...extra]);
  };

  if (!step) {
    const st = streak(state.completed, new Date());
    const canConcept = buildExtra(state, new Date(), 'concept').length > 0;
    const canProblem = buildExtra(state, new Date(), 'problem').length > 0;
    return (
      <div className="session done">
        <div className="done-hero">
          <div className="flame">🔥</div>
          <div className="big">{st.days} 日連続</div>
          <p>
            {daily ? '今日のセット完了！' : 'おつかれさま！'} {stats.answered} 問に回答（{stats.ok} 問できた）
          </p>
        </div>
        <p className="muted">
          ここでやめても十分です。余力があれば:
        </p>
        <div className="col">
          <button className="ghost wide" disabled={!canConcept} onClick={() => more('concept')}>
            ＋ 新しい概念をもう1つ
          </button>
          <button className="ghost wide" disabled={!canProblem} onClick={() => more('problem')}>
            ＋ 問題をもう1問
          </button>
          <button className="primary wide" onClick={onExit}>
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  const itemId = stepItemId(step);
  const item = getItem(itemId);

  return (
    <div className="session">
      <div className="session-bar">
        <button className="icon" onClick={onExit} aria-label="中断してホームへ">
          ✕
        </button>
        <div className="progress">
          <div className="progress-fill" style={{ width: `${(i / steps.length) * 100}%` }} />
        </div>
        <span className="count">
          {i + 1}/{steps.length}
        </span>
        <button className="pill" onClick={() => openMemo(itemId, item.title)}>
          ✍️ メモ
        </button>
        <button className="icon" onClick={() => openReport(itemId, step.kind === 'card' ? step.cardId : undefined)} aria-label="誤りを報告">
          ⚑
        </button>
      </div>
      <div className="step-label">{step.kind === 'learn' ? '新しい概念' : step.label}</div>
      {step.kind === 'learn' ? (
        <div className="card" key={`learn-${i}`}>
          <div className="card-head">
            <KindBadge item={item} />
            <h2>
              <MdInline src={item.title} />
            </h2>
          </div>
          <ItemContent item={item} />
          <p className="tip">✍️ 定義や主張を、メモに自分の手で1回書き写してみよう。書くと覚える。</p>
          <button className="primary wide" onClick={learned}>
            読んだ → 確認問題へ（{(CARDS_BY_ITEM.get(itemId) ?? []).length} 枚）
          </button>
        </div>
      ) : (
        <CardView
          key={`${i}-${step.cardId}`}
          cardId={step.cardId}
          stored={state.cards[step.cardId]}
          practice={step.label === 'ドリル'}
          onGrade={(g) => grade(step.cardId, g)}
        />
      )}
    </div>
  );
}
