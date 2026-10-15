"use client";

import { RefreshCw, RotateCcw, Server, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { API_BASE } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useScanStore } from "@/store/ScanStore";

const dot: Record<string, string> = {
  online: "bg-emerald",
  offline: "bg-crimson",
  checking: "bg-amber animate-pulse",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-xs text-fg">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { backend, health, preset, refreshBackend, resetMock, running } = useScanStore();
  const toast = useToast();

  return (
    <div className="mx-auto max-w-3xl animate-fade-in space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-fg">Settings</h2>
        <p className="mt-1 text-sm text-muted">Connection, safety policy, and mock target controls.</p>
      </div>

      <Card>
        <CardHeader
          title="Backend connection"
          icon={<Server className="size-4" aria-hidden />}
          actions={
            <Button size="sm" variant="secondary" icon={<RefreshCw className="size-3.5" aria-hidden />} onClick={() => refreshBackend()}>
              Recheck
            </Button>
          }
        />
        <CardContent className="divide-y divide-line">
          <Row
            label="Status"
            value={
              <span className="inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", dot[backend])} aria-hidden />
                <span className="capitalize">{backend}</span>
              </span>
            }
          />
          <Row label="API base URL" value={API_BASE} />
          <Row label="Version" value={health?.version ?? "—"} />
          <Row label="Demo mode" value={health?.demo_mode ? "enabled" : "disabled"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Target safety policy" icon={<ShieldCheck className="size-4" aria-hidden />} />
        <CardContent>
          <ul className="space-y-2">
            {(preset?.safety_notes ?? [
              "All targets are local, in-memory, synthetic mock endpoints.",
              "External targets are opt-in and SSRF-guarded.",
            ]).map((note, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald/70" aria-hidden />
                {note}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Mock target"
          description="Restore the deliberately vulnerable mock to its deterministic initial fixtures."
        />
        <CardContent>
          <Button
            variant="secondary"
            icon={<RotateCcw className="size-4" aria-hidden />}
            disabled={running !== null || backend !== "online"}
            onClick={async () => {
              await resetMock();
              toast("Mock target reset to initial fixtures.", "success");
            }}
          >
            Reset mock target
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="About" />
        <CardContent className="space-y-1 text-sm text-muted">
          <p>
            APISentry is a local, self-contained API authorization auditing lab. It implements selected OWASP API
            Security Top 10 (2023) checks — API1 (BOLA) and API3 (Mass Assignment) — not a complete assessment.
          </p>
          <p className="text-xs text-muted-2">Next.js · FastAPI · HTTPX · deterministic mock target.</p>
        </CardContent>
      </Card>
    </div>
  );
}
