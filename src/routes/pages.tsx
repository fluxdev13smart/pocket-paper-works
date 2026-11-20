import { createFileRoute } from "@tanstack/react-router";
import { OpenPdf, PageThumb, usePdfDoc } from "@/components/pdf-common";
import { PageShell } from "@/components/shell";
import { pdfStore, usePdfStore } from "@/lib/pdf-store";

export const Route = createFileRoute("/pages")({
  head: () => ({ meta: [{ title: "Organize PDF Pages — AnyConvert Local" }, { name: "description", content: "Remove unwanted PDF pages locally in your browser." }, { property: "og:title", content: "Organize PDF Pages — AnyConvert Local" }, { property: "og:description", content: "Deselect pages and export a new PDF, all offline." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Pages,
});

function Pages() {
  const s = usePdfStore();
  const doc = usePdfDoc(s.bytes);
  return (
    <PageShell>
      {!s.bytes ? (
        <OpenPdf title="Open a PDF to organize" hint="Deselect pages you don't want, then export from the Redact tab." />
      ) : (
        <main className="mx-auto max-w-[1000px] px-4 pt-10">
          <h1 className="kit-display text-[28px] font-bold text-foreground">{s.name}</h1>
          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {doc && Array.from({ length: s.pageCount }, (_, i) => i + 1).map((p) => (
              <PageThumb key={p} doc={doc} page={p} excluded={s.excluded.includes(p)} onToggle={() => pdfStore.toggleExcluded(p)} />
            ))}
          </div>
        </main>
      )}
    </PageShell>
  );
}
