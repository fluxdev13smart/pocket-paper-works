import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Check, ChevronDown, Download, FilePen, Loader2, Shield, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageShell, PrivacyStrip } from "@/components/shell";
import { convertFile, type Output } from "@/lib/convert";
import { downloadBlob } from "@/lib/download";
import { categoryOf, engineFor, extOf, formatBytes, targetsFor, type Category, type Target } from "@/lib/formats";
import { pdfStore } from "@/lib/pdf-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AnyConvert Local — Private, in-browser file converter" },
      { name: "description", content: "Convert images, audio, video, PDFs and documents entirely inside your browser. No uploads, works offline." },
      { property: "og:title", content: "AnyConvert Local — Private, in-browser file converter" },
      { property: "og:description", content: "Your files never leave your device. Convert anything locally, even with Wi-Fi off." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

interface Item {
  id: string;
  file: File;
  cat: Category;
  targets: Target[];
  target: string;
  status: "ready" | "converting" | "done" | "error";
  progress: number;
  output?: Output | undefined;
  error?: string | undefined;
}

const ACCEPT: Record<string, string> = {
  Images: "image/*",
  Audio: "audio/*",
  Video: "video/*",
  Docs: ".pdf,.txt,.md,.markdown,.html,.htm,.json,.csv",
};
const CHIP_CAT: Record<string, Category[]> = { Images: ["image"], Audio: ["audio"], Video: ["video"], Docs: ["pdf", "text"] };

function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const [running, setRunning] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const update = (id: string, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const add = (files: FileList | File[]) => {
    const list = [...files];
    const next: Item[] = [];
    let skipped = 0;
    for (const file of list) {
      const cat = categoryOf(file);
      const targets = targetsFor(cat, extOf(file.name));
      if (!targets.length) {
        skipped++;
        continue;
      }
      next.push({ id: crypto.randomUUID(), file, cat, targets, target: targets[0]!.id, status: "ready", progress: 0 });
    }
    if (skipped) toast.error(`${skipped} file${skipped > 1 ? "s" : ""} skipped — that format can't be converted locally yet.`);
    setItems((xs) => [...xs, ...next]);
  };

  const pick = (accept?: string) => {
    if (!input.current) return;
    input.current.accept = accept ?? "";
    input.current.click();
  };

  const convertOne = async (it: Item) => {
    const t = it.targets.find((x) => x.id === it.target)!;
    update(it.id, { status: "converting", progress: 0, error: undefined });
    try {
      const output = await convertFile(it.file, t.id, t.ext, (p) => update(it.id, { progress: p }));
      update(it.id, { status: "done", progress: 1, output });
    } catch (e) {
      update(it.id, { status: "error", error: e instanceof Error ? e.message : "Conversion failed" });
    }
  };

  const convertAll = async () => {
    setRunning(true);
    for (const it of items.filter((x) => x.status !== "done")) await convertOne(it);
    setRunning(false);
  };

  const downloadZip = async () => {
    const done = items.filter((x) => x.output);
    if (done.length === 1) return downloadBlob(done[0]!.output!.blob, done[0]!.output!.name);
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const used = new Set<string>();
    for (const d of done) {
      let n = d.output!.name;
      for (let i = 2; used.has(n); i++) n = d.output!.name.replace(/(\.[^.]+)$/, `-${i}$1`);
      used.add(n);
      zip.file(n, d.output!.blob);
    }
    downloadBlob(await zip.generateAsync({ type: "blob", compression: "STORE" }), "anyconvert-local.zip");
  };

  const openInEditor = async (file: File) => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { openPdf } = await import("@/lib/pdfjs");
      const doc = await openPdf(bytes);
      pdfStore.load(file.name, bytes, doc.numPages);
      navigate({ to: "/editor" });
    } catch {
      toast.error("This PDF is corrupt or password-protected.");
    }
  };

  const total = items.reduce((s, x) => s + x.file.size, 0);
  const doneCount = items.filter((x) => x.output).length;
  const pending = items.filter((x) => x.status !== "done").length;
  const present = new Set(items.map((x) => x.cat));

  return (
    <PageShell>
      <main className="mx-auto max-w-[920px] px-4">
        <section className="pt-12 text-center md:pt-14">
          <h1 className="kit-display text-[40px] font-extrabold leading-[1.02] text-foreground sm:text-[56px]">
            Private, in-browser file transformation
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-[16px] leading-relaxed text-muted-foreground">
            Your files never leave your device. Processed entirely inside your browser via WebAssembly.
          </p>
        </section>

        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />

        <section className="mt-9 rounded-[28px] border border-hairline bg-secondary p-2">
          <div
            role="button"
            tabIndex={0}
            onClick={() => pick()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && pick()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              add(e.dataTransfer.files);
            }}
            className={cn(
              "cursor-pointer rounded-[22px] border border-dashed px-6 py-8 text-center transition-colors",
              drag ? "border-primary bg-primary/10" : "border-primary/35 bg-primary/[0.05] hover:bg-primary/[0.08]",
            )}
          >
            <div className={cn("mx-auto grid h-12 w-12 place-items-center rounded-full border transition-transform", drag ? "scale-110 border-primary" : "border-white/15")}>
              <Upload className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-4 text-[18px] text-foreground">{drag ? "Release to load into memory" : "Drop files to load into browser memory"}</p>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
              <Shield className="h-3.5 w-3.5" /> Air-Gapped Ready • Zero Server Uploads
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {Object.keys(ACCEPT).map((chip) => {
                const on = CHIP_CAT[chip]!.some((c) => present.has(c)) || (items.length === 0 && chip === "Images");
                return (
                  <button
                    key={chip}
                    onClick={(e) => {
                      e.stopPropagation();
                      pick(ACCEPT[chip]);
                    }}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
                      on ? "border-primary/50 bg-accent text-primary" : "border-white/10 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[24px] border border-hairline bg-card px-5 pb-4 pt-5 shadow-kit sm:px-7">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Local queue</h2>
            {items.length > 0 && (
              <button disabled={running} onClick={() => setItems([])} className="text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-40">
                Clear
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[15px] text-foreground">No files in memory yet</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Add images, audio, video, PDFs or text files — they stay on this device.</p>
            </div>
          ) : (
            <ul className="mt-2">
              {items.map((it) => (
                <QueueRow
                  key={it.id}
                  it={it}
                  disabled={running}
                  onTarget={(target) => update(it.id, { target, status: "ready", output: undefined, progress: 0 })}
                  onRemove={() => setItems((xs) => xs.filter((x) => x.id !== it.id))}
                  onEdit={it.cat === "pdf" ? () => openInEditor(it.file) : undefined}
                  onRetry={() => convertOne(it)}
                />
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="tabular font-mono text-[13px] text-muted-foreground">
              <span className="font-sans font-bold text-foreground">{formatBytes(total)}</span> in RAM
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={downloadZip}
                disabled={!doneCount || running}
                className="rounded-full border border-white/15 px-5 py-3 text-[14px] text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
              >
                Download ZIP
              </button>
              <button
                onClick={convertAll}
                disabled={!pending || running}
                className="flex items-center gap-3 rounded-full bg-primary py-1.5 pl-6 pr-1.5 text-[14px] font-bold text-primary-foreground transition-transform hover:-translate-y-px disabled:opacity-50"
              >
                {running ? "Converting locally…" : `Convert All Locally (${pending} file${pending === 1 ? "" : "s"})`}
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-foreground/10">
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                </span>
              </button>
            </div>
          </div>
        </section>

        <PrivacyStrip />
      </main>
    </PageShell>
  );
}

function QueueRow({
  it,
  disabled,
  onTarget,
  onRemove,
  onEdit,
  onRetry,
}: {
  it: Item;
  disabled: boolean;
  onTarget: (t: string) => void;
  onRemove: () => void;
  onEdit?: (() => void) | undefined;
  onRetry: () => void;
}) {
  const ext = extOf(it.file.name).toUpperCase().slice(0, 4) || "FILE";
  return (
    <li className="group grid grid-cols-[36px_1fr_auto] items-center gap-x-4 gap-y-2 rounded-xl py-3.5 md:grid-cols-[36px_1fr_160px_170px_110px]">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-[10px] text-muted-foreground">{ext}</span>
      <div className="min-w-0">
        <p className="truncate text-[15px] text-foreground">{it.file.name}</p>
        <p className="tabular font-mono text-[11px] text-muted-foreground">
          {formatBytes(it.file.size)}
          {it.output && <> → {formatBytes(it.output.blob.size)}</>}
        </p>
      </div>
      <div className="col-span-3 col-start-2 md:col-span-1 md:col-start-auto md:row-start-1 md:[grid-column:3]">
        <div className="relative">
          <select
            value={it.target}
            disabled={disabled || it.status === "converting"}
            onChange={(e) => onTarget(e.target.value)}
            aria-label={`Convert ${it.file.name} to`}
            className="w-full appearance-none rounded-lg border border-white/15 bg-background px-3 py-2 pr-8 text-[14px] text-foreground outline-none focus:border-primary"
          >
            {it.targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>
      <p className="col-start-2 text-[12px] text-primary md:col-start-auto md:row-start-1 md:[grid-column:4]">{engineFor(it.cat, it.target)}</p>
      <div className="col-start-3 row-start-1 flex items-center justify-end gap-2 text-[13px] md:[grid-column:5]">
        <Status it={it} onRetry={onRetry} />
        {onEdit && it.status !== "converting" && (
          <button onClick={onEdit} title="Open in PDF editor" className="text-muted-foreground hover:text-primary">
            <FilePen className="h-4 w-4" />
          </button>
        )}
        {it.status !== "converting" && (
          <button onClick={onRemove} disabled={disabled} title="Remove" className="text-muted-foreground hover:text-foreground disabled:opacity-30">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {it.status === "converting" && (
        <div className="col-span-3 col-start-2 h-1 overflow-hidden rounded-full bg-secondary md:col-span-4">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(it.progress * 100)}%` }} />
        </div>
      )}
      {it.status === "error" && <p className="col-span-3 col-start-2 text-[12px] text-destructive md:col-span-4">{it.error}</p>}
    </li>
  );
}

function Status({ it, onRetry }: { it: Item; onRetry: () => void }) {
  if (it.status === "converting") return <span className="tabular font-mono text-primary">{Math.round(it.progress * 100)}%</span>;
  if (it.status === "done")
    return (
      <button onClick={() => downloadBlob(it.output!.blob, it.output!.name)} className="flex items-center gap-1 text-primary hover:underline">
        <Check className="h-3.5 w-3.5" /> <Download className="h-3.5 w-3.5" />
      </button>
    );
  if (it.status === "error")
    return (
      <button onClick={onRetry} className="flex items-center gap-1 text-destructive">
        <AlertTriangle className="h-3.5 w-3.5" /> Retry
      </button>
    );
  return <span className="text-foreground">Ready</span>;
}
