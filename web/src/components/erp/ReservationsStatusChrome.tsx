"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReservationStatusBucket } from "@/lib/erp/reservation-status-buckets";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

function bucketHref(
  base: Record<string, string | undefined>,
  bucket: ReservationStatusBucket,
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (v?.trim()) p.set(k, v.trim());
  }
  if (bucket !== "all") p.set("bucket", bucket);
  else p.delete("bucket");
  p.delete("status");
  p.delete("worklist");
  const s = p.toString();
  return s ? `/erp/reservations?${s}` : "/erp/reservations";
}

export function ReservationsStatusChrome({
  bucket,
  worklist,
  counts,
  queryBase,
  exportHref,
  printHref,
  summary,
  exceptions,
  showCalendar,
  aside,
}: {
  bucket: ReservationStatusBucket;
  worklist: string;
  counts: {
    active: number;
    cancelled: number;
    no_show: number;
    checked_out: number;
    all: number;
    deposit_due: number;
  };
  queryBase: Record<string, string | undefined>;
  exportHref: string;
  printHref: string;
  summary: string;
  exceptions: { label: string; href: string }[];
  showCalendar: boolean;
  aside?: ReactNode;
}) {
  const depositOn = worklist === "deposit_due";
  const chips: {
    id: ReservationStatusBucket;
    label: string;
    count: number;
  }[] = [
    { id: "active", label: "Active", count: counts.active },
    { id: "cancelled", label: "Cancelled", count: counts.cancelled },
    { id: "no_show", label: "No-show", count: counts.no_show },
    { id: "checked_out", label: "Departed", count: counts.checked_out },
    { id: "all", label: "All", count: counts.all },
  ];

  const depositHref = (() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(queryBase)) {
      if (v?.trim()) p.set(k, v.trim());
    }
    p.set("worklist", "deposit_due");
    p.delete("status");
    p.delete("bucket");
    return `/erp/reservations?${p.toString()}`;
  })();

  return (
    <div className="space-y-2 print:hidden">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <nav
            aria-label="Reservation status"
            className="bg-muted inline-flex h-8 items-center gap-0.5 rounded-lg p-0.5"
          >
            {chips.map((c) => {
              const on = !depositOn && bucket === c.id;
              return (
                <Link
                  key={c.id}
                  href={bucketHref(queryBase, c.id)}
                  data-state={on ? "active" : "inactive"}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                >
                  {c.label}
                  <span className="tabular-nums opacity-80">{c.count}</span>
                </Link>
              );
            })}
          </nav>
          <Link
            href={depositHref}
            data-state={depositOn ? "active" : "inactive"}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-destructive/50 px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 data-[state=active]:bg-destructive data-[state=active]:text-white"
          >
            Deposit due
            <span className="tabular-nums">{counts.deposit_due}</span>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">{summary}</p>
          {aside}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 bg-background"
              >
                <MoreHorizontal className="size-4" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild className="focus:text-foreground">
                <Link href={exportHref}>Export CSV</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:text-foreground">
                <Link href={printHref} target="_blank">
                  Print list
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="focus:text-foreground">
                <Link href="/erp/group">Groups desk</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:text-foreground">
                <Link href="/erp/arrivals">Check-in due</Link>
              </DropdownMenuItem>
              {showCalendar ? (
                <DropdownMenuItem asChild className="focus:text-foreground">
                  <Link href="/erp/calendar">Assign on calendar</Link>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {exceptions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {exceptions.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "font-medium underline-offset-4 hover:underline",
                item.label.startsWith("Suggested")
                  ? "text-citrus-600"
                  : "text-destructive",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
