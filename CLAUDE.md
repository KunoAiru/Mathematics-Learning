# 数理道場（Mathematics-Learning）

スマホで毎日5分、数学（線形代数・確率論・統計学・抽象代数学・凸解析/最適化）と C++/Rust を学ぶ個人用 PWA。
React + Vite + TypeScript。学習記録は端末の IndexedDB だけに保存（サーバーなし）。GitHub Pages で公開。

## コマンド

- `npm run dev` 開発サーバー
- `npm run validate` 教材の検証（構造・前提関係の循環・KaTeX・ジェネレーターを各300問検算）
- `npm run validate -- --code` さらに C++/Rust のコード問題と実装演習を g++/rustc で実際にコンパイル・実行
- `npm test` ユニットテスト（vitest）
- `npm run build` validate → 型検査 → ビルド

教材や生成器を変えたら、コミット前に必ず `npm run validate -- --code && npm test` を通すこと。

## 構成

- `content/<科目>/*.yaml` 教材。1ファイルに複数項目（配列）。型は `src/content/types.ts`
- `src/generators/index.ts` 数値が毎回変わる計算問題。各ジェネレーターは `check()` で別解による検算を持つ
- `src/store/` FSRS（ts-fsrs）による復習スケジュール、デイリーセット、ストリーク、IndexedDB 保存
- `src/views/` 画面、`src/components/Memo.tsx` 手書きメモ

## 教材を書くときの約束

- 項目の種類: `definition` / `theorem`（`proof` は3ステップ以上で並べ替えカードになる）/ `problem`（`generator` か `prompt`+`answer`）/ `code`（コードを読んで答える）/ `exercise`（実装演習）
- `questions` には「仮定を外すと？（反例）」「逆は成り立つ？」「どこで使う？」を入れる。これが理解を深める本体
- `why` には研究・セキュリティ・デバッグ・実装でどう効くかを書く（学習者は工学部生で、手を動かせる人になりたい）
- `requires` は本当に必要な前提だけ。科目をまたいでよい（例: `rust.modpow` → `alg.fermat`）
- 数式は `$...$` / `$$...$$`。YAML では `|-` ブロックで書く（`: ` を含む行を引用符なしで書くとオブジェクトになって検証で落ちる）
- 出典は無料公開の教科書（`src/content/types.ts` の SUBJECTS.source）。章番号まで。文章は写さず自分の言葉で
- `code` 項目で結果を断言するなら `verify`（`build: error` / `stdout` / `panics`）を付けて実際に検証する。未定義動作の結果は断言しない
- `exercise` の `solution` は、`starter` の `// ---- 解答欄 ----` と `// ---- ここまで ----` の間（マーカーがなければ同名の関数）を置き換えると完全なプログラムになる形にする。`main` に assert を書き、検証が実行して確かめる
- C++ は `-std=c++20 -pedantic-errors` で検証される（GCC が警告で済ませる規格違反もエラーになる）。YAML のタイトルが `?` などの記号で始まるときは引用符で囲む
- 証明・主張の誤りはアプリの「⚑ 誤り報告」から集まる。報告を受けたら該当 YAML を直して validate を通す

## 学習記録との互換性

カード ID は `<項目id>#<recall|order|q0|q1…|problem|code|exercise>`。項目 id を変えたり `questions` の順番を入れ替えたりすると、端末に保存済みの復習記録と対応しなくなるので避ける（追加は末尾に）。
