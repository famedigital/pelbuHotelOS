import {
  HorizonOccupancyChart,
  MonthRoomsChart,
} from "@/components/erp/ForecastCharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DashboardView } from "@/lib/erp/dashboard-views";
import {
  formatForecastMonthLabel,
  shiftMonthYm,
} from "@/lib/erp/guest-forecast";
import type { RoleDashboardSnapshot } from "@/lib/erp/role-dashboard";
import { fmtDate } from "@/lib/erp-lists";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

function erpDashboardHref(opts: {
  view?: DashboardView;
  homeView?: DashboardView;
  forecastMonthYm?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.view && opts.homeView && opts.view !== opts.homeView) {
    params.set("view", opts.view);
  }
  if (opts.forecastMonthYm) {
    params.set("forecastMonth", opts.forecastMonthYm);
  }
  const q = params.toString();
  return q ? `/erp?${q}` : "/erp";
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function weekday(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return WD[d.getUTCDay()] ?? "";
}

function MetricChip({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5 border-r border-border/70 pr-3 last:border-r-0 last:pr-0">
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          emphasize && "text-citrus",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Compact occupancy forecast — week table + month / horizon charts. No KPI card walls. */
export function GuestForecastPanel({
  snap,
  view,
  homeView,
}: {
  snap: RoleDashboardSnapshot;
  view: DashboardView;
  homeView: DashboardView;
}) {
  const f = snap.guestForecast;
  const monthYm = f.monthYm;
  const monthLabel = formatForecastMonthLabel(monthYm);
  const currentYm = f.businessDate.slice(0, 7);
  const prevYm = shiftMonthYm(monthYm, -1);
  const nextYm = shiftMonthYm(monthYm, 1);
  const prevHref = erpDashboardHref({
    view,
    homeView,
    forecastMonthYm: prevYm !== currentYm ? prevYm : undefined,
  });
  const nextHref = erpDashboardHref({
    view,
    homeView,
    forecastMonthYm: nextYm !== currentYm ? nextYm : undefined,
  });
  const horizonEndLabel = formatForecastMonthLabel(
    f.horizon[f.horizon.length - 1]?.monthYm ?? monthYm,
  );

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-none">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 border-b px-3 py-2.5 md:px-4">
        <div className="min-w-0 space-y-0.5">
          <CardTitle className="text-sm font-semibold tracking-tight">
            Forecast
          </CardTitle>
          <CardDescription className="text-xs">
            Held · confirmed · in-house · {fmtDate(f.businessDate)} ·{" "}
            {f.totalRooms} rooms
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden items-center gap-3 sm:flex">
            <MetricChip
              label="Week"
              value={`${f.weekTotals.occupancyPct}%`}
            />
            <MetricChip
              label={monthLabel.split(" ")[0] ?? "Month"}
              value={`${f.monthTotals.occupancyPct}%`}
              emphasize
            />
            <MetricChip
              label="6-mo"
              value={`${f.horizonTotals.occupancyPct}%`}
            />
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
            <Link href="/erp/calendar">Room rack</Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="grid gap-0 p-0 lg:grid-cols-2">
        {/* Next 7 days */}
        <div className="flex min-w-0 flex-col border-b lg:border-r lg:border-b-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-1.5">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Next 7 days
            </p>
            <p className="text-[11px] tabular-nums text-muted-foreground">
              Arr {f.weekTotals.arrivals} · Dep {f.weekTotals.departures} · peak{" "}
              {f.weekTotals.peakRooms} rms · {f.weekTotals.occupancyPct}%
            </p>
          </div>
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-8 px-3 text-[10px]">Day</TableHead>
                <TableHead className="h-8 px-2 text-right text-[10px]">
                  Arr
                </TableHead>
                <TableHead className="h-8 px-2 text-right text-[10px]">
                  Dep
                </TableHead>
                <TableHead className="h-8 px-2 text-right text-[10px]">
                  Rms
                </TableHead>
                <TableHead className="h-8 px-2 text-right text-[10px]">
                  Free
                </TableHead>
                <TableHead className="h-8 px-3 text-right text-[10px]">
                  Pax
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {f.weekly.map((day) => {
                const free =
                  f.totalRooms > 0
                    ? Math.max(0, f.totalRooms - day.rooms)
                    : 0;
                const isToday = day.date === f.businessDate;
                return (
                  <TableRow
                    key={day.date}
                    className={cn("h-9", isToday && "bg-muted/50")}
                  >
                    <TableCell className="px-3 py-0 whitespace-nowrap">
                      <span className="font-medium">{weekday(day.date)}</span>
                      <span className="ml-1 text-muted-foreground">
                        {day.date.slice(8)}
                      </span>
                      {isToday ? (
                        <Badge
                          variant="secondary"
                          className="ml-1.5 h-4 px-1 text-[9px]"
                        >
                          Today
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-2 py-0 text-right tabular-nums">
                      {day.arrivals}
                    </TableCell>
                    <TableCell className="px-2 py-0 text-right tabular-nums">
                      {day.departures}
                    </TableCell>
                    <TableCell className="px-2 py-0 text-right tabular-nums font-medium">
                      {day.rooms}
                    </TableCell>
                    <TableCell className="px-2 py-0 text-right tabular-nums text-muted-foreground">
                      {f.totalRooms > 0 ? free : "—"}
                    </TableCell>
                    <TableCell className="px-3 py-0 text-right tabular-nums font-medium">
                      {day.guests}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Month */}
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-1.5">
            <div className="flex flex-wrap items-center gap-1">
              <p className="mr-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                Month
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                asChild
              >
                <Link
                  href={prevHref}
                  aria-label={`Previous month, ${formatForecastMonthLabel(prevYm)}`}
                >
                  <ChevronLeftIcon className="size-3.5" />
                </Link>
              </Button>
              <form
                className="flex items-center gap-1"
                action="/erp"
                method="get"
              >
                {view !== homeView ? (
                  <input type="hidden" name="view" value={view} />
                ) : null}
                <Input
                  id="forecast-month"
                  type="month"
                  name="forecastMonth"
                  defaultValue={monthYm}
                  aria-label="Forecast month"
                  className="h-7 w-[8.75rem] px-2 text-xs"
                />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                >
                  Go
                </Button>
              </form>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                asChild
              >
                <Link
                  href={nextHref}
                  aria-label={`Next month, ${formatForecastMonthLabel(nextYm)}`}
                >
                  <ChevronRightIcon className="size-3.5" />
                </Link>
              </Button>
              {monthYm !== currentYm ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  asChild
                >
                  <Link href={erpDashboardHref({ view, homeView })}>Today</Link>
                </Button>
              ) : null}
            </div>
          </div>
          <div className="space-y-2 px-3 py-2">
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {monthLabel} · Arr {f.monthTotals.arrivals} · Dep{" "}
              {f.monthTotals.departures} · peak {f.monthTotals.peakRooms} rms /{" "}
              {f.monthTotals.peakGuests} pax ·{" "}
              <span className="font-medium text-citrus">
                {f.monthTotals.occupancyPct}%
              </span>{" "}
              · {f.monthTotals.roomNights} RN
            </p>
            <MonthRoomsChart
              days={f.monthly}
              businessDate={f.businessDate}
              totalRooms={f.totalRooms}
            />
          </div>
        </div>
      </CardContent>

      <Separator />

      <div className="space-y-2 px-3 py-2.5 md:px-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            6 months · {monthLabel} – {horizonEndLabel}
          </p>
          <p className="text-[11px] tabular-nums text-muted-foreground">
            Arr {f.horizonTotals.arrivals} · Dep {f.horizonTotals.departures} ·{" "}
            {f.horizonTotals.roomNights} RN · avg {f.horizonTotals.avgRooms} rms
            ·{" "}
            <span className="font-medium text-foreground">
              {f.horizonTotals.occupancyPct}%
            </span>
            {" · "}
            peak {f.horizonTotals.peakRooms}/{f.totalRooms} rms ·{" "}
            {f.horizonTotals.peakGuests} pax
          </p>
        </div>
        <HorizonOccupancyChart
          months={f.horizon}
          selectedYm={monthYm}
          currentYm={currentYm}
          view={view}
          homeView={homeView}
        />
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {f.horizon.map((m) => {
            const selected = m.monthYm === monthYm;
            return (
              <Button
                key={m.monthYm}
                variant={selected ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-[11px] tabular-nums"
                asChild
              >
                <Link
                  href={erpDashboardHref({
                    view,
                    homeView,
                    forecastMonthYm:
                      m.monthYm !== currentYm ? m.monthYm : undefined,
                  })}
                >
                  {formatForecastMonthLabel(m.monthYm).split(" ")[0]}{" "}
                  <span
                    className={cn(
                      "ml-1 font-semibold",
                      m.occupancyPct >= 90 && "text-destructive",
                    )}
                  >
                    {m.occupancyPct}%
                  </span>
                </Link>
              </Button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
