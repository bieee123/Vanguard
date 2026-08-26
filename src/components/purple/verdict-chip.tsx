const MAP: Record<string, { cls: string; icon: string }> = {
  detected: { cls: "bg-teal-dim text-teal", icon: "✓" },
  not_detected: { cls: "bg-signal-dim text-signal", icon: "✗" },
  partial: { cls: "bg-amber-dim text-amber", icon: "◐" },
  detected_late: { cls: "bg-amber-dim text-amber", icon: "⏱" },
  untested: { cls: "bg-raised text-fg-secondary", icon: "–" },
};

export function VerdictChip({ verdict }: { verdict?: string | null }) {
  const { cls, icon } = MAP[verdict ?? "untested"] ?? MAP.untested;
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <span aria-hidden>{icon}</span>
      {(verdict ?? "untested").replace(/_/g, " ")}
    </span>
  );
}

export function OutcomeDot({ outcome }: { outcome: string }) {
  const color =
    outcome === "success" ? "text-teal" : outcome === "failed" ? "text-fg-muted" : "text-amber";
  return <span className={color} title={outcome}>●</span>;
}
