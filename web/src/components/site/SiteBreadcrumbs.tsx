import { cn } from "@/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

export type BreadcrumbItem = {
  name: string;
  /** Absolute site path (“/”, “/menu”). Omit or use current path for the last crumb (not a link). */
  path?: string;
};

type Props = {
  items: BreadcrumbItem[];
  className?: string;
  /** Dimmer text for solid header pages. */
  tone?: "default" | "on-muted";
};

/**
 * Visible public breadcrumbs for Google + Search Console.
 * Pair with `breadcrumbJsonLd()` in page metadata script — names/paths must match.
 *
 * Uses semantic nav + ordered list (recommended by Google for HTML breadcrumbs).
 */
export function SiteBreadcrumbs({
  items,
  className,
  tone = "default",
}: Props) {
  if (items.length < 2) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "min-w-0",
        tone === "on-muted" ? "text-muted-foreground" : "text-muted-foreground",
        className,
      )}
    >
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 text-xs md:text-[13px]">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.name}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <ChevronRightIcon
                  className="size-3.5 shrink-0 opacity-50"
                  aria-hidden
                />
              ) : null}
              {last || !item.path ? (
                <span
                  className={cn(
                    "truncate font-medium",
                    last ? "text-foreground" : undefined,
                  )}
                  aria-current={last ? "page" : undefined}
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.path}
                  className="truncate transition-colors hover:text-foreground hover:underline hover:underline-offset-4"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
