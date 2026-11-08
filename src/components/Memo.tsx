import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { deleteMemo, loadMemo, saveMemo, type Memo, type Stroke } from '../store/persist';

// 座標は「キャンバス幅 = 1」で正規化して保存する（画面の回転や機種変更でも崩れない）

const COLORS = [
  { c: '#111827', name: '黒' },
  { c: '#2563eb', name: '青' },
  { c: '#dc2626', name: '赤' },
];
const WIDTHS = [
  { w: 0.004, name: '細' },
  { w: 0.008, name: '太' },
];
const DEFAULT_HEIGHT = 2.2; // 幅に対する高さの比
const ERASER_R = 0.025;

type Tool = 'pen' | 'eraser' | 'scroll';

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, W: number) {
  const p = s.points;
  if (p.length < 3) return;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (p.length === 3) {
    ctx.beginPath();
    ctx.arc(p[0] * W, p[1] * W, (s.width * W * (0.5 + p[2])) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let i = 3; i < p.length; i += 3) {
    ctx.beginPath();
    ctx.lineWidth = Math.max(0.6, s.width * W * (0.5 + (p[i - 1] + p[i + 2]) / 2));
    ctx.moveTo(p[i - 3] * W, p[i - 2] * W);
    ctx.lineTo(p[i] * W, p[i + 1] * W);
    ctx.stroke();
  }
}

/** 一覧用のサムネイル */
export function MemoThumb({ memo }: { memo: Memo }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const W = 160;
    const H = 110;
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr;
    cv.height = H * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(0, 0, W, H);
    for (const s of memo.strokes) drawStroke(ctx, s, W);
  }, [memo]);
  return <canvas ref={ref} className="memo-thumb" style={{ width: 160, height: 110 }} />;
}

interface Props {
  id: string;
  title: string;
  penOnly: boolean;
  onClose: () => void;
  /** 指定するとゴミ箱ボタンでメモごと削除できる */
  deletable?: boolean;
}

