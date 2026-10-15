import { ScanConsole } from "@/components/console/ScanConsole";
import { TerminalLog } from "@/components/console/TerminalLog";

export default function ConsolePage() {
  return (
    <div className="grid animate-fade-in gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
      <ScanConsole />
      <div className="lg:sticky lg:top-[88px] lg:self-start">
        <TerminalLog />
      </div>
    </div>
  );
}
