"use client";

import { ArrivalPlaybookStrip } from "@/components/erp/ArrivalPlaybookStrip";
import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import { Button } from "@/components/ui/button";
import type { FoNextAction, FoNextKind } from "@/lib/erp/fo-next-action";
import { cn } from "@/lib/utils";
import Link from "next/link";

const KIND_TONE: Record<FoNextKind, string> = {
  check_in: "border-citrus/40 bg-citrus-tint/40",
  collect: "border-maroon/30 bg-maroon/5",
  checkout: "border-accent/30 bg-accent/10",
  housekeeping: "border-rose-400/40 bg-rose-500/5",
  confirm: "border-amber-500/40 bg-amber-500/10",
};

export function FoTodayWorklist({ actions }: { actions: FoNextAction[] }) {
  const stayHub = useStayHubOptional();

  if (actions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center">
        <p className="text-sm font-medium text-foreground">
          No desk jobs for this hotel day
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Walk-in from Stay View — click an empty room on today.
        </p>
        <Button asChild variant="citrus" className="mt-4 min-h-11">
          <Link href="/erp/calendar">Open Stay View</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-lg border bg-card">
      {actions.map((row) => (
        <li
          key={row.id}
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4",
            KIND_TONE[row.kind],
          )}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {row.guestName}
              {row.roomLabel && row.kind !== "housekeeping" ? (
                <span className="ml-2 font-normal text-muted-foreground">
                  · {row.roomLabel}
                </span>
              ) : null}
            </p>
            {row.playbook?.length ? (
              <ArrivalPlaybookStrip steps={row.playbook} />
            ) : null}
            <p className="text-xs text-muted-foreground">{row.why}</p>
          </div>
          {row.bookingId && row.stayHubStep ? (
            <Button
              type="button"
              variant="citrus"
              className="min-h-11 min-w-[8.5rem]"
              onClick={() => {
                stayHub?.openStayHub({
                  bookingId: row.bookingId!,
                  step: row.stayHubStep!,
                  board: "auto",
                });
              }}
            >
              {row.cta}
            </Button>
          ) : (
            <Button asChild variant="outline" className="min-h-11 min-w-[8.5rem]">
              <Link href={row.href}>{row.cta}</Link>
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
