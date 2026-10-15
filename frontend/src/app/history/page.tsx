"use client";

import { useRouter } from "next/navigation";
import { History } from "lucide-react";

import { RunDemoButton } from "@/components/common/RunDemoButton";
import { ConfidenceBadge, SeverityBadge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMs, formatTime } from "@/lib/utils";
import { useScanStore } from "@/store/ScanStore";

export default function HistoryPage() {
  const { scans, selectScan } = useScanStore();
  const router = useRouter();

  if (scans.length === 0) {
    return (
      <EmptyState
        icon={<History className="size-5" aria-hidden />}
        title="No scan history"
        description="Scan history is retained in memory on the backend (bounded) and listed here, newest first."
        action={<RunDemoButton navigateTo="/findings" />}
        className="animate-fade-in py-16"
      />
    );
  }

  const open = (id: string) => {
    selectScan(id);
    router.push("/findings");
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-fg">Scan history</h2>
        <p className="mt-1 text-sm text-muted">{scans.length} scans retained (newest first).</p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-surface-2 text-[10.5px] uppercase tracking-wide text-muted-2">
              <tr>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Finding</th>
                <th className="px-4 py-2.5 font-medium">Severity</th>
                <th className="px-4 py-2.5 font-medium">Confidence</th>
                <th className="px-4 py-2.5 font-medium">Duration</th>
                <th className="px-4 py-2.5 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {scans.map((s) => (
                <tr
                  key={s.scan_id}
                  onClick={() => open(s.scan_id)}
                  className="cursor-pointer transition-colors hover:bg-surface-2/60"
                >
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-fg">{s.title}</div>
                    <div className="font-mono text-[11px] text-muted-2">{s.endpoint}</div>
                  </td>
                  <td className="px-4 py-3">
                    {s.status === "VULNERABLE" ? <SeverityBadge severity={s.severity} /> : <span className="text-muted-2">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceBadge confidence={s.confidence} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-2 tabular">{formatMs(s.duration_ms)}</td>
                  <td className="px-4 py-3 text-xs text-muted-2">{formatTime(s.started_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
