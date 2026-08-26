const STYLES = {
  critical: "bg-signal-dim text-signal",
  high: "bg-signal-dim text-sev-high",
  medium: "bg-amber-dim text-amber",
  low: "bg-amber-dim text-sev-low",
  info: "bg-raised text-fg-muted",
  teal: "bg-teal-dim text-teal",
  amber: "bg-amber-dim text-amber",
  signal: "bg-signal-dim text-signal",
  blue: "bg-blue-dim text-blue",
  violet: "bg-violet-dim text-violet",
  gray: "bg-raised text-fg-secondary",
} as const;

export type BadgeColor = keyof typeof STYLES;

export function Badge({
  color = "gray",
  children,
}: {
  color?: BadgeColor;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-semibold ${STYLES[color]}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const MAP: Record<string, BadgeColor> = {
    active: "signal",
    completed: "teal",
    reported: "blue",
    paused: "amber",
    planned: "gray",
  };
  return <Badge color={MAP[status] ?? "gray"}>{status.replace(/_/g, " ")}</Badge>;
}
