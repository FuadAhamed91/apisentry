import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { Tone } from "@/components/ui/Badge";

const toneBg: Record<Tone, string> = {
  neutral: "bg-white/[0.05] text-muted",
  indigo: "bg-indigo/12 text-indigo-soft",
  cyan: "bg-cyan/12 text-cyan",
  emerald: "bg-emerald/12 text-emerald-soft",
  crimson: "bg-crimson/12 text-crimson-soft",
  amber: "bg-amber/12 text-amber-soft",
};

export function MetricCard({
  label,
  value,
  icon,
  tone = "neutral",
  sublabel,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: Tone;
  sublabel?: string;
}) {
  return (
    <Card className="p-4 transition-colors duration-150 hover:border-line-strong">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className={cn("grid size-7 place-items-center rounded-md", toneBg[tone])}>{icon}</span>
      </div>
      <div className="mt-3 text-[26px] font-semibold leading-none tracking-tight text-fg tabular">{value}</div>
      {sublabel ? <div className="mt-1.5 text-[11px] text-muted-2">{sublabel}</div> : null}
    </Card>
  );
}
