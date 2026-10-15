import { cn } from "@/lib/utils";
import type { Severity } from "@/types/scan";

const order: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"];
const color: Record<Severity, string> = {
  CRITICAL: "bg-crimson",
  HIGH: "bg-crimson/70",
  MEDIUM: "bg-amber",
  LOW: "bg-cyan",
  INFORMATIONAL: "bg-muted-2",
};
const dot: Record<Severity, string> = {
  CRITICAL: "bg-crimson",
  HIGH: "bg-crimson/70",
  MEDIUM: "bg-amber",
  LOW: "bg-cyan",
  INFORMATIONAL: "bg-muted-2",
};

export function SeverityBar({ counts }: { counts: Record<Severity, number> }) {
  const total = order.reduce((s, k) => s + counts[k], 0);

  if (total === 0) {
    return (
      <p className="text-xs text-muted-2">No confirmed findings to chart yet.</p>
    );
  }

  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        {order.map((sev) =>
          counts[sev] > 0 ? (
            <div
              key={sev}
              className={cn("h-full", color[sev])}
              style={{ width: `${(counts[sev] / total) * 100}%` }}
              title={`${sev}: ${counts[sev]}`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {order.map((sev) => (
          <div key={sev} className="flex items-center gap-1.5 text-[11px]">
            <span className={cn("size-2 rounded-full", dot[sev])} aria-hidden />
            <span className="text-muted">{sev[0] + sev.slice(1).toLowerCase()}</span>
            <span className="font-medium text-fg tabular">{counts[sev]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
