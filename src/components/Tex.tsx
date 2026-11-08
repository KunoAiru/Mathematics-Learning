import katex from 'katex';
import { useMemo } from 'react';
import { renderHtml, renderInline, parseInline } from '../lib/markup';

const cache = new Map<string, string>();

export function tex(src: string, display: boolean): string {
  const key = (display ? 'D' : 'I') + src;
  let html = cache.get(key);
  if (html === undefined) {
    try {
      html = katex.renderToString(src, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'html' });
    } catch {
      html = `<code>${src}</code>`;
    }
    cache.set(key, html);
  }
  return html;
}

/** 数式入りの教材テキスト（段落・箇条書き・コードブロック対応） */
export function Md({ src, className }: { src: string; className?: string }) {
  const html = useMemo(() => renderHtml(src, tex), [src]);
  return <div className={`md ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** 1行の数式入りテキスト（ボタンやタイトル用） */
export function MdInline({ src }: { src: string }) {
  const html = useMemo(() => renderInline(parseInline(src), tex), [src]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
