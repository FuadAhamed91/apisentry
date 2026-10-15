"use client";

import { PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { useScanStore } from "@/store/ScanStore";

export function RunDemoButton({
  size = "md",
  className,
  navigateTo,
}: {
  size?: "sm" | "md";
  className?: string;
  navigateTo?: string;
}) {
  const { runFullDemo, running, backend, preset } = useScanStore();
  const router = useRouter();
  const isRunning = running === "Full demo scan";
  const disabled = backend !== "online" || running !== null || !preset?.tokens_exposed;

  return (
    <Button
      variant="primary"
      size={size}
      className={className}
      loading={isRunning}
      disabled={disabled}
      icon={isRunning ? undefined : <PlayCircle className="size-4" aria-hidden />}
      onClick={async () => {
        await runFullDemo();
        if (navigateTo) router.push(navigateTo);
      }}
    >
      {isRunning ? "Running demo…" : "Load preloaded target & run demo"}
    </Button>
  );
}
