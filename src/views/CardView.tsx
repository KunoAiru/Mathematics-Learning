import { createContext, useContext, useMemo, useState } from 'react';
import { Rating, type Grade } from 'ts-fsrs';
import { AnswerInput } from '../components/AnswerInput';
import { CodeBlock } from '../components/CodeBlock';
import { CORRECT_GRADES, GradeButtons } from '../components/Grade';
import { Md, MdInline } from '../components/Tex';
import { CARD_BY_ID, getItem } from '../content';
import type { AnswerSpec, CardDef, Item } from '../content/types';
import { generate } from '../generators';
import { answerMarkup, checkAnswer, type UserAnswer } from '../lib/answer';
import type { StoredCard } from '../store/state';
import { KindBadge } from './ItemContent';

interface Props {
  cardId: string;
  stored: StoredCard | undefined;
  onGrade: (g: Grade) => void;
  /** 練習モード（ドリル）: 復習の評価ボタンを出さず「次へ」だけにする */
  practice?: boolean;
}

/** 練習モードかどうか（自動採点の結果を Good / Again として返す） */
const PracticeContext = createContext(false);

export function CardView({ cardId, stored, onGrade, practice = false }: Props) {
  const def = CARD_BY_ID.get(cardId)!;
  const item = getItem(def.itemId);
  return (
    <PracticeContext.Provider value={practice}>
    <div className="card">
      <div className="card-head">
        <KindBadge item={item} />
        <h2>
          <MdInline src={item.title} />
        </h2>
      </div>
      <Body def={def} item={item} stored={stored} onGrade={onGrade} />
    </div>
    </PracticeContext.Provider>
  );
}

function Body({ def, item, stored, onGrade }: { def: CardDef; item: Item; stored: StoredCard | undefined; onGrade: (g: Grade) => void }) {
  switch (def.variant.type) {
    case 'recall':
      return <Recall item={item} stored={stored} onGrade={onGrade} />;
    case 'order':
      return <Order item={item} stored={stored} onGrade={onGrade} />;
    case 'question': {
      const q = item.questions![def.variant.index];
      return <Reveal prompt={q.q} answer={q.a} stored={stored} onGrade={onGrade} />;
    }
    case 'problem':
      return <Problem item={item} stored={stored} onGrade={onGrade} />;
    case 'code':
      return <Code item={item} stored={stored} onGrade={onGrade} />;
    case 'exercise':
      return <Exercise item={item} stored={stored} onGrade={onGrade} />;
  }
}

const Tip = () => <p className="tip">✍️ 右上の「メモ」に自分の手で書いてから答えを見よう</p>;

/** 質問 → 答えを見る → 自己評価 */
function Reveal({ prompt, answer, stored, onGrade }: { prompt: string; answer: string; stored: StoredCard | undefined; onGrade: (g: Grade) => void }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <div className="prompt">
        <Md src={prompt} />
      </div>
      {!shown ? (
        <>
          <Tip />
          <button className="primary wide" onClick={() => setShown(true)}>
            答えを見る
          </button>
        </>
      ) : (
        <>
          <div className="answer-box">
            <Md src={answer} />
          </div>
          <p className="muted small">自分の答えと比べて評価しよう（言葉が違っても要点が合っていれば「できた」）</p>
          <GradeButtons card={stored} onGrade={onGrade} />
        </>
      )}
    </>
  );
}

function Recall({ item, stored, onGrade }: { item: Item; stored: StoredCard | undefined; onGrade: (g: Grade) => void }) {
  if (item.kind !== 'definition' && item.kind !== 'theorem') return null;
  const prompt =
    item.kind === 'definition'
      ? `**${item.title}** の定義を述べよ。`
      : `**${item.title}** の主張を、仮定も含めて正確に述べよ。`;
  return <Reveal prompt={prompt} answer={item.statement} stored={stored} onGrade={onGrade} />;
}

/** 証明のステップを正しい順に並べる */
function Order({ item, stored, onGrade }: { item: Item; stored: StoredCard | undefined; onGrade: (g: Grade) => void }) {
  const steps = item.kind === 'theorem' ? item.proof ?? [] : [];
  const shuffled = useMemo(() => {
    const idx = steps.map((_, i) => i);
    for (let t = 0; t < 10; t++) {
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
      }
      if (idx.some((v, i) => v !== i)) break;
    }
    return idx;
  }, [steps]);
  const [picked, setPicked] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  if (item.kind !== 'theorem') return null;
  const correct = checked && picked.every((v, i) => v === i);
  return (
    <>
      <div className="prompt">
        <p>次の定理の証明のステップを、正しい順にタップして並べよ。</p>
        <div className="statement theorem">
          <Md src={item.statement} />
        </div>
      </div>
      <ol className="order-picked">
        {picked.map((v, i) => (
          <li key={v} className={checked ? (v === i ? 'ok' : 'ng') : ''} onClick={() => !checked && setPicked(picked.filter((x) => x !== v))}>
            <Md src={steps[v]} />
          </li>
        ))}
      </ol>
      {!checked && (
        <div className="order-pool">
          {shuffled
            .filter((v) => !picked.includes(v))
            .map((v) => (
              <button key={v} className="order-step" onClick={() => setPicked([...picked, v])}>
                <Md src={steps[v]} />
              </button>
            ))}
        </div>
      )}
      {!checked ? (
        <button className="primary wide" disabled={picked.length !== steps.length} onClick={() => setChecked(true)}>
          答え合わせ
        </button>
      ) : correct ? (
        <>
          <div className="result ok">✓ 正しい順番です</div>
          <GradeButtons card={stored} onGrade={onGrade} only={CORRECT_GRADES} />
        </>
      ) : (
        <>
          <div className="result ng">✗ 正しい順番:</div>
          <ol className="proof-steps">
            {steps.map((s, i) => (
              <li key={i}>
                <Md src={s} />
              </li>
            ))}
          </ol>
          <p className="muted small">なぜその順番でなければならないか（どのステップが前のステップを使っているか）を確かめよう。</p>
          <button className="primary wide" onClick={() => onGrade(Rating.Again)}>
            次へ（もう一度出題されます）
          </button>
        </>
      )}
    </>
  );
}

