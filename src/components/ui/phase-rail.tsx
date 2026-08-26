const PHASES = ["recon", "exploitation", "post_exploitation", "reporting"] as const;

/** Compact inline phase-tracker rail (design-system §5). */
export function PhaseRail({ current }: { current: string }) {
  const idx = PHASES.indexOf(current as (typeof PHASES)[number]);
  return (
    <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide">
      {PHASES.map((phase, i) => {
        const cls =
          i < idx
            ? "border-teal text-teal"
            : i === idx
              ? "border-signal bg-signal-dim text-signal"
              : "border-line-strong text-fg-muted";
        return (
          <span key={phase} className={`rounded-sm border px-1.5 py-px ${cls}`}>
            {phase.replace(/_/g, " ")}
          </span>
        );
      })}
    </div>
  );
}
