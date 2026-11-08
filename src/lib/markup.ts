// 教材テキストの簡易マークアップ
//   $...$ 数式（インライン）, $$...$$ 数式（別行立て）, `code`, **太字**,
//   ``` で囲んだコードブロック, 空行で段落, "1. " / "- " で始まる行は箇条書き

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'math'; v: string }
  | { t: 'display'; v: string }
  | { t: 'code'; v: string }
  | { t: 'bold'; v: Inline[] };

export type Block =
  | { t: 'para'; lines: Inline[][] }
  | { t: 'list'; ordered: boolean; items: Inline[][] }
  | { t: 'codeblock'; v: string }
  | { t: 'display'; v: string };

const INLINE_RE = /\$\$([\s\S]+?)\$\$|\$((?:\\\$|[^$])+?)\$|`([^`]+)`|\*\*([\s\S]+?)\*\*/g;

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of s.matchAll(INLINE_RE)) {
    if (m.index! > last) out.push({ t: 'text', v: s.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: 'display', v: m[1] });
    else if (m[2] !== undefined) out.push({ t: 'math', v: m[2] });
    else if (m[3] !== undefined) out.push({ t: 'code', v: m[3] });
    else out.push({ t: 'bold', v: parseInline(m[4]) });
    last = m.index! + m[0].length;
  }
  if (last < s.length) out.push({ t: 'text', v: s.slice(last) });
  return out;
}

const LIST_RE = /^\s*(\d+\.|[-・])\s+/;

export function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  let buf: string[] = [];
  const flush = () => {
    const ls = buf.filter((l) => l.trim() !== '');
    buf = [];
    if (ls.length === 0) return;
    const joined = ls.join('\n').trim();
    // 段落全体が $$...$$ だけなら別行立て
    const disp = joined.match(/^\$\$([\s\S]+)\$\$$/);
    if (disp && !disp[1].includes('$$')) {
      blocks.push({ t: 'display', v: disp[1] });
      return;
    }
    if (ls.every((l) => LIST_RE.test(l))) {
      blocks.push({ t: 'list', ordered: /^\s*\d/.test(ls[0]), items: ls.map((l) => parseInline(l.replace(LIST_RE, ''))) });
      return;
    }
    // 複数行にまたがる $$ に対応するため段落を1つの文字列として解析し、改行で区切る
    const inl = parseInline(ls.join('\n'));
    const rows: Inline[][] = [[]];
    for (const x of inl) {
      if (x.t === 'text' && x.v.includes('\n')) {
        const parts = x.v.split('\n');
        parts.forEach((p, i) => {
          if (i > 0) rows.push([]);
          if (p) rows[rows.length - 1].push({ t: 'text', v: p });
        });
      } else rows[rows.length - 1].push(x);
    }
    blocks.push({ t: 'para', lines: rows.filter((r) => r.length > 0) });
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim().startsWith('```')) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++]);
      blocks.push({ t: 'codeblock', v: code.join('\n') });
      continue;
    }
    if (l.trim() === '') flush();
    else buf.push(l);
  }
  flush();
  return blocks;
}

/** テキスト中のすべての数式（検証用） */
export function mathSegments(src: string): { tex: string; display: boolean }[] {
  const out: { tex: string; display: boolean }[] = [];
  const walk = (xs: Inline[]) => {
    for (const x of xs) {
      if (x.t === 'math') out.push({ tex: x.v, display: false });
      else if (x.t === 'display') out.push({ tex: x.v, display: true });
      else if (x.t === 'bold') walk(x.v);
    }
  };
  for (const b of parseBlocks(src)) {
    if (b.t === 'display') out.push({ tex: b.v, display: true });
    else if (b.t === 'para') b.lines.forEach(walk);
    else if (b.t === 'list') b.items.forEach(walk);
  }
  return out;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export type TexRender = (tex: string, display: boolean) => string;

export function renderInline(xs: Inline[], tex: TexRender): string {
  return xs
    .map((x) => {
      switch (x.t) {
        case 'text':
          return esc(x.v);
        case 'math':
          return tex(x.v, false);
        case 'display':
          return `<div class="display">${tex(x.v, true)}</div>`;
        case 'code':
          return `<code>${esc(x.v)}</code>`;
        case 'bold':
          return `<strong>${renderInline(x.v, tex)}</strong>`;
      }
    })
    .join('');
}

export function renderHtml(src: string, tex: TexRender): string {
  return parseBlocks(src)
    .map((b) => {
      switch (b.t) {
        case 'para':
          return `<p>${b.lines.map((l) => renderInline(l, tex)).join('<br>')}</p>`;
        case 'list': {
          const tag = b.ordered ? 'ol' : 'ul';
          return `<${tag}>${b.items.map((it) => `<li>${renderInline(it, tex)}</li>`).join('')}</${tag}>`;
        }
        case 'codeblock':
          return `<pre class="code"><code>${esc(b.v)}</code></pre>`;
        case 'display':
          return `<div class="display">${tex(b.v, true)}</div>`;
      }
    })
    .join('');
}
