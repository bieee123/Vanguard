"use client";

// Surfaces the actual error instead of a white screen (design §6.1 error state).
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-md border border-signal bg-panel p-6">
        <h1 className="font-display text-lg font-semibold text-signal">Something broke on this panel</h1>
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-sm bg-raised p-3 font-mono text-xs text-fg-secondary">
          {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
        <div className="mt-4 flex gap-2">
          <button onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <a href="/" className="btn btn-secondary">
            Back to dashboard
          </a>
        </div>
        <p className="mt-3 text-[11px] text-fg-muted">
          Check the browser console (F12) and the dev-server log for the full stack.
        </p>
      </div>
    </div>
  );
}
