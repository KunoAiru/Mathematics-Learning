import { useState } from 'react';
import { CodeBlock } from '../components/CodeBlock';
import { Md } from '../components/Tex';
import { KIND_LABEL, subjectOf, type Item } from '../content/types';
import { formatAnswer } from '../lib/answer';

export function KindBadge({ item }: { item: Item }) {
  const s = subjectOf(item.subject);
  return (
    <span className="badge" style={{ ['--c' as string]: s.color }}>
      {s.short}・{KIND_LABEL[item.kind]}
    </span>
  );
}

/** 概念・問題の中身をまとめて表示する（学習画面・詳細画面で共通） */
export function ItemContent({ item, proofOpen = false }: { item: Item; proofOpen?: boolean }) {
  const [showProof, setShowProof] = useState(proofOpen);
  return (
    <div className="item-content">
      {(item.kind === 'definition' || item.kind === 'theorem') && (
        <>
          <div className={`statement ${item.kind}`}>
            <Md src={item.statement} />
          </div>
          {item.kind === 'theorem' && item.proof && (
            <div className="proof">
              <button className="link" onClick={() => setShowProof(!showProof)}>
                {showProof ? '▾ 証明を隠す' : '▸ 証明を見る'}（{item.proof.length} ステップ）
              </button>
              {showProof && (
                <ol className="proof-steps">
                  {item.proof.map((s, i) => (
                    <li key={i}>
                      <Md src={s} />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </>
      )}
      {item.kind === 'problem' && item.prompt && (
        <>
          <Md src={item.prompt} />
          {item.answer && (
            <details>
              <summary>答え</summary>
              <Md src={formatAnswer(item.answer)} />
              {item.solution && <Md src={item.solution} />}
            </details>
          )}
        </>
      )}
      {item.kind === 'problem' && item.generator && <p className="muted">毎回数値の変わる計算問題です。</p>}
      {item.kind === 'code' && (
        <>
          <CodeBlock code={item.code} lang={item.lang} />
          <Md src={item.prompt} />
        </>
      )}
      {item.kind === 'exercise' && (
        <>
          <Md src={item.prompt} />
          <CodeBlock code={item.starter} lang={item.lang} />
        </>
      )}
      {item.why && (
        <div className="why">
          <div className="why-label">なぜ大事？</div>
          <Md src={item.why} />
        </div>
      )}
      {item.source && <div className="source">出典: {item.source}</div>}
    </div>
  );
}
