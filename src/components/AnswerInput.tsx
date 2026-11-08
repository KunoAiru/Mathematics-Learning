import { useState } from 'react';
import type { AnswerSpec } from '../content/types';
import { inputHint, type UserAnswer } from '../lib/answer';
import { MdInline } from './Tex';

/** 答えの入力欄。choice は選択肢、matrix は升目、その他はテキスト。 */
export function AnswerInput({
  spec,
  disabled,
  onSubmit,
}: {
  spec: AnswerSpec;
  disabled: boolean;
  onSubmit: (a: UserAnswer) => void;
}) {
  const [text, setText] = useState('');
  const [choice, setChoice] = useState<number | null>(null);
  const rows = spec.type === 'matrix' ? spec.value.length : 0;
  const cols = spec.type === 'matrix' ? spec.value[0].length : 0;
  const [cells, setCells] = useState<string[][]>(() => Array.from({ length: rows }, () => Array(cols).fill('')));

  if (spec.type === 'self') return null;

  if (spec.type === 'choice') {
    return (
      <div className="choices">
        {spec.choices.map((c, i) => (
          <button
            key={i}
            className={`choice ${choice === i ? 'on' : ''} ${disabled && i === spec.value ? 'correct' : ''} ${disabled && choice === i && i !== spec.value ? 'wrong' : ''}`}
            disabled={disabled}
            onClick={() => {
              setChoice(i);
              onSubmit(i);
            }}
          >
            <MdInline src={c} />
          </button>
        ))}
      </div>
    );
  }

  if (spec.type === 'matrix') {
    const filled = cells.every((r) => r.every((x) => x.trim() !== ''));
    return (
      <form
        className="answer-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (filled) onSubmit(cells);
        }}
      >
        <div className="matrix-input" style={{ gridTemplateColumns: `repeat(${cols}, 4.2em)` }}>
          {cells.map((r, i) =>
            r.map((x, j) => (
              <input
                key={`${i}-${j}`}
                value={x}
                inputMode="text"
                autoComplete="off"
                disabled={disabled}
                aria-label={`${i + 1}行${j + 1}列`}
                onChange={(e) => {
                  const next = cells.map((row) => [...row]);
                  next[i][j] = e.target.value;
                  setCells(next);
                }}
              />
            )),
          )}
        </div>
        <button className="primary" type="submit" disabled={disabled || !filled}>
          答え合わせ
        </button>
      </form>
    );
  }

  return (
    <form
      className="answer-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSubmit(text);
      }}
    >
      <input
        className="answer-text"
        value={text}
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={inputHint(spec)}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="primary" type="submit" disabled={disabled || !text.trim()}>
        答え合わせ
      </button>
    </form>
  );
}
