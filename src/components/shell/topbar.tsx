import Link from "next/link";
import { prisma } from "@/lib/db";
import { LogoutButton } from "@/components/shell/logout-button";
import { RefreshButton } from "@/components/shell/refresh-button";
import { EngagementSelector, TimeRangeSelect } from "@/components/shell/topbar-client";

export async function Topbar({ userName }: { userName: string }) {
  const projects = await prisma.project.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
    take: 100,
  });

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line-subtle bg-raised px-4">
      {/* left: mark + workspace label */}
      <Link href="/" className="font-display text-sm font-bold tracking-widest text-fg-primary">
        VANGUARD
      </Link>
      <span className="text-xs text-fg-muted">ops</span>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden lg:block">
          <EngagementSelector projects={projects} />
        </div>

        <form action="/findings" className="hidden md:block">
          <input
            name="q"
            placeholder="Search findings..."
            className="input w-52 bg-panel py-1 text-xs"
            aria-label="Global search"
          />
        </form>

        <div className="hidden xl:block">
          <TimeRangeSelect />
        </div>

        <RefreshButton />

        {/* notification bell — placeholder until M15 Notifications */}
        <span className="cursor-not-allowed text-fg-disabled" title="Notifications land in Sprint 5">
          🔔
        </span>

        <span className="text-[13px] text-fg-secondary">{userName}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
