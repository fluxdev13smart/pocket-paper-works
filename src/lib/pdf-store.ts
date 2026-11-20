import { useSyncExternalStore } from "react";

export type Tool = "select" | "cut" | "marker" | "highlighter" | "eraser";

export type Op =
  | { id: string; kind: "stroke"; tool: "marker" | "highlighter"; color: string; size: number; points: [number, number][] }
  | { id: string; kind: "rect"; x: number; y: number; w: number; h: number };

/** Coordinates are normalized 0..1 relative to the page so they survive zoom. */
export interface PdfState {
  name: string | null;
  bytes: Uint8Array | null;
  pageCount: number;
  excluded: number[];
  ops: Record<number, Op[]>;
  past: Record<number, Op[]>[];
  future: Record<number, Op[]>[];
}

const empty: PdfState = { name: null, bytes: null, pageCount: 0, excluded: [], ops: {}, past: [], future: [] };
let state: PdfState = empty;
const subs = new Set<() => void>();
const set = (s: Partial<PdfState>) => {
  state = { ...state, ...s };
  subs.forEach((f) => f());
};

export const pdfStore = {
  get: () => state,
  subscribe(f: () => void) {
    subs.add(f);
    return () => subs.delete(f);
  },
  load(name: string, bytes: Uint8Array, pageCount: number) {
    set({ ...empty, name, bytes, pageCount });
  },
  close() {
    set(empty);
  },
  toggleExcluded(page: number) {
    const ex = state.excluded.includes(page) ? state.excluded.filter((p) => p !== page) : [...state.excluded, page];
    if (ex.length >= state.pageCount) return; // keep at least one page
    set({ excluded: ex });
  },
  commit(ops: Record<number, Op[]>) {
    set({ past: [...state.past, state.ops].slice(-100), future: [], ops });
  },
  addOp(page: number, op: Op) {
    pdfStore.commit({ ...state.ops, [page]: [...(state.ops[page] ?? []), op] });
  },
  removeOps(page: number, ids: string[]) {
    if (!ids.length) return;
    pdfStore.commit({ ...state.ops, [page]: (state.ops[page] ?? []).filter((o) => !ids.includes(o.id)) });
  },
  undo() {
    const prev = state.past[state.past.length - 1];
    if (!prev) return;
    set({ ops: prev, past: state.past.slice(0, -1), future: [state.ops, ...state.future] });
  },
  redo() {
    const [next, ...rest] = state.future;
    if (!next) return;
    set({ ops: next, past: [...state.past, state.ops], future: rest });
  },
};

export function usePdfStore() {
  return useSyncExternalStore(pdfStore.subscribe, pdfStore.get, () => empty);
}

export function drawOps(ctx: CanvasRenderingContext2D, ops: Op[], w: number, h: number) {
  for (const op of ops) {
    if (op.kind === "rect") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(op.x * w, op.y * h, op.w * w, op.h * h);
      continue;
    }
    ctx.save();
    ctx.strokeStyle = op.color;
    ctx.lineCap = op.tool === "highlighter" ? "butt" : "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = op.size * w * (op.tool === "highlighter" ? 3 : 1);
    ctx.globalAlpha = op.tool === "highlighter" ? 0.38 : 1;
    if (op.tool === "highlighter") ctx.globalCompositeOperation = "multiply";
    ctx.beginPath();
    op.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
    if (op.points.length === 1) ctx.lineTo(op.points[0]![0] * w + 0.1, op.points[0]![1] * h);
    ctx.stroke();
    ctx.restore();
  }
}

/** Builds a brand-new PDF. Pages with cutouts are flattened to images so the hidden content is truly gone. */
export async function exportEditedPdf(onP: (p: number) => void): Promise<Blob> {
  const s = pdfStore.get();
  if (!s.bytes) throw new Error("No PDF loaded");
  const { PDFDocument } = await import("pdf-lib");
  const { openPdf } = await import("./pdfjs");
  const src = await PDFDocument.load(s.bytes.slice(), { ignoreEncryption: true });
  const view = await openPdf(s.bytes);
  const out = await PDFDocument.create();
  const keep = Array.from({ length: s.pageCount }, (_, i) => i + 1).filter((p) => !s.excluded.includes(p));
  const toPng = async (c: HTMLCanvasElement) =>
    new Uint8Array(await (await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"))).arrayBuffer());
  for (let k = 0; k < keep.length; k++) {
    const p = keep[k]!;
    const ops = s.ops[p] ?? [];
    const hasCut = ops.some((o) => o.kind === "rect");
    const page = await view.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    if (hasCut) {
      const scale = 2.5;
      const v2 = page.getViewport({ scale });
      const c = document.createElement("canvas");
      c.width = Math.floor(v2.width);
      c.height = Math.floor(v2.height);
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvas: c, canvasContext: ctx, viewport: v2 }).promise;
      drawOps(ctx, ops, c.width, c.height);
      const img = await out.embedPng(await toPng(c));
      const np = out.addPage([vp.width, vp.height]);
      np.drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
    } else {
      const [copied] = await out.copyPages(src, [p - 1]);
      const np = out.addPage(copied!);
      if (ops.length) {
        const c = document.createElement("canvas");
        c.width = Math.floor(vp.width * 2.5);
        c.height = Math.floor(vp.height * 2.5);
        drawOps(c.getContext("2d")!, ops, c.width, c.height);
        const img = await out.embedPng(await toPng(c));
        const { width, height } = np.getSize();
        np.drawImage(img, { x: 0, y: 0, width, height });
      }
    }
    onP((k + 1) / keep.length);
  }
  out.setProducer("AnyConvert Local");
  out.setCreator("AnyConvert Local");
  return new Blob([await out.save()], { type: "application/pdf" });
}
