"use client";

import { fetchFoTodaySnapshot } from "@/app/actions/desk-read-loaders";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { FoTodayWorklist } from "@/components/erp/FoTodayWorklist";
import { Button } from "@/components/ui/button";
import type { FoTodaySnapshot } from "@/lib/erp/fo-today";
import Link from "next/link";
import { useCallback, useState } from "react";

/** Today board with fingerprint → patch invalidate (no full white flash). */
export function FoTodayLiveBoard({
  initial,
}: {
  initial: FoTodaySnapshot;
}) {
  const [snap, setSnap] = useState(initial);

  const onInvalidate = useCallback(async () => {
    const result = await fetchFoTodaySnapshot();
    if (!result.ok) throw new Error(result.error);
    setSnap(result.data);
  }, []);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
        <FrontDeskLiveRefresh onInvalidate={onInvalidate} />
        <Link
          href="/erp/calendar"
          className="text-sm text-accent underline-offset-4 hover:underline"
        >
          Stay View
        </Link>
      </div>

      {snap.nightAuditStale ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
          <p className="text-sm text-foreground">
            Working date is still{" "}
            <span className="font-medium tabular-nums">{snap.businessDate}</span>
            . Close the prior day before new check-ins.
          </p>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/erp/night-audit">Night Audit</Link>
          </Button>
        </div>
      ) : null}

      <FoTodayWorklist actions={snap.actions} />
    </>
  );
}
