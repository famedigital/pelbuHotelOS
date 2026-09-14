import { cn } from "@/lib/utils";
import Link from "next/link";

export type DeskViewItem = {
  href: string;
  label: string;
  /** Tabular count badge (e.g. TCB directory size). */
  count?: number;
  active?: boolean;
};

/**
 * Mutually exclusive list views — quieter than ModuleTabs.
 * Use for `?view=` / `?tab=` facets, never for cross-section destinations.
 */
export function DeskViewSwitcher({
  items,
  label = "Views",
  className,
}: {
  items: DeskViewItem[];
  label?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5",
        className,
      )}
    >
      {items.map((item) => {
        const active = Boolean(item.active);
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 shrink-0 items-center rounded-md px-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-espresso text-ivory shadow-sm"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            )}
          >
            {item.label}
            {item.count != null ? (
              <span
                className={cn(
                  "ml-1.5 tabular-nums text-xs",
                  active ? "text-ivory/75" : "text-muted-foreground",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
