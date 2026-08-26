"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Swords,
  Boxes,
  Bug,
  Grid3X3,
  Clock,
  ShieldAlert,
  BookOpen,
  Radar,
  FileText,
  KanbanSquare,
  Settings,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/engagements", label: "Engagements", icon: Swords },
  { href: "/assets", label: "Assets", icon: Boxes },
  { href: "/findings", label: "Findings", icon: Bug },
  { href: "/attack-matrix", label: "ATT&CK Matrix", icon: Grid3X3 },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/rule-requests", label: "Rule Requests", icon: ShieldAlert },
  { href: "/kb", label: "Knowledge Base", icon: BookOpen },
  { href: "/dettct", label: "DeTT&CT Coverage", icon: Radar },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/tasks", label: "Tasks", icon: KanbanSquare },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line-subtle bg-panel">
      <div className="flex h-14 items-center gap-2 border-b border-line-subtle px-4">
        <span className="font-display text-sm font-bold tracking-widest text-fg-primary">
          VANGUARD
        </span>
        <span className="text-xs text-fg-muted">ops</span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-sm px-3 py-1.5 text-[13px] ${
                active
                  ? "border-l-[3px] border-l-signal bg-raised text-fg-primary"
                  : "border-l-[3px] border-l-transparent text-fg-secondary hover:bg-hover hover:text-fg-primary"
              }`}
            >
              <Icon size={18} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-2">
        <Link
          href="/settings/account"
          className={`flex items-center gap-2.5 rounded-sm px-3 py-1.5 text-[13px] ${
            pathname.startsWith("/settings")
              ? "border-l-[3px] border-l-signal bg-raised text-fg-primary"
              : "border-l-[3px] border-l-transparent text-fg-secondary hover:bg-hover hover:text-fg-primary"
          }`}
        >
          <Settings size={18} strokeWidth={1.75} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
