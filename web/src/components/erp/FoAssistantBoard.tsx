"use client";

import { fetchDailyDeskSnapshot } from "@/app/actions/desk-read-loaders";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { FoOpsDashboard } from "@/components/erp/FoOpsDashboard";
import { FoTodayWorklist } from "@/components/erp/FoTodayWorklist";
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
import {
  buildDeterministicFoBriefing,
  capDoActions,
  foAssistantBriefingInput,
} from "@/lib/erp/fo-assistant-briefing";
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
 * FO StayView home — seven ops blocks + ranked Do list + live refresh.
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
          payload.departureInvoices
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
  const doActions = useMemo(
    () => capDoActions(snap.actions, 12),
    [snap.actions],
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
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
            Front office
          </p>
          <h2 className="truncate text-xl font-semibold tracking-tight md:text-2xl">
            {propertyName}
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {snap.businessDate}
            {snap.wallToday !== snap.businessDate
              ? ` · wall ${snap.wallToday}`
              : null}
            <span className="mx-1.5 text-border">·</span>
            <span className="text-foreground/80">{briefing}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FrontDeskLiveRefresh onInvalidate={onInvalidate} />
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href="/erp/calendar">Rack</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href="/erp/reserve">Reserve</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => setAssistOpen((v) => !v)}
          >
            Ask
          </Button>
          <Button asChild size="sm" className="h-9">
            <Link href="/erp/night-audit">Night close</Link>
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

      <FoOpsDashboard snap={safeSnap} />

      {doActions.length > 0 ? (
        <details className="rounded-md border">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
            Ranked Do list ({doActions.length})
          </summary>
          <div className="border-t px-2 py-2">
            <FoTodayWorklist actions={doActions} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
