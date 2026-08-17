"use client";

import { Button } from "@/components/ui/button";
import type { ReservationStatusBucket } from "@/lib/erp/reservation-status-buckets";
import Link from "next/link";

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
  // clear single status when using buckets
  p.delete("status");
  const s = p.toString();
  return s ? `/erp/reservations?${s}` : "/erp/reservations";
}

export function ReservationsStatusChrome({
  bucket,
  counts,
  queryBase,
  exportHref,
  printHref,
}: {
  bucket: ReservationStatusBucket;
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
}) {
  const chips: {
    id: ReservationStatusBucket;
    label: string;
    count: number;
    tone: string;
  }[] = [
    {
      id: "active",
      label: "Active",
      count: counts.active,
      tone: "border-emerald-600/50 data-[on=true]:bg-emerald-600/15 data-[on=true]:text-emerald-900 dark:data-[on=true]:text-emerald-100",
    },
    {
      id: "cancelled",
      label: "Cancelled",
      count: counts.cancelled,
      tone: "border-sky-600/50 data-[on=true]:bg-sky-600/15 data-[on=true]:text-sky-900 dark:data-[on=true]:text-sky-100",
    },
    {
      id: "no_show",
      label: "No-show",
      count: counts.no_show,
      tone: "border-orange-500/50 data-[on=true]:bg-orange-500/15 data-[on=true]:text-orange-950 dark:data-[on=true]:text-orange-100",
    },
    {
      id: "checked_out",
      label: "Departed",
      count: counts.checked_out,
      tone: "border-border data-[on=true]:bg-muted",
    },
    {
      id: "all",
      label: "All",
      count: counts.all,
      tone: "border-border data-[on=true]:bg-accent/10 data-[on=true]:text-accent",
    },
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
    <div className="mb-4 space-y-2.5 print:hidden">
      <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-card px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <Link
              key={c.id}
              href={bucketHref(queryBase, c.id)}
              data-on={bucket === c.id ? "true" : "false"}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-muted/60 ${c.tone}`}
            >
              {c.label}
              <span className="tabular-nums text-muted-foreground">
                {c.count}
              </span>
            </Link>
          ))}
          <Link
            href={depositHref}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/5"
          >
            Deposit due
            <span className="tabular-nums">{counts.deposit_due}</span>
          </Link>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <Link href={exportHref}>Export CSV</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <Link href={printHref} target="_blank">
              Print list
            </Link>
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-0.5 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-emerald-600" />{" "}
          Active
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-sky-600" />{" "}
          Cancelled
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-orange-500" />{" "}
          No-show
        </span>
        <span className="text-muted-foreground/80">
          Row stripe matches legend
        </span>
      </div>
    </div>
  );
}
