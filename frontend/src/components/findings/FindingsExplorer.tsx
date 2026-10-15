"use client";

import { useMemo, useState } from "react";
import { Search, ShieldAlert } from "lucide-react";

import { RunDemoButton } from "@/components/common/RunDemoButton";
import { SeverityBadge, StatusBadge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";
import { FindingDetail } from "@/components/findings/FindingDetail";
import { cn, relativeTime, truncate } from "@/lib/utils";
import { useScanStore } from "@/store/ScanStore";
import type { ScanStatus, Severity, VulnClass } from "@/types/scan";

export function FindingsExplorer() {
  const { scans, selectedScanId, selectScan } = useScanStore();
  const [status, setStatus] = useState<ScanStatus | "ALL">("ALL");
  const [severity, setSeverity] = useState<Severity | "ALL">("ALL");
  const [type, setType] = useState<VulnClass | "ALL">("ALL");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scans.filter((s) => {
      if (status !== "ALL" && s.status !== status) return false;
      if (severity !== "ALL" && s.severity !== severity) return false;
      if (type !== "ALL" && s.vuln_class !== type) return false;
      if (q && !(`${s.title} ${s.endpoint}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [scans, status, severity, type, query]);

  const selected = useMemo(
    () => scans.find((s) => s.scan_id === selectedScanId) ?? filtered[0] ?? null,
    [scans, selectedScanId, filtered],
  );

  if (scans.length === 0) {
    return (
      <EmptyState
        icon={<ShieldAlert className="size-5" aria-hidden />}
        title="No findings yet"
        description="Findings appear here once a scan runs. Each one is backed by real request/response evidence and a documented classification rationale."
        action={<RunDemoButton navigateTo="/findings" />}
        className="animate-fade-in py-16"
      />
    );
  }

  return (
    <div className="grid animate-fade-in gap-5 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-2" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search findings…"
            className="pl-9"
            aria-label="Search findings"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value as ScanStatus | "ALL")} aria-label="Filter by status">
            <option value="ALL">All status</option>
            <option value="VULNERABLE">Vulnerable</option>
            <option value="PASS">Pass</option>
            <option value="INCONCLUSIVE">Inconclusive</option>
            <option value="ERROR">Error</option>
          </Select>
          <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity | "ALL")} aria-label="Filter by severity">
            <option value="ALL">All severity</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="INFORMATIONAL">Info</option>
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value as VulnClass | "ALL")} aria-label="Filter by type">
            <option value="ALL">All types</option>
            <option value="BOLA">BOLA</option>
            <option value="MASS_ASSIGNMENT">Mass Assign</option>
          </Select>
        </div>

        <Card className="overflow-hidden">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-2">No findings match these filters.</p>
          ) : (
            <ul className="divide-y divide-line">
              {filtered.map((s) => {
                const active = selected?.scan_id === s.scan_id;
                return (
                  <li key={s.scan_id}>
                    <button
                      type="button"
                      onClick={() => selectScan(s.scan_id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors",
                        active ? "bg-indigo/10" : "hover:bg-surface-2/60",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <StatusBadge status={s.status} />
                        {s.status === "VULNERABLE" ? <SeverityBadge severity={s.severity} /> : null}
                        <span className="ml-auto text-[10.5px] text-muted-2">{relativeTime(s.started_at)}</span>
                      </div>
                      <span className="text-sm font-medium leading-snug text-fg">{truncate(s.title, 64)}</span>
                      <span className="font-mono text-[11px] text-muted-2">{s.endpoint}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardContent className="p-5 sm:p-6">
          {selected ? (
            <FindingDetail scan={selected} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-2">Select a finding to view its evidence.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
