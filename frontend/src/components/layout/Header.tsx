"use client";

import { usePathname } from "next/navigation";
import { Menu, RefreshCw, Server, UserRound } from "lucide-react";

import { StatusBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { useScanStore } from "@/store/ScanStore";
import { titleForPath } from "./nav";

const statusDot: Record<string, string> = {
  online: "bg-emerald shadow-[0_0_0_3px_rgba(16,185,129,0.18)]",
  offline: "bg-crimson shadow-[0_0_0_3px_rgba(244,63,94,0.18)]",
  checking: "bg-amber animate-pulse",
};

export function Header({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const { backend, scans, refreshBackend } = useScanStore();
  const last = scans[0];

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenu}
        className="-ml-1 grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <h1 className="truncate text-base font-semibold tracking-tight text-fg">{titleForPath(pathname)}</h1>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <span className="hidden items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted sm:inline-flex">
          <Server className="size-3.5 text-cyan" aria-hidden />
          Local mock target
        </span>

        {last ? <StatusBadge status={last.status} className="hidden sm:inline-flex" /> : null}

        <button
          type="button"
          onClick={() => refreshBackend()}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:text-fg"
          title="Backend connectivity — click to recheck"
        >
          <span className={cn("size-2 rounded-full", statusDot[backend])} aria-hidden />
          <span className="capitalize">{backend}</span>
          <RefreshCw className="size-3 text-muted-2" aria-hidden />
        </button>

        <div
          className="grid size-8 place-items-center rounded-full bg-surface-2 text-muted ring-1 ring-inset ring-line"
          title="Local demo session — no authentication"
          aria-label="Local demo session, no authentication"
        >
          <UserRound className="size-4" aria-hidden />
        </div>
      </div>
    </header>
  );
}
