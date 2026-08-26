import { PanelToolbar } from "@/components/ui/panel-toolbar";

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
  toolbar = false,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** data-driven panels get the observability hover toolbar (refresh/expand/more) */
  toolbar?: boolean;
}) {
  return (
    <section
      className={`group/panel rounded-md border border-line-subtle bg-panel ${className}`}
    >
      {(title || actions || toolbar) && (
        <header className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3">
          <div>
            {title && (
              <h2 className="font-display text-base font-semibold text-fg-primary">{title}</h2>
            )}
            {description && <p className="text-xs text-fg-muted">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {toolbar && <PanelToolbar />}
          </div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
