"use client";

import { useEffect, useRef } from "react";
import { Eraser, TerminalSquare } from "lucide-react";

import { cn } from "@/lib/utils";
import { useScanStore, type LogTag } from "@/store/ScanStore";

const tagStyle: Record<LogTag, string> = {
  INFO: "text-indigo-soft",
  REQUEST: "text-cyan",
  PASS: "text-emerald-soft",
  VULNERABLE: "text-crimson-soft",
  WARNING: "text-amber-soft",
  ERROR: "text-crimson-soft",
};

export function TerminalLog() {
  const { logs, running, clearLogs } = useScanStore();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [logs.length]);

  return (
    <div className="flex h-full min-h-[22rem] flex-col overflow-hidden rounded-xl border border-line bg-[#070A11] shadow-card">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <TerminalSquare className="size-4 text-emerald-soft" aria-hidden />
          <span className="font-mono text-xs font-medium text-fg">scan-console</span>
          {running ? (
            <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-indigo/15 px-2 py-0.5 text-[10px] font-medium text-indigo-fg">
              <span className="size-1.5 animate-pulse rounded-full bg-indigo-soft" aria-hidden />
              {running}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={clearLogs}
          disabled={logs.length === 0}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Clear log"
        >
          <Eraser className="size-3.5" aria-hidden />
          Clear
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto p-3 font-mono text-[12.5px] leading-relaxed"
        role="log"
        aria-live="polite"
        aria-label="Scan activity log"
      >
        {logs.length === 0 ? (
          <p className="px-1 py-1 text-muted-2">
            <span className="text-emerald-soft">$</span> awaiting scan… run a scan or the full demo to stream
            real activity here.
          </p>
        ) : (
          logs.map((entry) => (
            <div key={entry.id} className="flex animate-fade-in gap-2 px-1 py-[1px]">
              <span className="shrink-0 text-muted-2">{entry.ts}</span>
              <span className={cn("shrink-0 font-semibold", tagStyle[entry.tag])}>[{entry.tag}]</span>
              <span className="min-w-0 break-words text-fg/85">{entry.message}</span>
            </div>
          ))
        )}
        {running ? (
          <div className="flex gap-2 px-1 py-[1px] text-fg/85">
            <span className="shrink-0 text-emerald-soft">$</span>
            <span className="inline-block h-4 w-2 animate-caret bg-fg/70" aria-hidden />
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
    </div>
  );
}
