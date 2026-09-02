"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";

type Result = { id: string; title: string; subtitle?: string; severity?: string };
type Groups = { engagements: Result[]; findings: Result[]; assets: Result[] };

const EMPTY: Groups = { engagements: [], findings: [], assets: [] };
const SEV_COLOR: Record<string, string> = {
  critical: "text-signal",
  high: "text-sev-high",
  medium: "text-amber",
  low: "text-fg-muted",
  info: "text-fg-disabled",
};

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Groups>(EMPTY);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    const query = q.trim();
    if (query.length < 2) {
      setGroups(EMPTY);
      setOpen(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) setGroups((await res.json()) as Groups);
      } catch {
        setGroups(EMPTY);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const total = groups.engagements.length + groups.findings.length + groups.assets.length;

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search engagements, findings, assets…"
          aria-label="Global search"
          className="input w-64 bg-panel py-1 pl-7 pr-2 text-xs"
          onFocus={() => q.trim().length >= 2 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim().length >= 2) {
              router.push(`/findings?q=${encodeURIComponent(q.trim())}`);
              setOpen(false);
            }
          }}
        />
      </div>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-md border border-line-subtle bg-panel shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-xs text-fg-muted">Searching…</p>
          ) : total === 0 ? (
            <p className="px-3 py-2 text-xs text-fg-muted">No matches for “{q.trim()}”.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {(["engagements", "findings", "assets"] as const).map((key) =>
                groups[key].length === 0 ? null : (
                  <div key={key} className="border-b border-line-subtle last:border-0">
                    <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
                      {key}
                    </p>
                    {groups[key].map((r) => (
                      <Link
                        key={r.id}
                        href={
                          key === "engagements"
                            ? `/engagements/${r.id}`
                            : key === "findings"
                              ? `/findings/${r.id}`
                              : `/assets/${r.id}`
                        }
                        onClick={() => {
                          setOpen(false);
                          setQ("");
                        }}
                        className="flex flex-col gap-0.5 px-3 py-1.5 text-xs hover:bg-hover"
                      >
                        <span className="flex items-center gap-2 font-medium text-fg-primary">
                          <span className="truncate">{r.title}</span>
                          {key === "findings" && r.severity && (
                            <span className={`ml-auto shrink-0 ${SEV_COLOR[r.severity] ?? ""}`}>
                              {r.severity}
                            </span>
                          )}
                        </span>
                        {r.subtitle && <span className="truncate text-[11px] text-fg-muted">{r.subtitle}</span>}
                      </Link>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
          <button
            onClick={() => {
              router.push(`/findings?q=${encodeURIComponent(q.trim())}`);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 border-t border-line-subtle px-3 py-1.5 text-[11px] text-fg-muted hover:bg-hover"
          >
            <CornerDownLeft size={11} />
            Search all findings for “{q.trim()}”
          </button>
        </div>
      )}
    </div>
  );
}
