"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  CircleHelp,
   Radar,
  ShieldCheck,
  ShieldX,
} from "lucide-react";

import { RunDemoButton } from "@/components/common/RunDemoButton";
import { ConfidenceBadge, SeverityBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/overview/MetricCard";
import { SeverityBar } from "@/components/overview/SeverityBar";
import { cn, formatMs, relativeTime, truncate } from "@/lib/utils";
import { useScanStore } from "@/store/ScanStore";
import type { ScanResult, Severity } from "@/types/scan";

function computeMetrics(scans: ScanResult[]) {
  const severity: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFORMATIONAL: 0,
  };
  const categories = {
    BOLA: { total: 0, vulnerable: 0 },
    MASS_ASSIGNMENT: { total: 0, vulnerable: 0 },
  };
  let vulnerable = 0;
  let passed = 0;
  let inconclusive = 0;

  for (const s of scans) {
    if (s.status === "VULNERABLE") {
      vulnerable += 1;
      severity[s.severity] += 1;
    } else if (s.status === "PASS") {
      passed += 1;
    } else if (s.status === "INCONCLUSIVE") {
      inconclusive += 1;
    }
    if (s.vuln_class && categories[s.vuln_class]) {
      categories[s.vuln_class].total += 1;
      if (s.status === "VULNERABLE") categories[s.vuln_class].vulnerable += 1;
    }
  }
  return { total: scans.length, vulnerable, passed, inconclusive, severity, categories };
}

const CATEGORY_LABEL: Record<string, string> = {
  BOLA: "Broken Object Level Authorization",
  MASS_ASSIGNMENT: "Mass Assignment",
};

export function Overview() {
  const { scans, selectScan } = useScanStore();
  const router = useRouter();
  const m = useMemo(() => computeMetrics(scans), [scans]);
  const latest = scans[0];

  const open = (id: string, to: string) => {
    selectScan(id);
    router.push(to);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-fg">Security overview</h2>
          <p className="mt-1 text-sm text-muted">
            Authorization audit results across the local mock target.
          </p>
        </div>
        <RunDemoButton navigateTo="/findings" />
      </div>

      {scans.length === 0 ? (
        <EmptyState
          icon={<Radar className="size-5" aria-hidden />}
          title="No scans have run yet"
          description="Load the preloaded test target and run the full demo to audit the bundled mock API for BOLA and Mass Assignment. Every metric below is derived from real scan results."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <RunDemoButton navigateTo="/findings" />
              <Link href="/console">
                <Button variant="secondary">Open Scan Console</Button>
              </Link>
            </div>
          }
          className="py-16"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Total scans" value={m.total} tone="indigo" icon={<Activity className="size-4" aria-hidden />} />
            <MetricCard
              label="Confirmed vulnerabilities"
              value={m.vulnerable}
              tone="crimson"
              icon={<ShieldX className="size-4" aria-hidden />}
            />
            <MetricCard
              label="Passed checks"
              value={m.passed}
              tone="emerald"
              icon={<ShieldCheck className="size-4" aria-hidden />}
            />
            <MetricCard
              label="Inconclusive"
              value={m.inconclusive}
              tone="amber"
              icon={<CircleHelp className="size-4" aria-hidden />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Severity distribution" description="Across confirmed findings" />
              <CardContent className="space-y-6">
                <SeverityBar counts={m.severity} />
                <div>
                  <h3 className="mb-2.5 text-xs font-medium text-muted">Vulnerability categories</h3>
                  <div className="space-y-2.5">
                    {(["BOLA", "MASS_ASSIGNMENT"] as const).map((cat) => {
                      const c = m.categories[cat];
                      const pct = c.total > 0 ? (c.vulnerable / c.total) * 100 : 0;
                      return (
                        <div key={cat}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-fg">{CATEGORY_LABEL[cat]}</span>
                            <span className="text-muted-2 tabular">
                              {c.vulnerable} confirmed / {c.total} scanned
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                            <div
                              className={cn("h-full rounded-full", c.vulnerable > 0 ? "bg-crimson" : "bg-emerald")}
                              style={{ width: `${c.total > 0 ? Math.max(pct, c.vulnerable > 0 ? 8 : 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Latest scan" />
              <CardContent>
                {latest ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={latest.status} />
                      {latest.status === "VULNERABLE" ? <SeverityBadge severity={latest.severity} /> : null}
                    </div>
                    <p className="text-sm font-medium leading-snug text-fg">{latest.title}</p>
                    <p className="font-mono text-[11px] text-muted">{latest.endpoint}</p>
                    <ConfidenceBadge confidence={latest.confidence} />
                    <p className="text-xs leading-relaxed text-muted line-clamp-4">{latest.rationale}</p>
                    <Button
                      size="sm"
                      variant="subtle"
                      className="w-full"
                      icon={<ArrowUpRight className="size-3.5" aria-hidden />}
                      onClick={() => open(latest.scan_id, "/findings")}
                    >
                      View finding
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Recent scans"
              actions={
                <Link href="/history" className="text-xs font-medium text-indigo-soft hover:underline">
                  View all
                </Link>
              }
            />
            <div className="divide-y divide-line">
              {scans.slice(0, 6).map((s) => (
                <button
                  key={s.scan_id}
                  type="button"
                  onClick={() => open(s.scan_id, "/findings")}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2/60"
                >
                  <StatusBadge status={s.status} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">{truncate(s.title, 56)}</span>
                    <span className="block truncate font-mono text-[11px] text-muted-2">{s.endpoint}</span>
                  </span>
                  {s.status === "VULNERABLE" ? (
                    <SeverityBadge severity={s.severity} className="hidden sm:inline-flex" />
                  ) : null}
                  <span className="hidden w-16 text-right text-[11px] text-muted-2 tabular md:block">
                    {formatMs(s.duration_ms)}
                  </span>
                  <span className="w-16 text-right text-[11px] text-muted-2">{relativeTime(s.started_at)}</span>
                </button>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
