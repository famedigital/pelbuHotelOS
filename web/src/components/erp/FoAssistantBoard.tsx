"use client";

import { fetchDailyDeskSnapshot } from "@/app/actions/desk-read-loaders";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { FoDeskHome } from "@/components/erp/FoDeskHome";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DESK_CACHE_TTL,
  deskCacheKey,
  getDeskReadCache,
  setDeskReadCache,
} from "@/lib/desk/desk-read-cache";
import type { DailyDeskSnapshot } from "@/lib/erp/daily-desk";
import { buildDeterministicFoBriefing, foAssistantBriefingInput } from "@/lib/erp/fo-assistant-briefing";
import { recordAssistMetric } from "@/lib/erp/desk-surface-metrics";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const StayViewAssistLazy = dynamic(
  () =>
    import("@/components/erp/StayViewAssistStrip").then(
      (m) => m.StayViewAssistStrip,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="mb-4 h-24 w-full rounded-xl" />,
  },
);

/**
 * Front office home — dashboard totals, then one list per tab.
 */
export function FoAssistantBoard({
  initial,
  propertyId,
  propertyName,
}: {
  initial: DailyDeskSnapshot;
  propertyId: string;
  propertyName: string;
}) {
  const [snap, setSnap] = useState(initial);
  const [assistOpen, setAssistOpen] = useState(false);
  const paintedAt = useRef<number | null>(null);

  useEffect(() => {
    paintedAt.current = performance.now();
    let cancelled = false;
    const key = deskCacheKey("dailyDesk", propertyId);
    void (async () => {
      const cached = await getDeskReadCache<DailyDeskSnapshot>(key, propertyId);
      if (!cancelled && cached?.payload) {
        // Merge: cache may predate new FO ops fields — prefer fresh initial when missing.
        const payload = cached.payload;
        if (
          payload.tomorrowDepartures &&
          payload.emptyRooms &&
          payload.departureInvoices &&
          Array.isArray(payload.nationalityCounts)
        ) {
          setSnap(payload);
        }
      }
      await setDeskReadCache({
        key,
        propertyId,
        payload: initial,
        hardMs: DESK_CACHE_TTL.dailyDesk.hardMs,
      });
      recordAssistMetric("briefing_views");
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId, initial]);

  const onInvalidate = useCallback(async () => {
    const result = await fetchDailyDeskSnapshot();
    if (!result.ok) throw new Error(result.error);
    setSnap(result.data);
    void setDeskReadCache({
      key: deskCacheKey("dailyDesk", propertyId),
      propertyId,
      payload: result.data,
      hardMs: DESK_CACHE_TTL.dailyDesk.hardMs,
    });
  }, [propertyId]);

  const briefing = useMemo(
    () => buildDeterministicFoBriefing(foAssistantBriefingInput(snap)),
    [snap],
  );

  const safeSnap: DailyDeskSnapshot = {
    ...snap,
    tomorrowDepartures: snap.tomorrowDepartures ?? [],
    arrivalMealBuckets: snap.arrivalMealBuckets ?? [],
    inHouseMealBuckets: snap.inHouseMealBuckets ?? [],
    emptyRooms: snap.emptyRooms ?? {
      sellableTotal: 0,
      occupiedToday: 0,
      heldToday: 0,
      vacant: 0,
      ooo: 0,
      dirtyVacant: 0,
      byType: [],
    },
    departureInvoices: snap.departureInvoices ?? {},
    tomorrowDepartureDate: snap.tomorrowDepartureDate ?? "",
    tomorrowDepartureRows: snap.tomorrowDepartureRows ?? [],
    tomorrowDepartureInvoices: snap.tomorrowDepartureInvoices ?? {},
    nationalityCounts: snap.nationalityCounts ?? [],
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight">
            {propertyName}
          </h2>
          <p className="truncate text-xs text-muted-foreground tabular-nums">
            {snap.businessDate}
            {snap.wallToday !== snap.businessDate
              ? ` · wall ${snap.wallToday}`
              : null}
            <span className="mx-1 text-border">·</span>
            <span className="text-foreground/80">{briefing}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FrontDeskLiveRefresh onInvalidate={onInvalidate} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => setAssistOpen((v) => !v)}
          >
            Ask
          </Button>
        </div>
      </div>

      {snap.nightAuditStale ? (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTitle>Night close needed</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>Working date is still {snap.businessDate}.</span>
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link href="/erp/night-audit">Open Night close</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {assistOpen ? <StayViewAssistLazy propertyId={propertyId} /> : null}

      <FoDeskHome snap={safeSnap} onInvalidate={onInvalidate} />
    </div>
  );
}
