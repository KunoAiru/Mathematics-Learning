import { describe, expect, it } from 'vitest';
import { Rating } from 'ts-fsrs';
import { CARDS, ITEMS } from '../src/content';
import { cardsOf, ContentError, parseContent } from '../src/content/parse';
import { GENERATORS, Rng } from '../src/generators';
import { checkAnswer, parseList, parseNumber } from '../src/lib/answer';
import { mathSegments, parseBlocks } from '../src/lib/markup';
import { buildDailySet, dailyProblem, isDayComplete, isUnlocked, nextConcept, pendingCards } from '../src/store/daily';
import { addDays, dayKey, defaultState, review, streak } from '../src/store/state';

describe('答えの判定', () => {
  it('分数・全角・マイナス記号を数として読む', () => {
    expect(parseNumber('3/4')).toBe(0.75);
    expect(parseNumber('－２')).toBe(-2);
    expect(parseNumber('−0.5')).toBe(-0.5);
    expect(parseNumber('1e-3')).toBe(0.001);
    expect(parseNumber('abc')).toBeNaN();
    expect(parseNumber('1/0')).toBeNaN();
  });
  it('並びを分割する', () => {
    expect(parseList('(1, -2)')).toEqual([1, -2]);
    expect(parseList('3、 4 5')).toEqual([3, 4, 5]);
  });
  it('型ごとに判定する', () => {
    expect(checkAnswer({ type: 'numeric', value: 0.25, tol: 1e-3 }, '1/4')).toBe(true);
    expect(checkAnswer({ type: 'numeric', value: 2 }, '2.1')).toBe(false);
    expect(checkAnswer({ type: 'set', value: [3, -1] }, '-1, 3')).toBe(true);
    expect(checkAnswer({ type: 'set', value: [3, -1] }, '3')).toBe(false);
    expect(checkAnswer({ type: 'tuple', value: [3, -1] }, '-1, 3')).toBe(false);
    expect(checkAnswer({ type: 'matrix', value: [[1, 0], [0, 1]] }, [['1', '0'], ['0', '1']])).toBe(true);
    expect(checkAnswer({ type: 'choice', choices: ['a', 'b'], value: 1 }, 1)).toBe(true);
  });
});

describe('マークアップ', () => {
  it('数式・リスト・コードブロックを分ける', () => {
    const b = parseBlocks('文 $x^2$ と\n$$\\int f$$\n\n1. 一\n2. 二\n\n```\ncode $a$\n```');
    expect(b.map((x) => x.t)).toEqual(['para', 'list', 'codeblock']);
    expect(mathSegments('a $x$ b $$y$$')).toEqual([
      { tex: 'x', display: false },
      { tex: 'y', display: true },
    ]);
  });
});

describe('教材', () => {
  it('すべて読み込め、カードができる', () => {
    expect(ITEMS.length).toBeGreaterThan(40);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });
  it('構造の誤りを検出する', () => {
    expect(() => parseContent({ 'a.yaml': '- {id: a, kind: definition, subject: algebra, title: t, statement: s, requires: [zzz]}' })).toThrow(ContentError);
    expect(() =>
      parseContent({
        'a.yaml': '- {id: a, kind: definition, subject: algebra, title: t, statement: s, requires: [b]}\n- {id: b, kind: definition, subject: algebra, title: t, statement: s, requires: [a]}',
      }),
    ).toThrow(/循環/);
    expect(() => parseContent({ 'a.yaml': '- id: a\n  kind: theorem\n  subject: algebra\n  title: t\n  statement: s\n  proof:\n    - 例: 1つめ\n' })).toThrow(/文字列/);
  });
  it('定理からは想起・並べ替え・確認問題のカードができる', () => {
    const [it0] = parseContent({
      'a.yaml': '- {id: a, kind: theorem, subject: algebra, title: t, statement: s, proof: [p, q, r], questions: [{q: x, a: y}]}',
    });
    expect(cardsOf(it0).map((c) => c.id)).toEqual(['a#recall', 'a#order', 'a#q0']);
  });
});

describe('ジェネレーター', () => {
  it('どれも検算に通る', () => {
    for (const g of Object.values(GENERATORS)) {
      for (let seed = 1000; seed < 1100; seed++) expect(g.check(g.generate(new Rng(seed)), new Rng(seed)), `${g.id} seed=${seed}`).toBe(true);
    }
  });
});

describe('ストリーク', () => {
  const today = new Date(2026, 10, 8, 12);
  const act = (offsets: number[]) => Object.fromEntries(offsets.map((o) => [dayKey(addDays(today, -o)), true]));
  it('連続日数を数える', () => {
    expect(streak(act([0, 1, 2]), today).days).toBe(3);
    expect(streak(act([1, 2]), today).days).toBe(2); // 今日はまだ
    expect(streak({}, today).days).toBe(0);
  });
  it('週1回の休みは途切れない', () => {
    const r = streak(act([0, 2, 3, 4]), today);
    expect(r.days).toBe(4);
    expect(r.freezeUsed).toBe(true);
  });
  it('2日続けて休むと途切れる', () => {
    expect(streak(act([0, 3, 4]), today).days).toBe(1);
  });
  it('1週間以内に2回休むと途切れる', () => {
    expect(streak(act([0, 2, 4, 5]), today).days).toBe(2);
  });
  it('休みが1週間以上離れていれば両方許される', () => {
    expect(streak(act([0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18]), today).days).toBe(17);
  });
});

/** Session.grade と同じ更新（カードに答えると、その項目は学習済みになる） */
function answer(s: ReturnType<typeof defaultState>, cardId: string, at: Date) {
  s.cards[cardId] = review(s.cards[cardId], Rating.Good, at);
  const itemId = cardId.split('#')[0];
  s.introduced[itemId] ??= at.toISOString();
}

