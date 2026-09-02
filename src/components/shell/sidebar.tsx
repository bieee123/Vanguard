"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  LayoutDashboard,
  Building2,
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
  PanelLeft,
  Settings,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/engagements", label: "Engagements", icon: Swords },
      { href: "/timeline", label: "Timeline", icon: Clock },
      { href: "/tasks", label: "Tasks", icon: KanbanSquare },
    ],
  },
  {
    label: "Findings",
    items: [
      { href: "/findings", label: "Findings", icon: Bug },
      { href: "/attack-matrix", label: "ATT&CK Matrix", icon: Grid3X3 },
      { href: "/rule-requests", label: "Rule Requests", icon: ShieldAlert },
      { href: "/dettct", label: "DeTT&CT Coverage", icon: Radar },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/applications", label: "Applications", icon: Building2 },
      { href: "/assets", label: "Assets", icon: Boxes },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { href: "/kb", label: "Knowledge Base", icon: BookOpen },
      { href: "/reports", label: "Reports", icon: FileText },
    ],
  },
];

function itemActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  // ponytail: one flat set of open groups, default all open; persisted per-mount only.
  // Persist group state in localStorage if deep-navigation UX demands it.
  const [open, setOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(GROUPS.map((g) => [g.label, true]))
  );

  const toggleGroup = (label: string) =>
    setOpen((o) => ({ ...o, [label]: !o[label] }));

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-line-subtle bg-panel transition-[width] duration-150 ${
        collapsed ? "w-12" : "w-60"
      }`}
    >
      <div className="flex h-14 items-center border-b border-line-subtle">
        {collapsed ? (
          <button
            aria-label="Expand sidebar"
            title="Expand sidebar"
            onClick={() => setCollapsed(false)}
            className="mx-auto rounded-sm p-1.5 text-fg-secondary hover:bg-hover hover:text-fg-primary"
          >
            <PanelLeft size={18} strokeWidth={1.75} />
          </button>
        ) : (
          <div className="flex w-full items-center gap-2 px-3">
            <span className="truncate font-display text-sm font-bold tracking-widest text-fg-primary">
              VANGUARD
            </span>
            <span className="text-xs text-fg-muted">ops</span>
            <button
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              onClick={() => setCollapsed(true)}
              className="ml-auto rounded-sm p-1 text-fg-secondary hover:bg-hover hover:text-fg-primary"
            >
              <PanelLeft size={16} strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {GROUPS.map((group) => {
          const isOpen = open[group.label];
          if (collapsed) {
            return (
              <div key={group.label} className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = itemActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={label}
                      className={`flex items-center justify-center rounded-sm px-1 py-2 ${
                        active
                          ? "border-l-[3px] border-l-signal bg-raised text-fg-primary"
                          : "border-l-[3px] border-l-transparent text-fg-secondary hover:bg-hover hover:text-fg-primary"
                      }`}
                    >
                      <Icon size={18} strokeWidth={1.75} />
                    </Link>
                  );
                })}
              </div>
            );
          }
          return (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted hover:bg-hover hover:text-fg-primary"
              >
                <ChevronDown
                  size={12}
                  strokeWidth={2}
                  className={`shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                />
                {group.label}
              </button>
              {isOpen && (
                <div className="mb-1 mt-0.5 space-y-0.5">
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const active = itemActive(pathname, href);
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
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-line-subtle p-2">
        <Link
          href="/settings/account"
          title="Settings"
          className={
            collapsed
              ? "flex items-center justify-center rounded-sm p-2 text-fg-secondary hover:bg-hover hover:text-fg-primary"
              : `flex items-center gap-2.5 rounded-sm px-3 py-1.5 text-[13px] ${
                  pathname.startsWith("/settings")
                    ? "border-l-[3px] border-l-signal bg-raised text-fg-primary"
                    : "border-l-[3px] border-l-transparent text-fg-secondary hover:bg-hover hover:text-fg-primary"
                }`
          }
        >
          <Settings size={18} strokeWidth={1.75} />
          {!collapsed && <span>Settings</span>}
        </Link>
      </div>
    </aside>
  );
}
