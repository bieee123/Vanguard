/** Compact telemetry-style status indicator (design-system §5). Timestamp is mandatory. */
export function StatusIndicator({
  label,
  state,
  detail,
}: {
  label: string;
  state: "healthy" | "degraded" | "critical" | "inactive";
  detail: string;
}) {
  const color =
    state === "healthy"
      ? "bg-teal"
      : state === "degraded"
        ? "bg-amber"
        : state === "critical"
          ? "bg-signal"
          : "bg-line-strong";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      <span className="font-semibold tracking-wide text-fg-primary">{label}</span>
      <span className="text-fg-muted">{detail}</span>
    </div>
  );
}
