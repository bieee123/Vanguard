"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Maximize2, RefreshCw } from "lucide-react";

/** Hover toolbar for data-driven panels (design-system §5): refresh + expand + more. */
export function PanelToolbar() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const btn =
    "rounded-sm p-1 text-fg-muted opacity-0 transition-opacity group-hover/panel:opacity-100 focus-visible:opacity-100 hover:bg-hover hover:text-fg-primary";

  return (
    <div className="flex items-center gap-1">
      {expanded && (
        <style>{`.panel-expand-target:fullscreen { background: var(--color-canvas); padding: 24px; overflow:auto; }`}</style>
      )}
      <button aria-label="More actions" className={btn} title="More actions (none yet)">
        <MoreHorizontal size={15} />
      </button>
      <button
        aria-label="Expand panel"
        className={btn}
        title="Expand"
        onClick={(e) => {
          const panel = e.currentTarget.closest("section");
          if (!panel) return;
          panel.classList.toggle("panel-expand-target");
          if (document.fullscreenElement) void document.exitFullscreen();
          else void panel.requestFullscreen?.().catch(() => {});
          setExpanded((v) => !v);
        }}
      >
        <Maximize2 size={15} />
      </button>
      <button aria-label="Refresh" className={btn} title="Refresh" onClick={() => router.refresh()}>
        <RefreshCw size={15} />
      </button>
    </div>
  );
}
