import { Skeleton } from "@/components/ui/skeleton";

/** Shared loading skeleton for heavy ERP list / ops routes. */
export function ErpRouteSkeleton({
  rows = 6,
  showMetrics = false,
}: {
  rows?: number;
  showMetrics?: boolean;
}) {
  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      {showMetrics ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : null}
      <Skeleton className="h-10 w-full max-w-md rounded-lg" />
      <div className="space-y-2 rounded-xl border p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
