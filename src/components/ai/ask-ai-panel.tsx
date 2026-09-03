"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PanelRight, X } from "lucide-react";
import { AskKbPanel } from "./ask-kb-panel";

/**
 * Full-height right sidebar (Antigravity-style, mirrors the left Sidebar):
 * opens via `?ai=1` on the current route and PUSHES the main content narrower.
 * Rendered at the app layout level so it spans the whole frame, not a page card.
 */
export function AiAskPanel({ modelLabel }: { modelLabel?: string | null }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const open = params.get("ai") === "1";

  function setOpen(next: boolean) {
    const n = new URLSearchParams(params.toString());
    if (next) n.set("ai", "1");
    else n.delete("ai");
    const qs = n.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  if (!open) return null;

  return (
    <aside className="flex w-[24rem] shrink-0 flex-col border-l border-line-subtle bg-panel">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line-subtle bg-raised px-4">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-fg-primary">
          <PanelRight size={16} strokeWidth={1.75} />
          Ask AI
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close Ask AI"
          className="btn btn-secondary px-2 py-0.5 text-xs"
        >
          <X size={13} /> Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <AskKbPanel modelLabel={modelLabel} />
      </div>
    </aside>
  );
}
