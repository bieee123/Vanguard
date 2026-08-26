const COLOR: Record<string, string> = {
  draft: "bg-raised text-fg-secondary",
  queued: "bg-blue-dim text-blue",
  generating: "bg-amber-dim text-amber",
  generated: "bg-teal-dim text-teal",
  failed: "bg-signal-dim text-signal",
};

export function ReportStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-semibold ${COLOR[status] ?? "bg-raised text-fg-secondary"}`}>
      {status}
    </span>
  );
}
