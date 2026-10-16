"use client";

import { fetchDailyDeskSnapshot } from "@/app/actions/desk-read-loaders";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { FoTodayWorklist } from "@/components/erp/FoTodayWorklist";
import { TomorrowArrivals } from "@/components/erp/TomorrowArrivals";
import { MissingGuideScans } from "@/components/erp/MissingGuideScans";
import { AgentFollowupPanel } from "@/components/erp/AgentFollowupPanel";
import { DailyStayTable } from "@/components/erp/DailyStayTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { cn } from "@/lib/utils";
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

type FilterKey = "all" | "arrivals" | "in_house" | "departures" | "unpaid";

/**
 * Living FO assistant — Do / Report / Check.
 * Perf: cache hydrate, incremental live patch, Assist lazy, Gemini never blocks paint.
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
  const [hydrating, setHydrating] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [assistOpen, setAssistOpen] = useState(false);
  const paintedAt = useRef<number | null>(null);

  useEffect(() => {
    paintedAt.current = performance.now();
    let cancelled = false;
    const key = deskCacheKey("dailyDesk", propertyId);
    void (async () => {
      const cached = await getDeskReadCache<DailyDeskSnapshot>(key, propertyId);
      if (!cancelled && cached?.payload) {
        setSnap(cached.payload);
      }
      if (!cancelled) setHydrating(false);
      await setDeskReadCache({
        key,
        propertyId,
        payload: initial,
        hardMs: DESK_CACHE_TTL.dailyDesk.hardMs,
      });
      if (
        process.env.NODE_ENV === "development" &&
        paintedAt.current != null
      ) {
        console.debug(
          `[fo-assistant] first lane ${Math.round(performance.now() - paintedAt.current)}ms`,
        );
      }
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

  const briefingInput = useMemo(
    () => foAssistantBriefingInput(snap),
    [snap],
  );
  const briefing = useMemo(
    () => buildDeterministicFoBriefing(briefingInput),
    [briefingInput],
  );

  const doActions = useMemo(
    () => capDoActions(snap.actions, 20),
    [snap.actions],
  );

  const checkRows = useMemo(() => {
    const rows: { id: string; title: string; hint: string; href?: string }[] =
      [];
    for (const g of snap.missingGuideScans.slice(0, 8)) {
      rows.push({
        id: `guide-${g.bookingId}`,
        title: g.guestName ?? "Guest",
        hint: "Missing guide scan / number",
        href: `/erp/stayview?booking=${encodeURIComponent(g.bookingId)}&step=check_out`,
      });
    }
    for (const d of snap.dayOps.departures.slice(0, 12)) {
      if (Math.abs(Number(d.folio_balance_btn ?? 0)) > 0.5) {
        rows.push({
          id: `due-${d.id}`,
          title: d.contact_name ?? "Guest",
          hint: "Due-out — Due not Clear",
          href: `/erp/stayview?booking=${encodeURIComponent(d.id)}&step=stay_money`,
        });
      }
    }
    for (const a of snap.dayOps.arrivals.slice(0, 8)) {
      if (!a.room_labels?.trim()) {
        rows.push({
          id: `room-${a.id}`,
          title: a.contact_name ?? "Guest",
          hint: "Arrival — no room assigned",
          href: `/erp/stayview?booking=${encodeURIComponent(a.id)}&step=check_in`,
        });
      }
    }
    return rows.slice(0, 12);
  }, [snap]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
            FO assistant
          </p>
          <h2 className="truncate text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            {propertyName}
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            Working date {snap.businessDate}
            {snap.wallToday !== snap.businessDate
              ? ` · wall ${snap.wallToday}`
              : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FrontDeskLiveRefresh onInvalidate={onInvalidate} />
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href="/erp/calendar">Rack</Link>
          </Button>
          <Button asChild size="sm" className="h-9">
            <Link href="/erp/night-audit">Night close</Link>
          </Button>
        </div>
      </div>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base font-medium">Shift briefing</CardTitle>
          <CardDescription className="text-sm text-foreground">
            {hydrating ? <Skeleton className="h-4 w-3/4" /> : briefing}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pb-4">
          <Badge variant="secondary" className="tabular-nums">
            Do {briefingInput.doCount}
          </Badge>
          <Badge variant="outline" className="tabular-nums">
            Arrivals {briefingInput.arrivals}
          </Badge>
          <Badge variant="outline" className="tabular-nums">
            Due-out {briefingInput.departures}
          </Badge>
          <Badge
            variant={briefingInput.agentUnpaid > 0 ? "destructive" : "outline"}
            className="tabular-nums"
          >
            Agent pay {briefingInput.agentUnpaid}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setAssistOpen(true)}
          >
            Paste agent message
          </Button>
        </CardContent>
      </Card>

      {snap.nightAuditStale ? (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTitle>Night close needed</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Working date is still {snap.businessDate}. Close the prior day
              before new check-ins.
            </span>
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link href="/erp/night-audit">Open Night close</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {assistOpen ? (
        <StayViewAssistLazy propertyId={propertyId} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Do */}
        <Card className="min-h-[16rem] shadow-none">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">Do</CardTitle>
                <CardDescription>What to do now — tap opens Hub</CardDescription>
              </div>
              <Badge className="tabular-nums">{doActions.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {(
                [
                  ["all", "Ranked"],
                  ["arrivals", "Arrivals"],
                  ["in_house", "In-house"],
                  ["departures", "Due-out"],
                  ["unpaid", "Unpaid"],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={filter === key ? "default" : "outline"}
                  className="h-8"
                  onClick={() => setFilter(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {hydrating && doActions.length === 0 ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : filter === "all" ? (
              <ScrollArea className="max-h-[min(28rem,55vh)] pr-2">
                <FoTodayWorklist actions={doActions} />
              </ScrollArea>
            ) : filter === "arrivals" ? (
              <DailyStayTable
                rows={snap.dayOps.arrivals}
                board="arrivals"
                emptyMessage="No check-ins today."
              />
            ) : filter === "departures" ? (
              <DailyStayTable
                rows={snap.dayOps.departures}
                board="departures"
                emptyMessage="No check-outs today."
              />
            ) : filter === "in_house" ? (
              <DailyStayTable
                rows={snap.dayOps.inHouse}
                board="in_house"
                emptyMessage="No guests in house."
              />
            ) : (
              <AgentFollowupPanel
                rows={snap.agentFollowup}
                unpaidCount={snap.agentUnpaidCount}
                paidCount={snap.agentPaidCount}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Report */}
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Report</CardTitle>
              <CardDescription>What to tell · print · close</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ReportRow
                label="Unpaid / agent follow-up"
                value={snap.agentUnpaidCount}
                href="/erp/unpaid-bills"
                warn={snap.agentUnpaidCount > 0}
              />
              <ReportRow
                label="Night close"
                value={snap.nightAuditStale ? "Due" : "OK"}
                href="/erp/night-audit"
                warn={snap.nightAuditStale}
              />
              <ReportRow
                label="In-house"
                value={snap.dayOps.inHouse.length}
                href="/erp/stayview"
              />
              <Button asChild variant="outline" size="sm" className="mt-1 h-9 w-full">
                <Link href="/erp/unpaid-bills">Open unpaid list</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Check */}
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Check</CardTitle>
              <CardDescription>Verify before trouble</CardDescription>
            </CardHeader>
            <CardContent>
              {checkRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing flagged — keep Due Clear on due-outs.
                </p>
              ) : (
                <ul className="space-y-2">
                  {checkRows.map((row) => (
                    <li key={row.id}>
                      {row.href ? (
                        <Link
                          href={row.href}
                          className={cn(
                            "block rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50",
                          )}
                        >
                          <span className="font-medium text-foreground">
                            {row.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {row.hint}
                          </span>
                        </Link>
                      ) : (
                        <div className="rounded-md border px-3 py-2 text-sm">
                          {row.title}
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {row.hint}
                          </span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <details className="group rounded-xl border bg-card">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            Later
            <span className="text-xs font-normal text-muted-foreground group-open:hidden">
              Tomorrow · guides · rota
            </span>
            <span className="hidden text-xs font-normal text-accent group-open:inline">
              Hide
            </span>
          </span>
        </summary>
        <Separator />
        <div className="space-y-4 p-4">
          <TomorrowArrivals rows={snap.tomorrowArrivals} />
          <MissingGuideScans rows={snap.missingGuideScans} />
          <DailyToolsStrip snap={snap} />
        </div>
      </details>
    </div>
  );
}

function ReportRow({
  label,
  value,
  href,
  warn,
}: {
  label: string;
  value: string | number;
  href: string;
  warn?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/40"
    >
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-semibold tabular-nums",
          warn ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </span>
    </Link>
  );
}

function DailyToolsStrip({ snap }: { snap: DailyDeskSnapshot }) {
  const rota = snap.tools.rotaToday;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="shadow-none">
        <CardHeader className="p-3 pb-1">
          <CardTitle className="text-sm">Rota today</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
          {rota.length === 0
            ? "No shifts published."
            : `${rota.length} on duty`}
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader className="p-3 pb-1">
          <CardTitle className="text-sm">Open POs</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 text-sm font-semibold tabular-nums">
          {snap.tools.openPurchaseOrders}
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader className="p-3 pb-1">
          <CardTitle className="text-sm">Store issues</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 text-sm font-semibold tabular-nums">
          {snap.tools.issueMovesToday}
        </CardContent>
      </Card>
    </div>
  );
}