/** 自動採点の問題（計算問題・コード問題共通） */
function Checked({
  prompt,
  spec,
  solution,
  stored,
  onGrade,
  before,
}: {
  prompt: string;
  spec: AnswerSpec;
  solution?: string;
  stored: StoredCard | undefined;
  onGrade: (g: Grade) => void;
  before?: React.ReactNode;
}) {
  const practice = useContext(PracticeContext);
  const [result, setResult] = useState<null | boolean>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [selfShown, setSelfShown] = useState(false);
  const submit = (a: UserAnswer) => setResult(checkAnswer(spec, a));
  const done = result !== null || gaveUp;

  if (spec.type === 'self') {
    return (
      <>
        {before}
        <div className="prompt">
          <Md src={prompt} />
        </div>
        {!selfShown ? (
          <>
            <Tip />
            <button className="primary wide" onClick={() => setSelfShown(true)}>
              答えを見る
            </button>
          </>
        ) : (
          <>
            <div className="answer-box">
              <Md src={spec.value} />
            </div>
            {solution && <Md src={solution} className="solution" />}
            <GradeButtons card={stored} onGrade={onGrade} />
          </>
        )}
      </>
    );
  }

  return (
    <>
      {before}
      <div className="prompt">
        <Md src={prompt} />
      </div>
      <AnswerInput spec={spec} disabled={done} onSubmit={submit} />
      {!done && (
        <button className="link giveup" onClick={() => setGaveUp(true)}>
          わからない → 解答を見る
        </button>
      )}
      {done && (
        <>
          {result === true && <div className="result ok">✓ 正解</div>}
          {result === false && (
            <div className="result ng">
              ✗ 不正解。正解: <MdInline src={answerMarkup(spec)} />
            </div>
          )}
          {gaveUp && result === null && (
            <div className="result ng">
              正解: <MdInline src={answerMarkup(spec)} />
            </div>
          )}
          {solution && <Md src={solution} className="solution" />}
          {practice ? (
            <div className="row">
              <button className="primary wide" onClick={() => onGrade(result === true ? Rating.Good : Rating.Again)}>
                次の問題へ
              </button>
              {result === false && (
                <button className="ghost" onClick={() => onGrade(Rating.Good)}>
                  入力ミスだった
                </button>
              )}
            </div>
          ) : result === true ? (
            <GradeButtons card={stored} onGrade={onGrade} only={CORRECT_GRADES} />
          ) : (
            <div className="row">
              <button className="primary" onClick={() => onGrade(Rating.Again)}>
                次へ（もう一度出題されます）
              </button>
              {result === false && (
                <button className="ghost" onClick={() => onGrade(Rating.Hard)}>
                  入力ミスだった
                </button>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

function Problem({ item, stored, onGrade }: { item: Item; stored: StoredCard | undefined; onGrade: (g: Grade) => void }) {
  const p = useMemo(() => {
    if (item.kind !== 'problem') return null;
    if (item.generator) return generate(item.generator, Math.floor(Math.random() * 2 ** 31));
    return { prompt: item.prompt!, answer: item.answer!, solution: item.solution ?? '' };
  }, [item]);
  if (!p) return null;
  return (
    <>
      <Checked prompt={p.prompt} spec={p.answer} solution={p.solution} stored={stored} onGrade={onGrade} />
      <p className="tip">✍️ 途中式はメモに書こう。計算問題は毎回数値が変わります</p>
    </>
  );
}

function Code({ item, stored, onGrade }: { item: Item; stored: StoredCard | undefined; onGrade: (g: Grade) => void }) {
  if (item.kind !== 'code') return null;
  return (
    <Checked
      before={<CodeBlock code={item.code} lang={item.lang} />}
      prompt={item.prompt}
      spec={item.answer}
      solution={item.explanation}
      stored={stored}
      onGrade={onGrade}
    />
  );
}

function Exercise({ item, stored, onGrade }: { item: Item; stored: StoredCard | undefined; onGrade: (g: Grade) => void }) {
  const [shown, setShown] = useState(false);
  const [checks, setChecks] = useState<boolean[]>([]);
  if (item.kind !== 'exercise') return null;
  return (
    <>
      <div className="prompt">
        <Md src={item.prompt} />
      </div>
      <CodeBlock code={item.starter} lang={item.lang} />
      <p className="tip">💻 「開く」から実行環境で書いて動かそう。スマホなら PC で取り組んでから評価してもOK</p>
      {item.checklist && (
        <ul className="checklist">
          {item.checklist.map((c, i) => (
            <li key={i}>
              <label>
                <input type="checkbox" checked={!!checks[i]} onChange={(e) => setChecks(Object.assign([...checks], { [i]: e.target.checked }))} />
                <MdInline src={c} />
              </label>
            </li>
          ))}
        </ul>
      )}
      {!shown ? (
        <button className="primary wide" onClick={() => setShown(true)}>
          模範解答を見る
        </button>
      ) : (
        <>
          <div className="muted small">模範解答（一例）</div>
          <CodeBlock code={item.solution} lang={item.lang} runnable={false} />
          <GradeButtons card={stored} onGrade={onGrade} />
        </>
      )}
    </>
  );
}