export function MemoEditor({ id, title, penOnly, onClose, deletable }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [W, setW] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [undo, setUndo] = useState<Stroke[][]>([]);
  const [redo, setRedo] = useState<Stroke[][]>([]);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0].c);
  const [width, setWidth] = useState(WIDTHS[0].w);
  const live = useRef<{ stroke: Stroke | null; pointerId: number | null; scrollY: number | null; erased: boolean; before: Stroke[] }>({
    stroke: null,
    pointerId: null,
    scrollY: null,
    erased: false,
    before: [],
  });
  const strokesRef = useRef<Stroke[]>([]);
  strokesRef.current = strokes;
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    loadMemo(id).then((m) => {
      if (!alive) return;
      if (m) {
        setStrokes(m.strokes);
        setHeight(m.height || DEFAULT_HEIGHT);
      }
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const persist = useCallback(
    (ss: Stroke[], h: number) => {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void saveMemo({ id, title, strokes: ss, height: h, updatedAt: new Date().toISOString() });
      }, 400);
    },
    [id, title],
  );

  const redraw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || W === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const H = height * W;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const s of strokes) drawStroke(ctx, s, W);
  }, [W, height, strokes, loaded]);

  useEffect(redraw, [redraw]);

  const commit = (next: Stroke[], before: Stroke[]) => {
    setUndo((u) => [...u.slice(-99), before]);
    setRedo([]);
    setStrokes(next);
    persist(next, height);
  };

  const pos = (e: React.PointerEvent | PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / W, (e.clientY - r.top) / W];
  };
  const pressure = (e: PointerEvent | React.PointerEvent) => (e.pointerType === 'pen' ? Math.max(0.05, e.pressure || 0.5) : 0.5);

  const eraseAt = (x: number, y: number) => {
    const cur = strokesRef.current;
    const keep = cur.filter((s) => {
      for (let i = 0; i < s.points.length; i += 3) {
        const dx = s.points[i] - x;
        const dy = s.points[i + 1] - y;
        if (dx * dx + dy * dy < ERASER_R * ERASER_R) return false;
      }
      return true;
    });
    if (keep.length !== cur.length) {
      live.current.erased = true;
      strokesRef.current = keep;
      setStrokes(keep);
    }
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (live.current.pointerId !== null) return; // 2本目の指・手のひらは無視
    const fingerScroll = tool === 'scroll' || (penOnly && e.pointerType === 'touch');
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current.pointerId = e.pointerId;
    if (fingerScroll) {
      live.current.scrollY = e.clientY;
      return;
    }
    const [x, y] = pos(e);
    if (tool === 'eraser') {
      live.current.before = strokesRef.current;
      live.current.erased = false;
      eraseAt(x, y);
      return;
    }
    live.current.stroke = { color, width, points: [x, y, pressure(e)] };
    const ctx = canvasRef.current!.getContext('2d')!;
    drawStroke(ctx, live.current.stroke, W);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId !== live.current.pointerId) return;
    if (live.current.scrollY !== null) {
      const dy = e.clientY - live.current.scrollY;
      live.current.scrollY = e.clientY;
      wrapRef.current!.parentElement!.scrollTop -= dy;
      return;
    }
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    if (tool === 'eraser') {
      for (const ev of events) {
        const [x, y] = pos(ev);
        eraseAt(x, y);
      }
      return;
    }
    const s = live.current.stroke;
    if (!s) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    for (const ev of events) {
      const [x, y] = pos(ev);
      s.points.push(x, y, pressure(ev));
    }
    // 増えた部分だけ描く
    const n = s.points.length;
    const from = Math.max(0, n - 3 * (events.length + 1));
    drawStroke(ctx, { ...s, points: s.points.slice(from) }, W);
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId !== live.current.pointerId) return;
    live.current.pointerId = null;
    if (live.current.scrollY !== null) {
      live.current.scrollY = null;
      return;
    }
    if (tool === 'eraser') {
      if (live.current.erased) commit(strokesRef.current, live.current.before);
      return;
    }
    const s = live.current.stroke;
    live.current.stroke = null;
    if (s) commit([...strokes, { ...s, points: s.points.map((v) => Math.round(v * 1e4) / 1e4) }], strokes);
  };

  const doUndo = () => {
    if (undo.length === 0) return;
    const prev = undo[undo.length - 1];
    setUndo(undo.slice(0, -1));
    setRedo([...redo, strokes]);
    setStrokes(prev);
    persist(prev, height);
  };
  const doRedo = () => {
    if (redo.length === 0) return;
    const next = redo[redo.length - 1];
    setRedo(redo.slice(0, -1));
    setUndo([...undo, strokes]);
    setStrokes(next);
    persist(next, height);
  };
  const clearAll = () => {
    if (strokes.length === 0 || !confirm('このページを全部消しますか？（「元に戻す」で戻せます）')) return;
    commit([], strokes);
  };
  const extend = () => {
    const h = height + 1;
    setHeight(h);
    persist(strokes, h);
  };
  const close = async () => {
    window.clearTimeout(saveTimer.current);
    if (strokes.length > 0 || (await loadMemo(id))) {
      await saveMemo({ id, title, strokes, height, updatedAt: new Date().toISOString() });
    }
    onClose();
  };
  const remove = async () => {
    if (!confirm('このノートを削除しますか？')) return;
    window.clearTimeout(saveTimer.current);
    await deleteMemo(id);
    onClose();
  };

  return (
    <div className="memo-overlay" role="dialog" aria-label={`メモ: ${title}`}>
      <div className="memo-toolbar">
        <button className="tb close" onClick={close} aria-label="閉じる">
          ✓ 閉じる
        </button>
        <div className="tb-group">
          {COLORS.map((c) => (
            <button
              key={c.c}
              className={`tb swatch ${tool === 'pen' && color === c.c ? 'on' : ''}`}
              style={{ ['--sw' as string]: c.c }}
              onClick={() => {
                setTool('pen');
                setColor(c.c);
              }}
              aria-label={`ペン（${c.name}）`}
            />
          ))}
          {WIDTHS.map((w) => (
            <button key={w.name} className={`tb ${width === w.w ? 'on' : ''}`} onClick={() => setWidth(w.w)}>
              {w.name}
            </button>
          ))}
        </div>
        <div className="tb-group">
          <button className={`tb ${tool === 'eraser' ? 'on' : ''}`} onClick={() => setTool('eraser')} aria-label="消しゴム">
            消
          </button>
          <button className={`tb ${tool === 'scroll' ? 'on' : ''}`} onClick={() => setTool('scroll')} aria-label="スクロール">
            ✋
          </button>
          <button className="tb" onClick={doUndo} disabled={undo.length === 0} aria-label="元に戻す">
            ↶
          </button>
          <button className="tb" onClick={doRedo} disabled={redo.length === 0} aria-label="やり直す">
            ↷
          </button>
        </div>
        <div className="tb-group">
          <button className="tb" onClick={extend} aria-label="下に余白を追加">
            ＋紙
          </button>
          <button className="tb" onClick={clearAll} aria-label="全消去">
            全消
          </button>
          {deletable && (
            <button className="tb danger" onClick={remove} aria-label="ノートを削除">
              削除
            </button>
          )}
        </div>
      </div>
      <div className="memo-title">{title}</div>
      <div className="memo-scroll">
        <div className="memo-paper" ref={wrapRef} style={{ height: W ? height * W : undefined }}>
          {loaded && (
            <canvas
              ref={canvasRef}
              style={{ width: W, height: height * W }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            />
          )}
        </div>
        <button className="memo-more" onClick={extend}>
          ＋ 紙を足す
        </button>
      </div>
      {penOnly && <div className="memo-hint">ペンのみモード: 指でスクロール、ペンで書く</div>}
    </div>
  );
}
