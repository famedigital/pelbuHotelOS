/** Instant placeholder while a desk page's RSC payload streams in. */
export function DeskMainSkeleton() {
  return (
    <div
      className="erp space-y-4 px-4 py-4 md:px-6 md:py-6"
      aria-busy="true"
      aria-label="Loading desk"
    >
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      <div className="h-7 w-40 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border bg-card"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl border bg-card" />
        <div className="h-64 animate-pulse rounded-xl border bg-card" />
      </div>
    </div>
  );
}
