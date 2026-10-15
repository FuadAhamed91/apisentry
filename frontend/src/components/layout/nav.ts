import {
  GitCompare,
  History,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  TerminalSquare,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/console", label: "Scan Console", icon: TerminalSquare },
  { href: "/findings", label: "Findings", icon: ShieldAlert },
  { href: "/diff", label: "Response Diff", icon: GitCompare },
  { href: "/remediation", label: "Remediation", icon: Wrench },
  { href: "/history", label: "Scan History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function titleForPath(pathname: string): string {
  const match = NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)));
  return match?.label ?? "APISentry";
}
