"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Slide-in right drawer (design-system §5). Server components pass title/children through —
 * they stay serializable. Esc closes, backdrop click closes, focus moves to the close button.
 */
export function Drawer({
  label,
  title,
  children,
  triggerClass = "",
  widthClass = "max-w-xl",
}: {
  label: React.ReactNode;
  title: string;
  children: React.ReactNode;
  triggerClass?: string;
  widthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // ponytail: focus is moved but not fully trapped — acceptable until an a11y audit says otherwise
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className={`text-left ${triggerClass}`} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside
            role="dialog"
            aria-label={title}
            className={`absolute inset-y-0 right-0 flex w-full ${widthClass} flex-col rounded-l-lg border-l border-line-subtle bg-panel`}
          >
            <header className="flex items-center justify-between border-b border-line-subtle bg-raised px-4 py-3">
              <h2 className="font-display text-base font-semibold">{title}</h2>
              <button ref={closeRef} onClick={() => setOpen(false)} className="btn btn-secondary px-2 py-0.5 text-xs">
                Close ✕
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
          </aside>
        </div>
      )}
    </>
  );
}
