"use client";

import { PlugZap } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { API_BASE } from "@/lib/api";
import { useScanStore } from "@/store/ScanStore";

export function ConnectionBanner() {
  const { backend, refreshBackend } = useScanStore();
  if (backend !== "offline") return null;

  return (
    <div
      role="alert"
      className="mb-5 flex flex-col gap-3 rounded-xl border border-crimson/30 bg-crimson/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <PlugZap className="mt-0.5 size-5 shrink-0 text-crimson-soft" aria-hidden />
        <div>
          <p className="text-sm font-medium text-fg">Backend unreachable</p>
          <p className="mt-0.5 text-xs text-muted">
            Could not reach the APISentry API at{" "}
            <span className="font-mono text-crimson-fg">{API_BASE}</span>. Start the backend, then retry.
          </p>
        </div>
      </div>
      <Button size="sm" variant="secondary" onClick={() => refreshBackend()} className="shrink-0">
        Retry connection
      </Button>
    </div>
  );
}
