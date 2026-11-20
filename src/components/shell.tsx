import { Link, useLocation } from "@tanstack/react-router";
import { ArrowLeftRight, Download, FileStack, Scissors, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function useInstallPrompt() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", () => setInstalled(true));
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  return {
    canInstall: !!evt && !installed,
    installed,
    install: async () => {
      if (!evt) return;
      await evt.prompt();
      await evt.userChoice;
      setEvt(null);
    },
  };
}

export function Brand() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5">
      <span className="grid h-6 w-6 place-items-center rounded-md border border-primary/60">
        <span className="h-2 w-2 rounded-full bg-primary" />
      </span>
      <span className="kit-display text-[17px] font-bold text-foreground">
        AnyConvert <span className="font-medium text-muted-foreground">Local</span>
      </span>
    </Link>
  );
}

export function Header() {
  const { canInstall, install } = useInstallPrompt();
  const nav = [
    { to: "/formats", label: "Formats" },
    { to: "/offline", label: "Offline Mode" },
    { to: "/architecture", label: "Architecture" },
  ] as const;
  return (
    <header className="px-4 pt-6 md:px-16">
      <div className="mx-auto flex h-14 max-w-[1000px] items-center justify-between gap-4 rounded-full border border-white/10 bg-card/80 pl-5 pr-2 shadow-[0_20px_50px_-25px_rgba(0,0,0,.8)] backdrop-blur">
        <Brand />
        <span className="hidden items-center gap-2 rounded-full border border-primary/40 bg-accent px-3.5 py-1.5 text-[12px] text-primary lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Zero Network Requests • 100% In-Browser RAM
        </span>
        <nav className="flex items-center gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="hidden rounded-full px-4 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground md:block"
              activeProps={{ className: "text-foreground" }}
            >
              {n.label}
            </Link>
          ))}
          {canInstall && (
            <button
              onClick={install}
              className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-accent px-3.5 py-2 text-[12px] font-bold text-primary"
            >
              <Download className="h-3.5 w-3.5" /> Install Offline App
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

export function TabDock() {
  const loc = useLocation();
  const tabs = [
    { to: "/", label: "Convert", icon: ArrowLeftRight },
    { to: "/pages", label: "Pages", icon: FileStack },
    { to: "/editor", label: "Redact", icon: Scissors },
    { to: "/offline", label: "Offline", icon: WifiOff },
  ] as const;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <nav className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-card/90 p-1.5 shadow-kit backdrop-blur">
        {tabs.map((t) => {
          const active = loc.pathname === t.to;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-[13px] transition-colors",
                active ? "bg-accent font-bold text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PrivacyStrip() {
  return (
    <div className="mx-auto mt-8 max-w-[920px] border-t border-hairline pt-7 text-center text-[14px] text-muted-foreground">
      <WifiOff className="mr-2 inline h-4 w-4 -translate-y-px text-primary" />
      <span className="font-bold text-foreground">100% Private:</span> You can literally turn off your Wi-Fi and
      conversions will still execute without interruption.
    </div>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-32">
      <Header />
      {children}
      <TabDock />
    </div>
  );
}
