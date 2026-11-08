import { Rating, type Grade } from 'ts-fsrs';
import { previewIntervals, type StoredCard } from '../store/state';

const LABELS: { g: Grade; label: string; cls: string }[] = [
  { g: Rating.Again, label: 'もう一度', cls: 'again' },
  { g: Rating.Hard, label: '難しい', cls: 'hard' },
  { g: Rating.Good, label: 'できた', cls: 'good' },
  { g: Rating.Easy, label: '簡単', cls: 'easy' },
];

/** 自己評価ボタン。onlyCorrect のときは「もう一度」を出さない（自動採点で正解したとき） */
export function GradeButtons({
  card,
  onGrade,
  only,
}: {
  card: StoredCard | undefined;
  onGrade: (g: Grade) => void;
  only?: Grade[];
}) {
  const iv = previewIntervals(card, new Date());
  return (
    <div className="grades">
      {LABELS.filter((l) => !only || only.includes(l.g)).map((l) => (
        <button key={l.g} className={`grade ${l.cls}`} onClick={() => onGrade(l.g)}>
          <span>{l.label}</span>
          <small>{iv[l.g]}後</small>
        </button>
      ))}
    </div>
  );
}

export const CORRECT_GRADES: Grade[] = [Rating.Hard, Rating.Good, Rating.Easy];
