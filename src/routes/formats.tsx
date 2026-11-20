import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PrivacyStrip } from "@/components/shell";

export const Route = createFileRoute("/formats")({
  head: () => ({ meta: [{ title: "Formats — AnyConvert Local" }, { name: "description", content: "Formats for AnyConvert Local, the private in-browser converter." }, { property: "og:title", content: "Formats — AnyConvert Local" }, { property: "og:description", content: "Private, in-browser file transformation." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => (
    <PageShell>
      <main className="mx-auto max-w-[920px] px-4 pt-14 text-center">
        <h1 className="kit-display text-[44px] font-extrabold text-foreground">Formats</h1>
        <p className="mx-auto mt-4 max-w-[560px] text-muted-foreground">Every conversion and PDF edit runs inside this browser tab. Files are read into memory, processed locally, and never uploaded.</p>
        <PrivacyStrip />
      </main>
    </PageShell>
  ),
});
