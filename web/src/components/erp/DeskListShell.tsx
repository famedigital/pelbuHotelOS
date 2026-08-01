import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { deskPinConfigured } from "@/lib/desk-auth";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import Link from "next/link";

/**
 * ERP list page layout — renders only the page body (the sidebar shell is
 * provided by web/src/app/erp/layout.tsx). Keeps the same prop surface so
 * existing ERP pages keep compiling.
 */
export function DeskListShell({
  eyebrow,
  heading,
  blurb,
  children,
  filters,
  headerAside,
}: {
  /** Kept for backward compat. Ignored — title is now in the shell header. */
  title?: string;
  eyebrow: string;
  heading: string;
  blurb?: string;
  filters?: ReactNode;
  /** Live badge, CTAs, etc. — aligned top-right of the page header. */
  headerAside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-8 p-4 md:p-6">
      {!deskPinConfigured() ? (
        <Alert variant="warning">
          <AlertTitle>Dev mode</AlertTitle>
          <AlertDescription>
            Desk PIN not set. Add <code className="font-mono">DESK_PIN</code>{" "}
            before production.
          </AlertDescription>
        </Alert>
      ) : null}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
            {eyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {heading}
          </h1>
          {blurb ? (
            <p className="max-w-prose text-sm text-muted-foreground">{blurb}</p>
          ) : null}
        </div>
        {headerAside}
      </header>
      {filters}
      {children}
    </div>
  );
}

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
      className="flex flex-wrap items-center gap-2"
      action={action}
      method="get"
    >
      <div className="min-w-[220px] flex-1">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <Input
          id="q"
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={placeholder}
          className="h-10"
        />
      </div>
      {children}
      <Button type="submit" variant="outline" className="h-10">
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
    <Button asChild>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
