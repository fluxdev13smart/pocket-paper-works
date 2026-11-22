import { createFileRoute, Link } from "@tanstack/react-router";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ArrowRight, ClipboardPaste, Copy, Eraser, Highlighter, LayoutGrid, Loader2, MousePointer2, Pen, Redo2, Scissors, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CutoutSelection } from "@/components/pdf-cutout-selection";
import { hitsStroke, pasteRegion, prepareCutout, type Region } from "@/lib/pdf-cutout";
import { OpenPdf, PageThumb, usePdfDoc } from "@/components/pdf-common";
import { PageShell } from "@/components/shell";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { downloadBlob } from "@/lib/download";
import { baseName } from "@/lib/formats";
import { drawOps, exportEditedPdf, pdfStore, usePdfStore, type Op, type Tool } from "@/lib/pdf-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/editor")({
  head: () => ({
    meta: [
      { title: "PDF Markup Studio — AnyConvert Local" },
      { name: "description", content: "Preview, mark up, highlight and cut out content from PDFs entirely in your browser, then export a clean new PDF." },
      { property: "og:title", content: "PDF Markup Studio — AnyConvert Local" },
      { property: "og:description", content: "Marker, highlighter, color wheel and scissor cutouts. Nothing is uploaded." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Editor,
});

const SWATCHES = ["#FFFFFF", "#F59E0B", "#222222", "#EF4444"];
const SIZES = [0.002, 0.004, 0.008];

function Editor() {
  const s = usePdfStore();
  const doc = usePdfDoc(s.bytes);
  if (!s.bytes)
    return (
      <PageShell>
        <OpenPdf title="Open a PDF to mark up" hint="Scroll through it normally, draw with marker or highlighter, and cut out anything you don't want in the export." />
      </PageShell>
    );
  return <Studio doc={doc} />;
}

function Studio({ doc }: { doc: PDFDocumentProxy | null }) {
  const s = usePdfStore();
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState("#EF4444");
  const [size, setSize] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [current, setCurrent] = useState(1);
  const [drawer, setDrawer] = useState(false);
  const [exporting, setExporting] = useState<number | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const pages = Array.from({ length: s.pageCount }, (_, i) => i + 1).filter((p) => !s.excluded.includes(p));

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (exporting !== null || (e.target instanceof HTMLElement && (e.target.matches("input,textarea,select") || e.target.isContentEditable))) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v" && pdfStore.get().clipboard) { e.preventDefault(); setTool("paste"); return; }
      if (e.key === "Escape") { setTool("select"); setSelected(null); return; }
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) pdfStore.redo();
      else pdfStore.undo();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [exporting]);

  useEffect(() => {
    let frame = 0;
    const updateCurrent = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const entries = Object.entries(pageRefs.current).flatMap(([page, element]) => element ? [{ page: Number(page), rect: element.getBoundingClientRect() }] : []);
        const visible = entries.filter(entry => entry.rect.bottom > 100 && entry.rect.top < window.innerHeight);
        const nearest = visible.sort((a, b) => Math.abs(a.rect.top - 110) - Math.abs(b.rect.top - 110))[0];
        if (nearest) setCurrent(nearest.page);
      });
    };
    updateCurrent();
    window.addEventListener("scroll", updateCurrent, { passive: true });
    window.addEventListener("resize", updateCurrent);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", updateCurrent); window.removeEventListener("resize", updateCurrent); };
  }, [doc, s.excluded, zoom]);

  const doExport = async () => {
    setExporting(0);
    try {
      const blob = await exportEditedPdf((p) => setExporting(p));
      downloadBlob(blob, `${baseName(s.name ?? "document")}-edited.pdf`);
      toast.success("Edited PDF saved. Your original file is untouched.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const goTo = (p: number) => pageRefs.current[p]?.scrollIntoView({ behavior: "smooth", block: "start" });
  const counterIndex = pages.indexOf(current) + 1 || 1;

  return (
    <div className="min-h-screen pb-40">
      <header className="sticky top-0 z-30 px-3 pt-5 md:px-8">
        <div className="mx-auto flex h-14 max-w-[1216px] items-center justify-between gap-3 rounded-full border border-hairline bg-card/85 pl-5 pr-1.5 shadow-[0_20px_50px_-25px_rgba(0,0,0,.8)] backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" title="Back to Convert" className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary text-[10px] text-muted-foreground hover:text-foreground">
              PDF
            </Link>
            <span className="kit-display truncate text-[16px] font-bold text-foreground">{s.name}</span>
            <Button variant="unstyled" size="unstyled" onClick={() => pdfStore.close()} title="Close document" disabled={exporting !== null} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <div className="flex items-center rounded-full border border-hairline px-1">
              <Button variant="unstyled" size="unstyled" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} className="px-3 py-1.5 text-muted-foreground hover:text-foreground">
                −
              </Button>
              <span className="tabular w-12 text-center font-mono text-[13px] text-foreground">{Math.round(zoom * 100)}%</span>
              <Button variant="unstyled" size="unstyled" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)))} className="px-3 py-1.5 text-muted-foreground hover:text-foreground">
                +
              </Button>
            </div>
            <span className="rounded-full border border-hairline px-4 py-1.5 text-[13px] text-muted-foreground">
              Page <b className="tabular text-foreground">{counterIndex}</b> of {pages.length}
            </span>
            <Button variant="unstyled" size="unstyled" onClick={() => setDrawer(true)} className="flex items-center gap-2 rounded-full border border-hairline px-4 py-1.5 text-[13px] text-foreground hover:bg-secondary">
              <LayoutGrid className="h-3.5 w-3.5" /> Pages
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="unstyled" size="unstyled" onClick={() => setDrawer(true)} aria-label="Pages" className="grid h-9 w-9 place-items-center rounded-full border border-hairline text-foreground md:hidden">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant="unstyled" size="unstyled"
              onClick={doExport}
              disabled={exporting !== null || !doc}
              className="flex items-center gap-3 rounded-full bg-primary py-1.5 pl-5 pr-1.5 text-[13px] font-bold text-primary-foreground disabled:opacity-60 sm:pl-6"
            >
              {exporting !== null ? `Exporting ${Math.round(exporting * 100)}%` : <><span className="hidden sm:inline">Export Edited PDF</span><span className="sm:hidden">Export</span></>}
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-foreground/10">
                {exporting !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </span>
            </Button>
          </div>
        </div>
        <div className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-full border border-hairline bg-card/95 px-2 py-1 text-muted-foreground md:hidden">
          <Button variant="ghost" size="icon" aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(2)))}>−</Button>
          <span className="w-12 text-center font-mono text-xs">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" aria-label="Zoom in" disabled={zoom >= 2.5} onClick={() => setZoom(z => Math.min(2.5, +(z + 0.1).toFixed(2)))}>+</Button>
          <span className="px-2 text-xs">Page {counterIndex} of {pages.length}</span>
        </div>
      </header>

      <main className="mt-8 flex flex-col items-center gap-6 overflow-x-auto px-3">
        {!doc ? (
          <div className="flex items-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Rendering pages in memory…
          </div>
        ) : (
          pages.map((p) => (
            <div className="mx-auto shrink-0 scroll-mt-28" key={p} ref={(el) => void (pageRefs.current[p] = el)} data-page={p}>
              <PdfPage doc={doc} page={p} zoom={zoom} tool={tool} color={color} size={SIZES[size] ?? 0.004} ops={s.ops[p] ?? []} selected={selected} onSelect={setSelected} onTool={setTool} disabled={exporting !== null} />
            </div>
          ))
        )}
      </main>

      <MarkupDock tool={tool} setTool={setTool} color={color} setColor={setColor} size={size} setSize={setSize} canUndo={s.past.length > 0} canRedo={s.future.length > 0} canPaste={!!s.clipboard} disabled={exporting !== null} />

      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="right" className="flex h-dvh w-[340px] max-w-full flex-col overflow-hidden border-hairline bg-card p-0 sm:max-w-[340px]">
          <SheetHeader className="shrink-0 px-5 pb-3 pt-6">
            <SheetTitle className="kit-display text-foreground">Pages</SheetTitle>
            <SheetDescription>{pages.length} of {s.pageCount} pages included</SheetDescription>
          </SheetHeader>
          <div role="region" aria-label="Page selection" tabIndex={0} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
          <div className="grid grid-cols-2 items-start gap-4">
            {doc &&
              Array.from({ length: s.pageCount }, (_, i) => i + 1).map((p) => (
                <PageThumb
                  key={p}
                  doc={doc}
                  page={p}
                  width={130}
                  disabled={exporting !== null}
                  excluded={s.excluded.includes(p)}
                  onToggle={() => {
                    if (exporting !== null) return;
                    if (!s.excluded.includes(p) && s.excluded.length + 1 >= s.pageCount) toast.error("Keep at least one page.");
                    pdfStore.toggleExcluded(p);
                  }}
                  onOpen={() => {
                    setDrawer(false);
                    setTimeout(() => goTo(p), 250);
                  }}
                />
              ))}
          </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PdfPage({ doc, page, zoom, tool, color, size, ops, selected, onSelect, onTool, disabled }: { doc: PDFDocumentProxy; page: number; zoom: number; tool: Tool; color: string; size: number; ops: Op[]; selected: string | null; onSelect: (id: string | null) => void; onTool: (tool: Tool) => void; disabled: boolean }) {
  const base = useRef<HTMLCanvasElement>(null);
  const over = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [viewportWidth, setViewportWidth] = useState(644);
  const [visible, setVisible] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const draft = useRef<Op | null>(null);
  const erasing = useRef<string[]>([]);
  const [preview, setPreview] = useState<{ id: string; region: Region } | null>(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    const resize = () => setViewportWidth(window.innerWidth);
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    let active = true;
    void doc.getPage(page).then((p) => {
      const vp = p.getViewport({ scale: 1 });
      if (active) setDims({ w: vp.width, h: vp.height });
    }).catch(() => {});
    return () => { active = false; };
  }, [doc, page]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setVisible(true), { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [dims]);

  const cssW = dims ? Math.min(620, viewportWidth - 24) * zoom : Math.min(620, viewportWidth - 24);
  const cssH = dims ? (cssW * dims.h) / dims.w : 800;

  useEffect(() => {
    if (!visible || !dims || !base.current) return;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    let active = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    void doc.getPage(page).then((p) => {
      const c = base.current;
      if (!c || !active) return;
      const vp = p.getViewport({ scale: (cssW * dpr) / dims.w });
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      task = p.render({ canvas: c, canvasContext: ctx, viewport: vp });
      task.promise.catch(() => {});
    }).catch(() => {});
    return () => { active = false; task?.cancel(); };
  }, [visible, dims, doc, page, cssW]);

  const redraw = useCallback(() => {
    const c = over.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.floor(cssW * dpr);
    c.height = Math.floor(cssH * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const shown = ops.filter((o) => !erasing.current.includes(o.id)).map(op => op.kind === "image" && op.id === preview?.id ? { ...op, ...preview.region } : op);
    const all = draft.current ? [...shown, draft.current] : shown;
    drawOps(ctx, all, c.width, c.height);
    ctx.save();
    ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.strokeStyle = "rgba(245,158,11,0.7)";
    ctx.lineWidth = dpr;
    for (const o of all) if (o.kind === "rect") ctx.strokeRect(o.x * c.width, o.y * c.height, o.w * c.width, o.h * c.height);
    ctx.restore();
  }, [ops, cssW, cssH, preview]);

  useEffect(redraw, [redraw]);

  const pt = (e: React.PointerEvent): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };

  const hit = (x: number, y: number) => {
    const tol = 0.012;
    return ops
      .filter((o) => {
        if (o.kind === "rect" || o.kind === "image") return x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h;
        const ratio = cssH / cssW;
        return hitsStroke(o.points, x, y, ratio, tol + o.size * (o.tool === "highlighter" ? 1.5 : 0.5));
      })
      .map((o) => o.id);
  };

  const down = (e: React.PointerEvent) => {
    if (disabled || capturing || e.button !== 0) return;
    if (tool === "select") { onSelect(null); return; }
    if (tool === "paste") {
      const clipboard = pdfStore.get().clipboard;
      if (!clipboard || !dims) return;
      const [x, y] = pt(e);
      const id = crypto.randomUUID();
      pdfStore.addOp(page, { id, kind: "image", data: clipboard.data, ...pasteRegion(clipboard, dims.w, dims.h, x, y) });
      onSelect(id); onTool("select");
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = pt(e);
    if (tool === "eraser") {
      erasing.current = [...new Set([...erasing.current, ...hit(x, y)])];
    } else if (tool === "cut" || tool === "lift") {
      draft.current = { id: crypto.randomUUID(), kind: "rect", x, y, w: 0, h: 0 };
      (draft.current as Op & { ox?: number; oy?: number }).ox = x;
      (draft.current as Op & { oy?: number }).oy = y;
    } else {
      draft.current = { id: crypto.randomUUID(), kind: "stroke", tool, color: color, size, points: [[x, y]] };
    }
    redraw();
  };
  const move = (e: React.PointerEvent) => {
    if (disabled || capturing || tool === "select" || tool === "paste" || e.buttons === 0) return;
    const [x, y] = pt(e);
    const d = draft.current as (Op & { ox?: number; oy?: number }) | null;
    if (tool === "eraser") erasing.current = [...new Set([...erasing.current, ...hit(x, y)])];
    else if (d?.kind === "rect" && d.ox !== undefined && d.oy !== undefined) {
      d.x = Math.min(x, d.ox);
      d.y = Math.min(y, d.oy);
      d.w = Math.abs(x - d.ox);
      d.h = Math.abs(y - d.oy);
    } else if (d?.kind === "stroke") d.points.push([x, y]);
    redraw();
  };
  const up = async () => {
    if (tool === "eraser") {
      pdfStore.removeOps(page, erasing.current);
      erasing.current = [];
      redraw();
      return;
    }
    const d = draft.current as (Op & { ox?: number; oy?: number }) | null;
    draft.current = null;
    if (!d) return;
    if (d.kind === "rect") {
      delete d.ox;
      delete d.oy;
      if (d.w < 0.005 || d.h < 0.003) return redraw();
    }
    if (tool === "lift" && d.kind === "rect") {
      const documentBytes = pdfStore.get().bytes;
      setCapturing(true);
      try {
        const pdfPage = await doc.getPage(page);
        const viewport = pdfPage.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Couldn't create this cutout.");
        await pdfPage.render({ canvas, canvasContext: ctx, viewport }).promise;
        drawOps(ctx, ops, canvas.width, canvas.height);
        const crop = document.createElement("canvas");
        crop.width = Math.max(1, Math.round(d.w * canvas.width)); crop.height = Math.max(1, Math.round(d.h * canvas.height));
        const cropCtx = crop.getContext("2d");
        if (!cropCtx) throw new Error("Couldn't create this cutout.");
        cropCtx.drawImage(canvas, d.x * canvas.width, d.y * canvas.height, d.w * canvas.width, d.h * canvas.height, 0, 0, crop.width, crop.height);
        const data = crop.toDataURL("image/png");
        if (pdfStore.get().bytes !== documentBytes) return;
        await prepareCutout(data);
        if (pdfStore.get().bytes !== documentBytes) return;
        pdfStore.setClipboard({ data, width: d.w * viewport.width / 2, height: d.h * viewport.height / 2 });
        pdfStore.addOp(page, d);
        onTool("paste");
        toast.success("Cutout ready to paste.");
      } catch (error) { toast.error(error instanceof Error ? error.message : "Cutout failed."); }
      finally { setCapturing(false); redraw(); }
      return;
    }
    pdfStore.addOp(page, d);
  };

  const cursor = tool === "select" ? "auto" : tool === "eraser" ? "cell" : "crosshair";
  return (
    <div ref={wrap} aria-label={`PDF page ${page}`} className="relative overflow-hidden rounded-lg bg-paper shadow-kit" style={{ width: cssW, height: cssH }}>
      <canvas ref={base} className="absolute inset-0 h-full w-full" />
      <canvas
        ref={over}
        className="absolute inset-0 h-full w-full"
        style={{ cursor, touchAction: tool === "select" ? "auto" : "none", pointerEvents: disabled || capturing ? "none" : "auto" }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => { void up(); }}
        onPointerCancel={() => { draft.current = null; erasing.current = []; redraw(); }}
      />
      {tool === "select" && !disabled && ops.map(op => op.kind === "image" ?
        <CutoutSelection key={op.id} region={preview?.id === op.id ? preview.region : op} selected={selected === op.id} width={cssW} height={cssH}
          onSelect={() => onSelect(op.id)} onPreview={region => setPreview(region ? { id: op.id, region } : null)}
          onCommit={region => pdfStore.updateOp(page, op.id, region)} onDelete={() => { pdfStore.removeOps(page, [op.id]); onSelect(null); }} /> : null)}
      {capturing && <div className="absolute inset-0 grid place-items-center bg-card/40"><Loader2 className="animate-spin text-primary" /></div>}
    </div>
  );
}

function MarkupDock({
  tool,
  setTool,
  color,
  setColor,
  size,
  setSize,
  canUndo,
  canRedo,
  canPaste,
  disabled,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  color: string;
  setColor: (c: string) => void;
  size: number;
  setSize: (n: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  disabled: boolean;
}) {
  const tools: { id: Tool; label: string; icon: typeof Pen }[] = [
    { id: "select", label: "Select & scroll", icon: MousePointer2 },
    { id: "cut", label: "Scissor cutout", icon: Scissors },
    { id: "lift", label: "Cut and move", icon: Copy },
    { id: "paste", label: "Paste cutout", icon: ClipboardPaste },
    { id: "marker", label: "Marker", icon: Pen },
    { id: "highlighter", label: "Highlighter", icon: Highlighter },
    { id: "eraser", label: "Eraser", icon: Eraser },
  ];
  const custom = !SWATCHES.includes(color.toUpperCase());
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex flex-col items-center gap-3 px-2">
      <div className="pointer-events-auto flex max-w-full flex-wrap justify-center items-center gap-1 rounded-[24px] sm:rounded-full border border-hairline bg-card/95 p-1.5 shadow-kit backdrop-blur">
        {tools.map((t) => (
          <Button variant="unstyled" size="unstyled"
            key={t.id}
            title={t.label}
            aria-label={t.label}
            aria-pressed={tool === t.id}
            disabled={disabled || (t.id === "paste" && !canPaste)}
            onClick={() => setTool(t.id)}
            className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors", tool === t.id ? "bg-accent text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <t.icon className="h-4 w-4" />
          </Button>
        ))}
        <span className="mx-1.5 h-6 w-px shrink-0 bg-secondary" />
        {SWATCHES.map((c) => (
          <Button variant="unstyled" size="unstyled"
            key={c}
            aria-label={`Color ${c}`}
            onClick={() => setColor(c)}
            className={cn("h-7 w-7 shrink-0 rounded-full border border-input", color.toUpperCase() === c && "ring-2 ring-foreground ring-offset-2 ring-offset-card")}
            style={{ background: c }}
          />
        ))}
        <label
          title="Color wheel"
          className={cn("relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-full color-wheel", custom && "ring-2 ring-foreground ring-offset-2 ring-offset-card")}
        >
          {custom && <span className="absolute inset-[7px] rounded-full border border-foreground/40" style={{ background: color }} />}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Pick any color" />
        </label>
        <span className="mx-1.5 h-6 w-px shrink-0 bg-secondary" />
        {[0, 1, 2].map((i) => (
          <Button variant="unstyled" size="unstyled"
            key={i}
            aria-label={["Thin", "Medium", "Thick"][i]}
            onClick={() => setSize(i)}
            className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", size === i ? "bg-secondary" : "hover:bg-secondary")}
          >
            <span className={cn("rounded-full", size === i ? "bg-foreground" : "bg-muted-foreground")} style={{ width: 4 + i * 4, height: 4 + i * 4 }} />
          </Button>
        ))}
        <span className="mx-1.5 h-6 w-px shrink-0 bg-secondary" />
        <Button variant="unstyled" size="unstyled" aria-label="Undo" disabled={disabled || !canUndo} onClick={pdfStore.undo} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="unstyled" size="unstyled" aria-label="Redo" disabled={disabled || !canRedo} onClick={pdfStore.redo} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30">
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

    </div>
  );
}
