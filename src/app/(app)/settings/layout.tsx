import Link from "next/link";

const NAV = [
  { href: "/settings/account", label: "Account" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/findings", label: "Findings" },
  { href: "/settings/integrations", label: "Integrations" },
  { href: "/settings/users", label: "Users" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">Settings</h1>
      {/* Grafana administration-style: left mini-nav, config panels right (design §6.9) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[13rem_1fr]">
        <nav className="flex flex-col gap-0.5 self-start rounded-md border border-line-subtle bg-panel p-2">
          {NAV.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-sm px-3 py-1.5 text-[13px] text-fg-secondary hover:bg-hover hover:text-fg-primary"
            >
              {t.label}
            </Link>
          ))}
          <span className="mt-2 px-3 text-[10px] uppercase tracking-wide text-fg-disabled">
            AI · Retention — Sprint 5
          </span>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
