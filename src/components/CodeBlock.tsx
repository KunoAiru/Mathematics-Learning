import { useState } from 'react';
import { playgroundName, playgroundUrl } from '../lib/playground';

export function CodeBlock({ code, lang, runnable = true }: { code: string; lang: 'cpp' | 'rust'; runnable?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* クリップボードが使えない環境 */
    }
  };
  return (
    <div className="codeblock">
      <div className="codeblock-bar">
        <span className="lang">{lang === 'cpp' ? 'C++' : 'Rust'}</span>
        <button className="link" onClick={copy}>
          {copied ? 'コピーしました' : 'コピー'}
        </button>
        {runnable && (
          <a className="link" href={playgroundUrl(lang, code)} target="_blank" rel="noreferrer">
            {playgroundName(lang)}で開く ↗
          </a>
        )}
      </div>
      <pre>
        <code>{code.trimEnd()}</code>
      </pre>
    </div>
  );
}
