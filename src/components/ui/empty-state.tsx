export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-line-subtle bg-panel px-6 py-12 text-center">
      <p className="text-sm text-fg-secondary">{message}</p>
      {action}
    </div>
  );
}
