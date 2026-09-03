"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PanelRight } from "lucide-react";

/**
 * Knowledge base page frame. "Ask AI" opens the global right sidebar via ?ai=1.
 */
export function KbShell({ tags, main }: { tags: React.ReactNode; main: React.ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const open = params.get("ai") === "1";

  function openAiAsk() {
    const n = new URLSearchParams(params.toString());
    n.set("ai", "1");
    router.push(`${pathname}?${n.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Knowledge Base</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openAiAsk}
            aria-pressed={open}
            className={`btn inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] ${
              open ? "btn-primary" : "btn-secondary"
            }`}
          >
            <PanelRight size={15} strokeWidth={1.75} />
            Ask AI
          </button>
          <Link href="/kb/graph" className="btn btn-secondary">
            Graph view
          </Link>
          <Link href="/kb/new" className="btn btn-primary">
            New Note
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="w-full shrink-0 space-y-2 self-start rounded-md border border-line-subtle bg-panel p-3 lg:w-48">
          {tags}
        </aside>
        <div className="min-w-0 flex-1">{main}</div>
      </div>
    </div>
  );
}
