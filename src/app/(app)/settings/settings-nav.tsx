"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/settings/account", label: "Account" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/findings", label: "Findings" },
  { href: "/settings/integrations", label: "Integrations" },
  { href: "/settings/users", label: "Users" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2">
      {NAV.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={
              "rounded-md border px-4 py-2 text-[13px] transition-colors " +
              (active
                ? "border-signal bg-signal-dim text-fg-primary"
                : "border-line-subtle bg-panel text-fg-secondary hover:border-line-default hover:bg-hover hover:text-fg-primary")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
