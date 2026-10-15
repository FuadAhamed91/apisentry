"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GitCompare, Wrench } from "lucide-react";

import { ConfidenceBadge, SeverityBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn, formatMs, formatTime } from "@/lib/utils";
import { useScanStore } from "@/store/ScanStore";
import type { ScanResult } from "@/types/scan";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-2">{title}</h3>
      {children}
    </section>
  );
}

function codeTone(code: number | null): string {
  if (code == null) return "text-muted-2";
  if (code < 300) return "text-emerald-soft";
  if (code < 400) return "text-cyan";
  if (code < 500) return "text-amber-soft";
  return "text-crimson-soft";
}

export function FindingDetail({ scan }: { scan: ScanResult }) {
  const { selectScan } = useScanStore();
  const router = useRouter();
  const confirmed = scan.status === "VULNERABLE";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={scan.status} />
          {confirmed ? <SeverityBadge severity={scan.severity} /> : null}
          <ConfidenceBadge confidence={scan.confidence} />
          {!confirmed ? (
            <span className="text-[11px] text-muted-2">
              {scan.status === "PASS"
                ? "Not a vulnerability — control verified"
                : scan.status === "INCONCLUSIVE"
                  ? "Evidence insufficient to confirm"
                  : "Assessment could not complete"}
            </span>
          ) : null}
        </div>
        <h2 className="mt-2.5 text-lg font-semibold leading-tight tracking-tight text-fg">{scan.title}</h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="font-mono text-muted">{scan.endpoint}</span>
          <span>·</span>
          <span>{formatTime(scan.started_at)}</span>
          <span>·</span>
          <span>{formatMs(scan.duration_ms)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {scan.diff_view ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<GitCompare className="size-3.5" aria-hidden />}
            onClick={() => {
              selectScan(scan.scan_id);
              router.push("/diff");
            }}
          >
            Response diff
          </Button>
        ) : null}
        {scan.remediation ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<Wrench className="size-3.5" aria-hidden />}
            onClick={() => {
              selectScan(scan.scan_id);
              router.push("/remediation");
            }}
          >
            Remediation
          </Button>
        ) : null}
      </div>

      <Section title="Rationale">
        <p className="text-sm leading-relaxed text-muted">{scan.rationale}</p>
      </Section>

      {scan.impact ? (
        <Section title="Impact">
          <p className="text-sm leading-relaxed text-muted">{scan.impact}</p>
        </Section>
      ) : null}

      {scan.attack_preconditions.length > 0 ? (
        <Section title="Attack preconditions">
          <ul className="space-y-1.5">
            {scan.attack_preconditions.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-2" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {scan.reproduction.length > 0 ? (
        <Section title="Reproduction (local demo)">
          <ol className="space-y-1.5">
            {scan.reproduction.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[10px] font-semibold text-fg">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      <Section title="Evidence — request sequence">
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="bg-surface-2 text-[10.5px] uppercase tracking-wide text-muted-2">
              <tr>
                <th className="px-3 py-2 font-medium">Step</th>
                <th className="px-3 py-2 font-medium">Request</th>
                <th className="px-3 py-2 font-medium">Context</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {scan.test_cases.map((tc, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 align-top text-fg">{tc.name}</td>
                  <td className="max-w-[220px] px-3 py-2 align-top">
                    <span className="block truncate font-mono text-[11px] text-muted" title={tc.request.url}>
                      {tc.request.method} {tc.request.url}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="font-mono text-[11px] text-muted-2">{tc.request.token_role ?? "—"}</span>
                  </td>
                  <td className={cn("px-3 py-2 align-top font-mono font-semibold", codeTone(tc.response.status_code))}>
                    {tc.response.status_code ?? "ERR"}
                  </td>
                  <td className="px-3 py-2 align-top text-muted">{tc.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {scan.probes.length > 0 ? (
        <Section title="Mass Assignment probes (read-back verified)">
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="bg-surface-2 text-[10.5px] uppercase tracking-wide text-muted-2">
                <tr>
                  <th className="px-3 py-2 font-medium">Field</th>
                  <th className="px-3 py-2 font-medium">Baseline</th>
                  <th className="px-3 py-2 font-medium">Attempted</th>
                  <th className="px-3 py-2 font-medium">Observed</th>
                  <th className="px-3 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-mono text-[11px]">
                {scan.probes.map((p, i) => (
                  <tr key={i} className={cn(p.persisted_change && "bg-crimson/[0.06]")}>
                    <td className="px-3 py-2 text-fg">{p.field}</td>
                    <td className="px-3 py-2 text-muted-2">{JSON.stringify(p.baseline_value)}</td>
                    <td className="px-3 py-2 text-amber-fg/80">{JSON.stringify(p.attempted_value)}</td>
                    <td className="px-3 py-2 text-muted">{JSON.stringify(p.observed_value)}</td>
                    <td className="px-3 py-2">
                      <span className={p.persisted_change ? "text-crimson-soft" : "text-emerald-soft"}>
                        {p.persisted_change ? "persisted" : p.echoed_only ? "echoed only" : "ignored"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {scan.restoration_status ? (
            <p className="mt-2 text-[11px] text-muted-2">
              Verification: {scan.verification_method} · Restoration: {scan.restoration_status}
            </p>
          ) : null}
        </Section>
      ) : null}

      {scan.warnings.length > 0 ? (
        <Section title="Warnings">
          <ul className="space-y-1">
            {scan.warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-fg">
                {w}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {scan.owasp_refs.length > 0 ? (
        <Section title="OWASP API Security Top 10">
          <ul className="space-y-1">
            {scan.owasp_refs.map((r, i) => (
              <li key={i} className="text-xs text-muted">
                {r}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
