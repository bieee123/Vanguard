/** Skeleton panels in the same grid as real content — no spinner overlay (design §6.1). */
export default function AppLoading() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-md border border-line-subtle bg-panel" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-52 animate-pulse rounded-md border border-line-subtle bg-panel" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-md border border-line-subtle bg-panel" />
    </div>
  );
}
