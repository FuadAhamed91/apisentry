import type { ReactNode } from "react";
import { AlertTriangle, CircleHelp, ShieldCheck, ShieldX, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Confidence, ScanStatus, Severity } from "@/types/scan";

export type Tone = "neutral" | "indigo" | "cyan" | "emerald" | "crimson" | "amber";

const tones: Record<Tone, string> = {
  neutral: "bg-white/[0.04] text-muted border-line",
  indigo: "bg-indigo/10 text-indigo-fg border-indigo/25",
  cyan: "bg-cyan/10 text-cyan-fg border-cyan/25",
  emerald: "bg-emerald/10 text-emerald-fg border-emerald/25",
  crimson: "bg-crimson/10 text-crimson-fg border-crimson/25",
  amber: "bg-amber/10 text-amber-fg border-amber/25",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  icon,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5",
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

const severityTone: Record<Severity, Tone> = {
  CRITICAL: "crimson",
  HIGH: "crimson",
  MEDIUM: "amber",
  LOW: "cyan",
  INFORMATIONAL: "neutral",
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <Badge tone={severityTone[severity]} className={cn("uppercase tracking-wide", className)}>
      {severity}
    </Badge>
  );
}

const statusConfig: Record<ScanStatus, { tone: Tone; label: string; icon: ReactNode }> = {
  VULNERABLE: { tone: "crimson", label: "Vulnerable", icon: <ShieldX className="size-3.5" aria-hidden /> },
  PASS: { tone: "emerald", label: "Pass", icon: <ShieldCheck className="size-3.5" aria-hidden /> },
  INCONCLUSIVE: { tone: "amber", label: "Inconclusive", icon: <CircleHelp className="size-3.5" aria-hidden /> },
  ERROR: { tone: "neutral", label: "Error", icon: <XCircle className="size-3.5" aria-hidden /> },
};

export function StatusBadge({ status, className }: { status: ScanStatus; className?: string }) {
  const c = statusConfig[status];
  return (
    <Badge tone={c.tone} icon={c.icon} className={className}>
      {c.label}
    </Badge>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const tone: Tone = confidence === "HIGH" ? "indigo" : confidence === "MEDIUM" ? "cyan" : "neutral";
  return (
    <Badge tone={tone}>
      <AlertTriangle className="size-3" aria-hidden />
      {confidence} confidence
    </Badge>
  );
}
