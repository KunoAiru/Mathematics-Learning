// コードをブラウザ上の実行環境で開くリンク

const b64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

export function rustPlaygroundUrl(code: string): string {
  return `https://play.rust-lang.org/?version=stable&mode=debug&edition=2021&code=${encodeURIComponent(code)}`;
}

/** Compiler Explorer（godbolt.org）。サニタイザ付きでコンパイルし、実行結果も表示する。 */
export function compilerExplorerUrl(code: string): string {
  const compiler = 'g142';
  const options = '-std=c++20 -O1 -g -Wall -Wextra -fsanitize=address,undefined';
  const state = {
    sessions: [
      {
        id: 1,
        language: 'c++',
        source: code,
        compilers: [{ id: compiler, options }],
        executors: [
          {
            arguments: '',
            compiler: { id: compiler, libs: [], options },
            stdin: '',
            argumentsVisible: false,
            stdinVisible: false,
            compilerVisible: true,
            compilerOutputVisible: true,
          },
        ],
      },
    ],
  };
  return `https://godbolt.org/clientstate/${encodeURIComponent(b64(JSON.stringify(state)))}`;
}

export const playgroundUrl = (lang: 'cpp' | 'rust', code: string) => (lang === 'rust' ? rustPlaygroundUrl(code) : compilerExplorerUrl(code));
export const playgroundName = (lang: 'cpp' | 'rust') => (lang === 'rust' ? 'Rust Playground' : 'Compiler Explorer');
