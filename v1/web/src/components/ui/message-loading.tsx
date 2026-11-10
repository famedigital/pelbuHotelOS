import { cn } from "@/lib/utils";

/** Three-dot pulse for desk chat / sync affordances. */
export function MessageLoading({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center gap-1 px-1 py-0.5", className)}
      role="status"
      aria-label="Loading"
    >
      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:0ms]" />
      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
    </div>
  );
}
