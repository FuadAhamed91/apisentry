"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeftRight, FileWarning, Info } from "lucide-react";

import { RunDemoButton } from "@/components/common/RunDemoButton";
import { Badge, StatusBadge, type Tone } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Field";
import { JsonTree, type MarkKind } from "@/components/ui/JsonTree";
import { cn, formatBytes, formatMs } from "@/lib/utils";
import { sensitiveLeakedMarks } from "@/lib/sensitivity";
import { useScanStore } from "@/store/ScanStore";
import type { DiffEntry, DiffView, ResponseMeta, ScanResult } from "@/types/scan";

function statusTone(code: number | null): string {
  if (code == null) return "text-muted-2";
  if (code < 300) return "text-emerald-soft";
  if (code < 400) return "text-cyan";
  if (code < 500) return "text-amber-soft";
  return "text-crimson-soft";
}

function valuePreview(v: unknown): string {
  if (v === undefined) return "—";
  if (typeof v === "string") return v.length > 60 ? `"${v.slice(0, 59)}…"` : `"${v}"`;
  try {
    const s = JSON.stringify(v);
    return s.length > 60 ? `${s.slice(0, 59)}…` : s;
  } catch {
    return String(v);
  }
}

const changeTone: Record<DiffEntry["change_type"], Tone> = {
  added: "emerald",
  removed: "crimson",
  changed: "amber",
  type_changed: "amber",
};

function ResponsePane({
  label,
  meta,
  marks,
}: {
  label: string;
  meta: ResponseMeta;
  marks: Record<string, MarkKind>;
}) {
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-[#0b0f18]">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <span className="truncate text-xs font-medium text-fg">{label}</span>
        <span className={cn("font-mono text-xs font-semibold", statusTone(meta.status_code))}>
          HTTP {meta.status_code ?? "ERR"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-3 py-1.5 text-[10.5px] text-muted-2">
        <span>{formatBytes(meta.response_size)}</span>
        <span>{formatMs(meta.elapsed_ms)}</span>
        <span className="truncate font-mono">{meta.content_type ?? "—"}</span>
      </div>
      {meta.note ? (
        <div className="border-b border-line px-3 py-1.5 text-[11px] text-amber-fg">{meta.note}</div>
      ) : null}
      <div className="max-h-[420px] overflow-auto p-2">
        {meta.body == null ? (
          <p className="px-1 py-2 font-mono text-xs text-muted-2">(empty body)</p>
        ) : meta.json_parsed ? (
          <JsonTree data={meta.body} marks={marks} />
        ) : (
          <pre className="whitespace-pre-wrap break-words px-1 font-mono text-[12px] text-fg/80">
            {String(meta.body)}
          </pre>
        )}
      </div>
    </div>
  );
}

function buildMarks(dv: DiffView, scan: ScanResult) {
  const left: Record<string, MarkKind> = {};
  const right: Record<string, MarkKind> = {};
  for (const e of dv.entries) {
    if (e.change_type === "removed") left[e.path] = "removed";
    else if (e.change_type === "added") right[e.path] = "added";
    else {
      left[e.path] = "changed";
      right[e.path] = "changed";
    }
  }
  if (scan.status === "VULNERABLE" && scan.vuln_class === "BOLA" && dv.right.json_parsed) {
    Object.assign(right, sensitiveLeakedMarks(dv.right.body));
  }
  return { left, right };
}

export function DiffInspector() {
  const { scans, selectedScanId, selectScan } = useScanStore();

  const withDiff = useMemo(() => scans.filter((s) => s.diff_view), [scans]);
  const current = useMemo(
    () => withDiff.find((s) => s.scan_id === selectedScanId) ?? withDiff[0] ?? null,
    [withDiff, selectedScanId],
  );

  if (!current || !current.diff_view) {
    return (
      <div className="animate-fade-in">
        <EmptyState
          icon={<ArrowLeftRight className="size-5" aria-hidden />}
          title="No response comparison yet"
          description="Run a scan to capture a baseline and comparison response. The diff inspector renders the real responses side by side with field-level highlighting."
          action={<RunDemoButton navigateTo="/diff" />}
          className="py-16"
        />
      </div>
    );
  }

  const dv = current.diff_view;
  const { left, right } = buildMarks(dv, current);
  const leakedBola = current.status === "VULNERABLE" && current.vuln_class === "BOLA";

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusBadge status={current.status} />
            <h2 className="truncate text-sm font-semibold text-fg">{current.title}</h2>
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted">{current.endpoint}</p>
        </div>
        {withDiff.length > 1 ? (
          <div className="w-full sm:w-72">
            <Select value={current.scan_id} onChange={(e) => selectScan(e.target.value)} aria-label="Select a scan">
              {withDiff.map((s) => (
                <option key={s.scan_id} value={s.scan_id}>
                  {s.status} · {s.title}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ResponsePane label={dv.left_label} meta={dv.left} marks={left} />
        <ResponsePane label={dv.right_label} meta={dv.right} marks={right} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Field-level differences"
            description={`${dv.entries.length} structural ${dv.entries.length === 1 ? "difference" : "differences"} between the two responses`}
          />
          <CardContent>
            {dv.entries.length === 0 ? (
              leakedBola ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-crimson/25 bg-crimson/10 px-3 py-2.5 text-xs leading-relaxed text-crimson-fg">
                  <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    The responses are identical — the attacker context received the <em>same</em> protected
                    object as the victim. An empty diff here is itself the evidence of exposure; the leaked
                    sensitive fields are highlighted in the right pane and listed below.
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-2">No structural differences between the two responses.</p>
              )
            ) : (
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-2 text-[10.5px] uppercase tracking-wide text-muted-2">
                    <tr>
                      <th className="px-3 py-2 font-medium">Field path</th>
                      <th className="px-3 py-2 font-medium">Change</th>
                      <th className="px-3 py-2 font-medium">Baseline → Comparison</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {dv.entries.map((e, i) => (
                      <tr key={`${e.path}-${i}`} className={cn(e.security_relevant && "bg-crimson/[0.06]")}>
                        <td className="px-3 py-2 align-top">
                          <span className="font-mono text-[11.5px] text-fg">{e.path}</span>
                          {e.sensitive ? (
                            <Badge tone="crimson" className="ml-2 align-middle">
                              sensitive
                            </Badge>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Badge tone={changeTone[e.change_type]}>{e.change_type}</Badge>
                        </td>
                        <td className="px-3 py-2 align-top font-mono text-[11px] text-muted">
                          <span className="text-crimson-fg/80">{valuePreview(e.baseline_value)}</span>
                          <span className="mx-1.5 text-muted-2">→</span>
                          <span className="text-emerald-fg/80">{valuePreview(e.comparison_value)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Exposed / changed data" />
          <CardContent>
            {dv.exposed_summary.length > 0 ? (
              <ul className="space-y-1.5">
                {dv.exposed_summary.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 font-mono text-[11.5px] text-crimson-fg">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-crimson" aria-hidden />
                    <span className="break-all">{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-start gap-2.5 rounded-lg border border-emerald/25 bg-emerald/10 px-3 py-2.5 text-xs leading-relaxed text-emerald-fg">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  No protected data was exposed. The comparison response did not reveal any sensitive fields
                  across the authorization boundary.
                </span>
              </div>
            )}
            <div className="mt-4 border-t border-line pt-3">
              <Link href="/remediation" className="text-xs font-medium text-indigo-soft hover:underline">
                View remediation →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
