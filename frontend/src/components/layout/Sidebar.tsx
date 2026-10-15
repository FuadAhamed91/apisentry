"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldHalf } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV } from "./nav";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-line px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-indigo/15 text-indigo-soft ring-1 ring-inset ring-indigo/30">
          <ShieldHalf className="size-[18px]" aria-hidden />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight text-fg">APISentry</div>
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-2">
            Authz Auditor
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Primary">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                active
                  ? "bg-indigo/12 text-fg shadow-[inset_0_0_0_1px_rgba(99,102,241,0.25)]"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon
                className={cn("size-[18px] shrink-0", active ? "text-indigo-soft" : "text-muted-2 group-hover:text-muted")}
                aria-hidden
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-4">
        <div className="rounded-lg border border-line bg-surface-2/60 px-3 py-2.5">
          <p className="text-[11px] font-medium text-fg">Local demo lab</p>
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-2">
            Scans run against a bundled, synthetic mock target. External targets are opt-in.
          </p>
        </div>
      </div>
    </div>
  );
}
