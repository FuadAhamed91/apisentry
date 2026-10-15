"use client";

import { useMemo } from "react";
import { BookMarked, Lightbulb, ShieldCheck, Wrench } from "lucide-react";

import { RunDemoButton } from "@/components/common/RunDemoButton";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Field";
import { useScanStore } from "@/store/ScanStore";

const CLASS_LABEL: Record<string, string> = {
  BOLA: "Broken Object Level Authorization",
  MASS_ASSIGNMENT: "Mass Assignment",
};

export function RemediationPanel() {
  const { scans, selectedScanId, selectScan } = useScanStore();

  const withRem = useMemo(() => scans.filter((s) => s.remediation), [scans]);
  const current = useMemo(
    () => withRem.find((s) => s.scan_id === selectedScanId) ?? withRem[0] ?? null,
    [withRem, selectedScanId],
  );

  if (!current || !current.remediation) {
    return (
      <EmptyState
        icon={<Wrench className="size-5" aria-hidden />}
        title="No remediation guidance yet"
        description="Run a scan to generate context-sensitive remediation. Guidance adapts to the specific finding — BOLA ownership checks or Mass Assignment allow-list DTOs."
        action={<RunDemoButton navigateTo="/remediation" />}
        className="animate-fade-in py-16"
      />
    );
  }

  const rem = current.remediation;

  return (
    <div className="mx-auto max-w-4xl animate-fade-in space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {current.vuln_class ? <Badge tone="indigo">{CLASS_LABEL[current.vuln_class] ?? current.vuln_class}</Badge> : null}
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-fg">Remediation guidance</h2>
          <p className="mt-1 text-sm text-muted">For: {current.title}</p>
        </div>
        {withRem.length > 1 ? (
          <div className="w-full sm:w-72">
            <Select value={current.scan_id} onChange={(e) => selectScan(e.target.value)} aria-label="Select a finding">
              {withRem.map((s) => (
                <option key={s.scan_id} value={s.scan_id}>
                  {s.title}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
      </div>

      <Card>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-3 rounded-lg border border-indigo/20 bg-indigo/[0.07] px-4 py-3">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-indigo-soft" aria-hidden />
            <p className="text-sm leading-relaxed text-fg/90">{rem.summary}</p>
          </div>

          {rem.guidance.length > 0 ? (
            <div>
              <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-fg">
                <ShieldCheck className="size-4 text-emerald-soft" aria-hidden />
                Recommended controls
              </h3>
              <ul className="space-y-2">
                {rem.guidance.map((g, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald/70" aria-hidden />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {rem.code_samples.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-fg">Secure patterns</h3>
              {rem.code_samples.map((sample, i) => (
                <CodeBlock key={i} label={`${sample.label} · ${sample.language}`} code={sample.code} />
              ))}
              <p className="text-[11px] leading-relaxed text-muted-2">
                Code samples are illustrative. Database models and dependencies are examples, not part of this
                application.
              </p>
            </div>
          ) : null}

          {rem.references.length > 0 ? (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
                <BookMarked className="size-4 text-cyan" aria-hidden />
                References
              </h3>
              <ul className="space-y-1.5">
                {rem.references.map((ref, i) => {
                  const isUrl = ref.startsWith("http");
                  return (
                    <li key={i} className="text-xs">
                      {isUrl ? (
                        <a
                          href={ref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-indigo-soft hover:underline"
                        >
                          {ref}
                        </a>
                      ) : (
                        <span className="text-muted">{ref}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