describe('途中でやめたとき', () => {
  const morning = new Date(2026, 10, 8, 9);
  const evening = new Date(2026, 10, 8, 20);
  it('読んだだけでやめた概念は、次も「新しい概念」として出る', () => {
    const s = defaultState();
    const first = buildDailySet(s, morning);
    const learn = first.find((x) => x.kind === 'learn')!;
    // 「読んだ」を押しても何も記録しない → ✕
    const again = buildDailySet(s, evening);
    expect(again.find((x) => x.kind === 'learn')).toEqual(learn);
    expect(isDayComplete(s, evening)).toBe(false);
  });
  it('確認カードの途中でやめると、答えていないカードだけが残る', () => {
    const s = defaultState();
    s.settings.newPerDay = 1;
    const first = buildDailySet(s, morning);
    const learn = first.find((x) => x.kind === 'learn')!;
    if (learn.kind !== 'learn') throw new Error();
    const conceptCards = first.filter((x) => x.kind === 'card' && x.cardId.startsWith(`${learn.itemId}#`));
    expect(conceptCards.length).toBeGreaterThan(1);
    const [firstCard, ...rest] = conceptCards;
    if (firstCard.kind === 'card') answer(s, firstCard.cardId, morning);
    const again = buildDailySet(s, evening);
    // 新しい概念はもう出さず、残りの確認カードは「新規」として出る
    expect(again.some((x) => x.kind === 'learn')).toBe(false);
    for (const c of rest) if (c.kind === 'card') expect(again).toContainEqual({ kind: 'card', cardId: c.cardId, label: '新規' });
    expect(pendingCards(s)).toEqual(rest.map((c) => (c.kind === 'card' ? c.cardId : '')));
  });
  it('達成は今日のセットを終えたときだけ記録され、連続日数はそれで数える', () => {
    const s = defaultState();
    s.activity[dayKey(morning)] = 3; // 何枚か答えただけ
    expect(streak(s.completed, evening).days).toBe(0);
    s.completed[dayKey(morning)] = true;
    expect(isDayComplete(s, evening)).toBe(true);
    expect(streak(s.completed, evening).days).toBe(1);
  });
});

describe('デイリーセット', () => {
  it('最初は前提のない概念から始まり、1問がつく', () => {
    const s = defaultState();
    const set = buildDailySet(s, new Date(2026, 10, 8));
    const learn = set.find((x) => x.kind === 'learn');
    expect(learn).toBeDefined();
    const c = nextConcept(s)!;
    expect(c.requires).toEqual([]);
    expect(set.some((x) => x.kind === 'card' && x.label === '今日の1問')).toBe(true);
  });
  it('1日に複数の概念を学ぶ設定では、別々の科目から選ぶ', () => {
    const s = defaultState();
    s.settings.newPerDay = 3;
    const learns = buildDailySet(s, new Date(2026, 10, 8)).filter((x) => x.kind === 'learn');
    expect(learns.length).toBe(3);
    const subjects = learns.map((x) => (x.kind === 'learn' ? ITEMS.find((i) => i.id === x.itemId)!.subject : ''));
    expect(new Set(subjects).size).toBe(3);
  });
  it('線形代数から始まる', () => {
    expect(nextConcept(defaultState())!.id).toBe('la.vector-space');
  });
  it('新しい概念と今日の1問は1日1回まで', () => {
    const s = defaultState();
    const now = new Date(2026, 10, 8, 20);
    const morning = new Date(2026, 10, 8, 9);
    for (const st of buildDailySet(s, morning)) if (st.kind === 'card') answer(s, st.cardId, morning);
    expect(buildDailySet(s, now).filter((x) => x.kind === 'learn' || (x.kind === 'card' && x.label !== '復習'))).toEqual([]);
    // 翌日はまた出る
    expect(buildDailySet(s, new Date(2026, 10, 9, 9)).some((x) => x.kind === 'learn')).toBe(true);
  });
  it('学んだ概念が前提の項目は解放される', () => {
    const s = defaultState();
    const target = ITEMS.find((i) => i.id === 'la.span')!;
    expect(isUnlocked(s, target)).toBe(false);
    s.introduced['la.vector-space'] = new Date().toISOString();
    expect(isUnlocked(s, target)).toBe(true);
  });
  it('期限が来たカードは復習に出る', () => {
    const s = defaultState();
    const now = new Date(2026, 10, 8);
    s.introduced['la.vector-space'] = now.toISOString();
    s.cards['la.vector-space#recall'] = review(undefined, Rating.Good, addDays(now, -30));
    const set = buildDailySet(s, now);
    expect(set[0]).toEqual({ kind: 'card', cardId: 'la.vector-space#recall', label: '復習' });
  });
  it('科目を絞ると他の科目は出ない', () => {
    const s = defaultState();
    s.settings.subjects = ['rust'];
    expect(nextConcept(s)!.subject).toBe('rust');
    const p = dailyProblem(s, new Date(2026, 10, 8));
    expect(p === undefined || p.subject === 'rust').toBe(true);
  });
});

describe('正解の表示', () => {
  it('行列・集合・小数を数式にする', async () => {
    const { answerMarkup } = await import('../src/lib/answer');
    expect(answerMarkup({ type: 'matrix', value: [[0, -1], [3, 10]] })).toBe('$\\begin{pmatrix} 0 & -1 \\\\ 3 & 10 \\end{pmatrix}$');
    expect(answerMarkup({ type: 'set', value: [2, -3] })).toBe('$\\{2, -3\\}$');
    expect(answerMarkup({ type: 'numeric', value: 0.123456 })).toBe('$0.1235$');
  });
});
