import { DeskHelpHint } from "@/components/erp/DeskHelpHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import Link from "next/link";

const BLURB_INLINE_MAX = 96;

/**
 * Global ERP section chrome — every list/ops page should use this (or
 * DeskPageTitle for odd one-offs) so ModuleTabs → sticky section bar →
 * workspace feels systematic.
 *
 * Hierarchy:
 * 1. ModuleTabs (destinations) — shell
 * 2. Sticky title + actions + optional 1-line blurb / help
 * 3. `filters` slot — views, search (DeskViewSwitcher, DeskSearchForm)
 * 4. `metrics` slot — thin DeskMetricRow (optional)
 * 5. children — workspace only
 */
export function DeskListShell({
  eyebrow,
  heading,
  blurb,
  subtitle,
  help,
  children,
  filters,
  metrics,
  headerAside,
  className,
}: {
  /** Kept for backward compat. Ignored — title is now in the shell header. */
  title?: string;
  eyebrow?: string;
  heading: string;
  /** Longer copy → help popover. Short copy may render as one-line subtitle. */
  blurb?: string;
  /** Explicit one-line under the title (preferred over long blurb). */
  subtitle?: string;
  /** Override help body when `blurb` is used only as subtitle. */
  help?: ReactNode;
  filters?: ReactNode;
  metrics?: ReactNode;
  /** Live badge, CTAs, etc. — aligned top-right of the section bar. */
  headerAside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const shortLine =
    subtitle?.trim() ||
    (blurb && blurb.trim().length <= BLURB_INLINE_MAX ? blurb.trim() : null);

  const helpBody =
    help ??
    (blurb && blurb.trim().length > BLURB_INLINE_MAX ? blurb.trim() : null);

  return (
    <div
      className={cn(
        "erp mx-auto flex w-full max-w-[1200px] flex-col",
        className,
      )}
    >
      <header className="sticky top-14 z-20 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="flex flex-col gap-3 px-4 py-3 md:px-6 md:py-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              {eyebrow ? (
                <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
                  {eyebrow}
                </p>
              ) : null}
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                  {heading}
                </h1>
                {helpBody ? (
                  <DeskHelpHint>
                    {typeof helpBody === "string" ? (
                      <p>{helpBody}</p>
                    ) : (
                      helpBody
                    )}
                  </DeskHelpHint>
                ) : null}
              </div>
              {shortLine ? (
                <p className="max-w-2xl text-sm leading-snug text-muted-foreground line-clamp-1">
                  {shortLine}
                </p>
              ) : null}
            </div>
            {headerAside ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {headerAside}
              </div>
            ) : null}
          </div>

          {filters ? (
            <div className="flex flex-wrap items-center gap-2">{filters}</div>
          ) : null}

          {metrics ? <div className="min-w-0">{metrics}</div> : null}
        </div>
      </header>

      <div className="flex flex-col gap-6 p-4 md:gap-8 md:p-6">{children}</div>
    </div>
  );
}

/** Alias — same component; prefer this name in new code. */
export const DeskSectionChrome = DeskListShell;

export function DeskSearchForm({
  action,
  q,
  placeholder,
  children,
}: {
  action: string;
  q?: string;
  placeholder: string;
  children?: ReactNode;
}) {
  return (
    <form
      className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
      action={action}
      method="get"
    >
      <div className="min-w-[180px] max-w-sm flex-1">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <Input
          id="q"
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={placeholder}
          className="h-9"
        />
      </div>
      {children}
      <Button type="submit" variant="outline" className="h-9">
        Search
      </Button>
    </form>
  );
}

/**
 * Legacy thin-table wrapper for ERP list pages still using DeskTable.
 * Renders on shadcn Table primitives so they pick up the Sky theme.
 * Pages are being migrated to <DataTable /> wave by wave.
 */
export function DeskTable({
  caption,
  headers,
  children,
  empty,
}: {
  caption: string;
  headers: string[];
  children: ReactNode;
  empty?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table className="min-w-[640px]">
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {headers.map((h) => (
              <TableHead
                key={h}
                scope="col"
                className="h-10 bg-muted/40 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
      {empty ? (
        <p className="border-t px-5 py-6 text-sm text-muted-foreground">
          {empty}
        </p>
      ) : null}
    </div>
  );
}

/** Helper for existing DeskTable cells (kept for backward compatibility). */
export function Cell({ className, ...props }: React.ComponentProps<"td">) {
  return <TableCell className={cn("px-3 py-2.5", className)} {...props} />;
}

/** Status pill on shadcn Badge shapes — semantic tones mapped to ERP tokens. */
export function StatusPill({ value }: { value: string }) {
  if (!value) return null;
  const tone =
    value === "checked_in" ||
    value === "approved" ||
    value === "open" ||
    value === "served"
      ? "border-citrus/40 bg-citrus-tint/60 text-citrus"
      : value === "confirmed" ||
          value === "ready" ||
          value === "posted" ||
          value === "paid"
        ? "border-accent/30 bg-accent/10 text-accent"
        : value === "held" ||
            value === "pending" ||
            value === "new" ||
            value === "preparing"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap",
        tone,
      )}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

/** Slot for an inline "new" CTA in DeskListShell headers — used by list pages. */
export function DeskShellActionLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Button asChild size="sm" className="h-9">
      <Link href={href}>{children}</Link>
    </Button>
  );
}
