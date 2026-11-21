import type { PDFDocumentProxy } from "pdfjs-dist";
import { Check, FileUp, Shield } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { pdfStore } from "@/lib/pdf-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function usePdfDoc(bytes: Uint8Array | null) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  useEffect(() => {
    setDoc(null);
    if (!bytes) return;
    let alive = true;
    let d: PDFDocumentProxy | null = null;
    import("@/lib/pdfjs").then(async ({ openPdf }) => {
      d = await openPdf(bytes);
      if (alive) setDoc(d);
      else { void d.loadingTask.destroy(); d = null; }
    }).catch(() => {
      if (alive) { toast.error("Couldn’t render this PDF. Please reopen it."); pdfStore.close(); }
    });
    return () => {
      alive = false;
      void d?.loadingTask.destroy();
    };
  }, [bytes]);
  return doc;
}

export async function loadPdfFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    toast.error("That isn't a PDF. Convert it to PDF on the Convert tab first.");
    return false;
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { openPdf } = await import("@/lib/pdfjs");
    const doc = await openPdf(bytes);
    pdfStore.load(file.name, bytes, doc.numPages);
    void doc.loadingTask.destroy();
    return true;
  } catch {
    toast.error("This PDF is corrupt or password-protected.");
    return false;
  }
}

export function OpenPdf({ title, hint }: { title: string; hint: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <section className="mx-auto mt-14 max-w-[720px] px-4">
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadPdfFile(f);
          e.target.value = "";
        }}
      />
      <div className="rounded-[28px] border border-hairline bg-secondary p-2">
        <Button variant="unstyled" size="unstyled"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) void loadPdfFile(f);
          }}
          className={cn(
            "w-full rounded-[22px] border border-dashed px-6 py-14 text-center transition-colors",
            drag ? "border-primary bg-primary/10" : "border-primary/35 bg-primary/[0.05] hover:bg-primary/[0.08]",
          )}
        >
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-input">
            <FileUp className="h-4 w-4 text-primary" />
          </span>
          <h1 className="kit-display mt-5 text-[28px] font-bold text-foreground">{title}</h1>
          <p className="mx-auto mt-2 max-w-[420px] text-[14px] text-muted-foreground">{hint}</p>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
            <Shield className="h-3.5 w-3.5" /> Air-Gapped Ready • Zero Server Uploads
          </p>
        </Button>
      </div>
    </section>
  );
}

export function PageThumb({
  doc,
  page,
  excluded,
  onToggle,
  onOpen,
  width = 150,
}: {
  doc: PDFDocumentProxy;
  page: number;
  excluded: boolean;
  onToggle: () => void;
  onOpen?: () => void;
  width?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let task: { cancel: () => void } | null = null;
    let active = true;
    void doc.getPage(page).then((p) => {
      const c = ref.current;
      if (!c || !active) return;
      const vp1 = p.getViewport({ scale: 1 });
      const vp = p.getViewport({ scale: (width * 2) / vp1.width });
      c.width = vp.width;
      c.height = vp.height;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const t = p.render({ canvas: c, canvasContext: ctx, viewport: vp });
      task = t;
      t.promise.catch(() => {});
    }).catch(() => {});
    return () => { active = false; task?.cancel(); };
  }, [doc, page, width]);
  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="unstyled" size="unstyled"
        onClick={onToggle}
        aria-pressed={!excluded}
        aria-label={`${excluded ? "Include" : "Exclude"} page ${page}`}
        className={cn(
          "relative overflow-hidden rounded-lg border-2 bg-paper transition-all",
          excluded ? "border-transparent opacity-30 grayscale" : "border-primary/70",
        )}
        style={{ width }}
      >
        <canvas ref={ref} className="block h-auto w-full" />
        <span
          className={cn(
            "absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full border",
            excluded ? "border-ink/30 bg-paper" : "border-primary bg-primary text-primary-foreground",
          )}
        >
          {!excluded && <Check className="h-3 w-3" />}
        </span>
      </Button>
      {onOpen && <Button variant="ghost" size="sm" disabled={excluded} onClick={onOpen} aria-label={`Go to page ${page}`}>Go to page</Button>}
      <span className="tabular font-mono text-[11px] text-muted-foreground">
        {page}
        {excluded && " · removed"}
      </span>
    </div>
  );
}
