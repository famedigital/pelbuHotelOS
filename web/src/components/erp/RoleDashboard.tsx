import { BookingLifecycleActions } from "@/components/erp/BookingLifecycleActions";
import { DeskLiveRefresh } from "@/components/erp/DeskLiveRefresh";
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
import type { DeskRole } from "@/lib/desk-auth";
import {
  formatForecastMonthLabel,
  shiftMonthYm,
} from "@/lib/erp/guest-forecast";
import {
  DASHBOARD_VIEWS,
  deskRoleToDashboardView,
  type DashboardView,
  type RoleDashboardSnapshot,
} from "@/lib/erp/role-dashboard";
import { fmtDate } from "@/lib/erp-lists";
import { formatBtn } from "@/lib/pricing";
import {
  BedDoubleIcon,
  CalendarClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  HotelIcon,
  ReceiptTextIcon,
  ShirtIcon,
  ShoppingCartIcon,
  SoupIcon,
  SparklesIcon,
  UsersIcon,
  WalletIcon,
  PhoneIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Build `/erp` query while preserving department preview + forecast month. */
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

function Kpi({
  href,
  icon: Icon,
  label,
  value,
  hint,
  tone = "accent",
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: "accent" | "citrus" | "destructive";
}) {
  const toneClass =
    tone === "accent"
      ? "text-accent"
      : tone === "citrus"
        ? "text-citrus"
        : "text-destructive";
  return (
    <Link
      href={href}
      className="group block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
    >
      <Card className="gap-3 py-5 transition-colors group-hover:border-accent/40 group-hover:bg-muted/40">
        <CardContent>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <Icon className={`size-4 shrink-0 ${toneClass}`} />
          </div>
          <p className={`mt-2 text-2xl font-semibold tracking-tight ${toneClass}`}>
            {value}
          </p>
          {hint ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {hint}
              <span className="ml-1 text-accent opacity-0 transition-opacity group-hover:opacity-100">
                →
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}

function GuestForecastPanel({
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
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
  function weekday(iso: string): string {
    const d = new Date(`${iso}T12:00:00Z`);
    return wd[d.getUTCDay()] ?? "";
  }
  const inventory = Math.max(1, f.totalRooms);
  const maxRoom = Math.max(
    inventory,
    ...f.weekly.map((d) => d.rooms),
    ...f.monthly.map((d) => d.rooms),
  );
  const maxHorizonOcc = Math.max(
    1,
    ...f.horizon.map((m) => m.occupancyPct),
    100,
  );

  function StatTile({
    label,
    value,
    hint,
    tone,
  }: {
    label: string;
    value: string | number;
    hint?: string;
    tone?: "default" | "citrus";
  }) {
    return (
      <div className="rounded-lg border px-2.5 py-2">
        <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
        <p
          className={`text-lg font-semibold tabular-nums ${
            tone === "citrus" ? "text-citrus" : ""
          }`}
        >
          {value}
        </p>
        {hint ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    );
  }

  return (
    <section
      className="rounded-xl border bg-card p-4"
      aria-label="Guest forecast weekly, monthly, and six-month"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Guest forecast
          </p>
          <p className="text-xs text-muted-foreground">
            Held, confirmed, and in-house · {fmtDate(f.businessDate)} ·{" "}
            {f.totalRooms} total rooms
          </p>
        </div>
        <Link
          href="/erp/calendar"
          className="text-xs font-medium text-accent underline-offset-4 hover:underline"
        >
          Room rack →
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <StatTile label="Total rooms" value={f.totalRooms} />
        <StatTile
          label="Week occ"
          value={`${f.weekTotals.occupancyPct}%`}
          hint={`avg ${f.weekTotals.avgRooms} rms`}
        />
        <StatTile
          label={`${monthLabel} occ`}
          value={`${f.monthTotals.occupancyPct}%`}
          hint={`${f.monthTotals.roomNights} room-nights`}
          tone="citrus"
        />
        <StatTile
          label="6-mo occ"
          value={`${f.horizonTotals.occupancyPct}%`}
          hint={`${f.horizonTotals.roomNights} room-nights`}
        />
        <StatTile
          label="6-mo peak rooms"
          value={f.horizonTotals.peakRooms}
          hint={`of ${f.totalRooms}`}
        />
        <StatTile
          label="6-mo peak guests"
          value={f.horizonTotals.peakGuests}
          tone="citrus"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Next 7 days
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              Arr {f.weekTotals.arrivals} · Dep {f.weekTotals.departures} · peak{" "}
              {f.weekTotals.peakGuests} guests / {f.weekTotals.peakRooms} rms ·{" "}
              {f.weekTotals.occupancyPct}% occ
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b text-[10px] tracking-wide text-muted-foreground uppercase">
                  <th className="py-1.5 pr-2 font-medium">Day</th>
                  <th className="py-1.5 pr-2 font-medium tabular-nums">Arr</th>
                  <th className="py-1.5 pr-2 font-medium tabular-nums">Dep</th>
                  <th className="py-1.5 pr-2 font-medium tabular-nums">Rooms</th>
                  <th className="py-1.5 pr-2 font-medium tabular-nums">
                    Free
                  </th>
                  <th className="py-1.5 font-medium tabular-nums">Guests</th>
                </tr>
              </thead>
              <tbody>
                {f.weekly.map((day) => {
                  const free =
                    f.totalRooms > 0
                      ? Math.max(0, f.totalRooms - day.rooms)
                      : 0;
                  return (
                    <tr
                      key={day.date}
                      className={`border-b border-border/50 ${
                        day.date === f.businessDate ? "bg-muted/40" : ""
                      }`}
                    >
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        <span className="font-medium">{weekday(day.date)}</span>
                        <span className="ml-1 text-muted-foreground">
                          {day.date.slice(8)}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 tabular-nums">{day.arrivals}</td>
                      <td className="py-1.5 pr-2 tabular-nums">
                        {day.departures}
                      </td>
                      <td className="py-1.5 pr-2 tabular-nums">{day.rooms}</td>
                      <td className="py-1.5 pr-2 tabular-nums text-muted-foreground">
                        {f.totalRooms > 0 ? free : "—"}
                      </td>
                      <td className="py-1.5 tabular-nums font-medium">
                        {day.guests}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                Month
              </p>
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-lg"
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
                  className="flex flex-wrap items-center gap-1"
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
                    className="h-8 w-[9.5rem] px-2 text-xs"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                  >
                    Go
                  </Button>
                </form>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-lg"
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
                    className="h-8 px-2 text-xs"
                    asChild
                  >
                    <Link
                      href={erpDashboardHref({ view, homeView })}
                      aria-label="Back to current month"
                    >
                      Today
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="text-xs tabular-nums text-muted-foreground">
              {monthLabel} · Arr {f.monthTotals.arrivals} · Dep{" "}
              {f.monthTotals.departures} · avg {f.monthTotals.avgGuests} guests
              / {f.monthTotals.avgRooms} rms · {f.monthTotals.occupancyPct}%
            </p>
          </div>
          <div
            className="flex h-24 items-end gap-px"
            role="img"
            aria-label={`Daily in-house rooms for ${monthLabel}`}
          >
            {f.monthly.map((day) => {
              const h = Math.max(4, Math.round((day.rooms / maxRoom) * 100));
              const isToday = day.date === f.businessDate;
              const over =
                f.totalRooms > 0 && day.rooms > f.totalRooms;
              return (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.guests} guests, ${day.rooms}/${f.totalRooms || "?"} rooms, ${day.arrivals} arr / ${day.departures} dep`}
                  className={`min-w-0 flex-1 rounded-t-sm ${
                    isToday
                      ? "bg-accent"
                      : over
                        ? "bg-destructive/70"
                        : day.rooms > 0
                          ? "bg-accent/45"
                          : "bg-muted"
                  }`}
                  style={{ height: `${h}%` }}
                />
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Arrivals" value={f.monthTotals.arrivals} />
            <StatTile label="Departures" value={f.monthTotals.departures} />
            <StatTile
              label="Peak guests"
              value={f.monthTotals.peakGuests}
              tone="citrus"
            />
            <StatTile
              label="Peak rooms"
              value={f.monthTotals.peakRooms}
              hint={
                f.totalRooms > 0
                  ? `${Math.max(0, f.totalRooms - f.monthTotals.peakRooms)} free at peak`
                  : undefined
              }
            />
            <StatTile
              label="Room-nights"
              value={f.monthTotals.roomNights}
              hint={
                f.monthTotals.availableRoomNights > 0
                  ? `of ${f.monthTotals.availableRoomNights}`
                  : undefined
              }
            />
            <StatTile
              label="Occupancy"
              value={`${f.monthTotals.occupancyPct}%`}
              tone="citrus"
            />
          </div>
        </div>
      </div>

      <div className="mt-5 border-t pt-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            6 months · {monthLabel} – {horizonEndLabel}
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">
            Arr {f.horizonTotals.arrivals} · Dep {f.horizonTotals.departures} ·{" "}
            {f.horizonTotals.roomNights} room-nights · avg{" "}
            {f.horizonTotals.avgRooms} rms · {f.horizonTotals.occupancyPct}% occ
            {f.totalRooms > 0 ? ` · ${f.totalRooms} rooms` : ""}
          </p>
        </div>

        <div
          className="mb-3 flex h-16 items-end gap-1.5"
          role="img"
          aria-label={`Monthly occupancy ${monthLabel} through ${horizonEndLabel}`}
        >
          {f.horizon.map((m) => {
            const h = Math.max(
              6,
              Math.round((m.occupancyPct / maxHorizonOcc) * 100),
            );
            const isSelected = m.monthYm === monthYm;
            return (
              <Link
                key={m.monthYm}
                href={erpDashboardHref({
                  view,
                  homeView,
                  forecastMonthYm:
                    m.monthYm !== currentYm ? m.monthYm : undefined,
                })}
                title={`${formatForecastMonthLabel(m.monthYm)}: ${m.occupancyPct}% occ, peak ${m.peakRooms} rooms / ${m.peakGuests} guests`}
                className="group flex min-w-0 flex-1 flex-col items-center gap-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
              >
                <div
                  className={`w-full max-w-[3rem] rounded-t-sm transition-colors ${
                    isSelected
                      ? "bg-accent"
                      : m.occupancyPct >= 90
                        ? "bg-destructive/60 group-hover:bg-destructive/80"
                        : m.occupancyPct > 0
                          ? "bg-accent/40 group-hover:bg-accent/60"
                          : "bg-muted group-hover:bg-muted-foreground/20"
                  }`}
                  style={{ height: `${h}%` }}
                />
                <span
                  className={`text-[10px] tabular-nums ${
                    isSelected
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {formatForecastMonthLabel(m.monthYm).split(" ")[0]}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b text-[10px] tracking-wide text-muted-foreground uppercase">
                <th className="py-1.5 pr-2 font-medium">Month</th>
                <th className="py-1.5 pr-2 font-medium tabular-nums">Arr</th>
                <th className="py-1.5 pr-2 font-medium tabular-nums">Dep</th>
                <th className="py-1.5 pr-2 font-medium tabular-nums">
                  Peak rms
                </th>
                <th className="py-1.5 pr-2 font-medium tabular-nums">
                  Free@peak
                </th>
                <th className="py-1.5 pr-2 font-medium tabular-nums">
                  Peak guests
                </th>
                <th className="py-1.5 pr-2 font-medium tabular-nums">Avg rms</th>
                <th className="py-1.5 pr-2 font-medium tabular-nums">
                  Room-nts
                </th>
                <th className="py-1.5 font-medium tabular-nums">Occ %</th>
              </tr>
            </thead>
            <tbody>
              {f.horizon.map((m) => {
                const freeAtPeak =
                  f.totalRooms > 0
                    ? Math.max(0, f.totalRooms - m.peakRooms)
                    : null;
                const isSelected = m.monthYm === monthYm;
                return (
                  <tr
                    key={m.monthYm}
                    className={`border-b border-border/50 ${
                      isSelected ? "bg-muted/40" : ""
                    }`}
                  >
                    <td className="py-1.5 pr-2 whitespace-nowrap">
                      <Link
                        href={erpDashboardHref({
                          view,
                          homeView,
                          forecastMonthYm:
                            m.monthYm !== currentYm ? m.monthYm : undefined,
                        })}
                        className="font-medium text-accent underline-offset-2 hover:underline"
                      >
                        {formatForecastMonthLabel(m.monthYm)}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums">{m.arrivals}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{m.departures}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{m.peakRooms}</td>
                    <td className="py-1.5 pr-2 tabular-nums text-muted-foreground">
                      {freeAtPeak ?? "—"}
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums font-medium">
                      {m.peakGuests}
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums">{m.avgRooms}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{m.roomNights}</td>
                    <td
                      className={`py-1.5 tabular-nums font-medium ${
                        m.occupancyPct >= 90 ? "text-destructive" : ""
                      }`}
                    >
                      {m.occupancyPct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t text-xs font-medium">
                <td className="py-2 pr-2">6-month total</td>
                <td className="py-2 pr-2 tabular-nums">
                  {f.horizonTotals.arrivals}
                </td>
                <td className="py-2 pr-2 tabular-nums">
                  {f.horizonTotals.departures}
                </td>
                <td className="py-2 pr-2 tabular-nums">
                  {f.horizonTotals.peakRooms}
                </td>
                <td className="py-2 pr-2 tabular-nums text-muted-foreground">
                  {f.totalRooms > 0
                    ? Math.max(0, f.totalRooms - f.horizonTotals.peakRooms)
                    : "—"}
                </td>
                <td className="py-2 pr-2 tabular-nums">
                  {f.horizonTotals.peakGuests}
                </td>
                <td className="py-2 pr-2 tabular-nums">
                  {f.horizonTotals.avgRooms}
                </td>
                <td className="py-2 pr-2 tabular-nums">
                  {f.horizonTotals.roomNights}
                </td>
                <td className="py-2 tabular-nums text-citrus">
                  {f.horizonTotals.occupancyPct}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function QuickLinks({ links }: { links: Array<{ href: string; label: string }> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium hover:bg-muted"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

function MealPaxStrip({
  snap,
  emphasize = false,
}: {
  snap: RoleDashboardSnapshot;
  emphasize?: boolean;
}) {
  const { breakfast, lunch, dinner, eventCovers } = snap.mealCovers;
  return (
    <div
      className={`rounded-xl border p-4 ${
        emphasize ? "border-citrus/40 bg-citrus-tint/25" : "bg-card"
      }`}
      aria-label="Food covers pax today"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          Food covers · pax today
        </p>
        <p className="text-xs text-muted-foreground">{snap.businessDate}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Breakfast
          </p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {breakfast}
          </p>
          <p className="text-xs text-muted-foreground">pax</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Lunch
          </p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {lunch}
          </p>
          <p className="text-xs text-muted-foreground">pax</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Dinner
          </p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {dinner}
          </p>
          <p className="text-xs text-muted-foreground">pax</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Events
          </p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {eventCovers}
          </p>
          <p className="text-xs text-muted-foreground">
            extra pax · {snap.todayEvents.length} event
            {snap.todayEvents.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        From meal plans + banquet events (cancelled excluded).{" "}
        <Link
          href="/erp/kitchen"
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          Kitchen board →
        </Link>
      </p>
    </div>
  );
}

function EventsToday({ snap }: { snap: RoleDashboardSnapshot }) {
  if (snap.todayEvents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No banquets / group menus for today.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {snap.todayEvents.map((ev) => (
        <li key={ev.id} className="rounded-lg border p-2.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{ev.title}</span>
            <Badge variant="outline" className="tabular-nums">
              {ev.covers} pax
            </Badge>
            {ev.serviceTime ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {ev.serviceTime.slice(0, 5)}
              </span>
            ) : null}
            {ev.venue ? (
              <span className="text-xs text-muted-foreground">{ev.venue}</span>
            ) : null}
          </div>
          {ev.menuNote ? (
            <p className="mt-1 text-xs whitespace-pre-wrap text-foreground">
              {ev.menuNote}
            </p>
          ) : (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              Menu not set
            </p>
          )}
          {ev.packageTotalBtn != null && ev.packageTotalBtn > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Bill {formatBtn(ev.packageTotalBtn)} · {ev.billingStatus}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function OpenKotList({ snap }: { snap: RoleDashboardSnapshot }) {
  if (snap.openTickets.length === 0) {
    return <p className="text-sm text-muted-foreground">No open kitchen tickets.</p>;
  }
  return (
    <ul className="space-y-2">
      {snap.openTickets.slice(0, 10).map((t) => (
        <li
          key={t.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-sm"
        >
          <div>
            <p className="font-medium">{t.customerName}</p>
            <p className="text-xs text-muted-foreground">
              {t.outlet ?? "outlet"} · {t.itemCount} item
              {t.itemCount === 1 ? "" : "s"} · {t.kotStatus}
            </p>
          </div>
          <div className="text-right">
            <p className="tabular-nums font-medium">{formatBtn(t.totalBtn)}</p>
            <Link
              href={`/erp/orders/${t.id}/slip`}
              className="text-xs text-accent underline-offset-4 hover:underline"
            >
              Slip →
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

function HoldsList({ snap }: { snap: RoleDashboardSnapshot }) {
  if (snap.holds.length === 0) {
    return <p className="text-sm text-muted-foreground">No open holds.</p>;
  }
  return (
    <ul className="space-y-2">
      {snap.holds.map((h) => (
        <li key={h.id} className="rounded-lg border p-2.5 text-sm">
          <p className="font-medium">
            {h.contactName}
            {h.contactPhone ? ` · ${h.contactPhone}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {h.checkIn} → {h.checkOut} · token {formatBtn(h.tokenRequiredBtn)}
          </p>
          <div className="mt-2">
            <BookingLifecycleActions
              bookingId={h.id}
              status="held"
              tokenRequired={h.tokenRequiredBtn}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DashboardViewSwitcher({
  active,
  canPreview,
  homeView,
}: {
  active: DashboardView;
  canPreview: boolean;
  homeView: DashboardView;
}) {
  if (!canPreview) return null;
  return (
    <nav
      className="flex flex-wrap gap-1.5 rounded-xl border bg-card p-2"
      aria-label="Preview department dashboards"
    >
      {DASHBOARD_VIEWS.map((v) => {
        const selected = v.id === active;
        const href =
          v.id === homeView ? "/erp" : `/erp?view=${encodeURIComponent(v.id)}`;
        return (
          <Link
            key={v.id}
            href={href}
            className={`inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium transition-colors ${
              selected
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title={v.blurb}
          >
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Shell({
  title,
  subtitle,
  snap,
  view,
  homeView,
  children,
}: {
  title: string;
  subtitle: string;
  snap: RoleDashboardSnapshot;
  view: DashboardView;
  homeView: DashboardView;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Desk dashboard
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <DeskLiveRefresh />
      </header>
      <GuestForecastPanel snap={snap} view={view} homeView={homeView} />
      {children}
    </div>
  );
}

function OwnerBoard({
  snap,
  view,
  homeView,
}: {
  snap: RoleDashboardSnapshot;
  view: DashboardView;
  homeView: DashboardView;
}) {
  return (
    <Shell
      title="Owner"
      subtitle={`${snap.propertyName ?? "Property"} · ${snap.businessDate}`}
      snap={snap}
      view={view}
      homeView={homeView}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          href="/erp/reports"
          icon={WalletIcon}
          label="Open folio balance"
          value={formatBtn(snap.folioBalanceBtn)}
          hint="City ledger / guest accounts"
        />
        <Kpi
          href="/erp/in-house"
          icon={HotelIcon}
          label="In-house"
          value={String(snap.inHouse)}
          hint="Occupied stays"
          tone="citrus"
        />
        <Kpi
          href="/erp/kitchen"
          icon={SoupIcon}
          label="Food pax today"
          value={String(
            snap.mealCovers.breakfast +
              snap.mealCovers.lunch +
              snap.mealCovers.dinner,
          )}
          hint={`BF ${snap.mealCovers.breakfast} · L ${snap.mealCovers.lunch} · D ${snap.mealCovers.dinner}`}
        />
        <Kpi
          href="/erp/night-audit"
          icon={ClipboardListIcon}
          label="Night audit"
          value={snap.nightAuditCurrent ? "Current" : "Due"}
          hint={snap.nightAuditCurrent ? "Rolled for today" : "Run night audit"}
          tone={snap.nightAuditCurrent ? "citrus" : "destructive"}
        />
      </div>
      <Section title="Compliance" description="Setup and statutory posture">
        <ul className="space-y-1 text-sm">
          <li>{snap.setupComplete ? "✓" : "○"} Property setup complete</li>
          <li>{snap.tpnOnFile ? "✓" : "○"} TPN on file</li>
          <li>{snap.bankOnFile ? "✓" : "○"} Bank account on file</li>
          <li>{snap.gstFiledThisMonth ? "✓" : "○"} GST pack filed this month</li>
          <li>
            {snap.pendingBankProofs === 0 ? "✓" : "○"}{" "}
            {snap.pendingBankProofs} pending bank proof(s)
          </li>
        </ul>
        <div className="mt-3">
          <QuickLinks
            links={[
              { href: "/erp/reports/performance", label: "Performance" },
              { href: "/erp/finance", label: "Finance" },
              { href: "/erp/agents/call-tasks", label: "Agent call tasks" },
              { href: "/erp/settings", label: "Settings" },
              { href: "/erp/night-audit", label: "Night audit" },
            ]}
          />
        </div>
      </Section>
      <MealPaxStrip snap={snap} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Kpi
          href="/erp/arrivals"
          icon={ClipboardListIcon}
          label="Arrivals"
          value={String(snap.arrivalsToday)}
        />
        <Kpi
          href="/erp/pos"
          icon={ShoppingCartIcon}
          label="Open KOT"
          value={String(snap.openKot)}
        />
        <Kpi
          href="/erp/housekeeping"
          icon={SparklesIcon}
          label="Dirty rooms"
          value={String(snap.rooms.dirty)}
          tone={snap.rooms.dirty > 3 ? "destructive" : "accent"}
        />
      </div>
    </Shell>
  );
}

function ManagerBoard({
  snap,
  view,
  homeView,
}: {
  snap: RoleDashboardSnapshot;
  view: DashboardView;
  homeView: DashboardView;
}) {
  return (
    <Shell
      title="Manager"
      subtitle={`Duty board · ${snap.businessDate}`}
      snap={snap}
      view={view}
      homeView={homeView}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          href="/erp/arrivals"
          icon={ClipboardListIcon}
          label="Arrivals"
          value={String(snap.arrivalsToday)}
        />
        <Kpi
          href="/erp/departures"
          icon={CalendarClockIcon}
          label="Departures"
          value={String(snap.departuresToday)}
        />
        <Kpi
          href="/erp/reservations"
          icon={CalendarClockIcon}
          label="Holds"
          value={String(snap.holdsCount)}
          tone={snap.holdsCount > 0 ? "destructive" : "citrus"}
        />
        <Kpi
          href="/erp/payments"
          icon={ReceiptTextIcon}
          label="Open folio $"
          value={formatBtn(snap.folioBalanceBtn)}
        />
      </div>
      <MealPaxStrip snap={snap} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Kpi
          href="/erp/pos"
          icon={ShoppingCartIcon}
          label="Open KOT"
          value={String(snap.openKot)}
          hint={`${snap.kotByStatus.new} new · ${snap.kotByStatus.preparing} prep · ${snap.kotByStatus.ready} ready`}
        />
        <Kpi
          href="/erp/housekeeping"
          icon={SparklesIcon}
          label="HK dirty / inspect"
          value={`${snap.rooms.dirty} / ${snap.rooms.inspect}`}
        />
        <Kpi
          href="/erp/laundry"
          icon={ShirtIcon}
          label="Laundry open"
          value={String(snap.laundry.open)}
          hint={`${snap.laundry.ready} ready`}
          tone="citrus"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Holds awaiting token">
          <HoldsList snap={snap} />
        </Section>
        <Section
          title="Kitchen tickets"
          action={
            <Link href="/erp/kitchen" className="text-xs text-accent hover:underline">
              Kitchen →
            </Link>
          }
        >
          <OpenKotList snap={snap} />
        </Section>
      </div>
          <QuickLinks
            links={[
              { href: "/erp/calendar", label: "Calendar" },
              { href: "/erp/night-audit", label: "Night audit" },
              { href: "/erp/finance", label: "Finance" },
              { href: "/erp/hr/rota", label: "Rota" },
              { href: "/erp/agents/call-tasks", label: "Agent call tasks" },
              { href: "/erp/reports", label: "Flash reports" },
            ]}
          />
    </Shell>
  );
}

function FrontDeskBoard({
  snap,
  view,
  homeView,
}: {
  snap: RoleDashboardSnapshot;
  view: DashboardView;
  homeView: DashboardView;
}) {
  return (
    <Shell
      title="Front desk"
      subtitle={`Shift home · ${snap.businessDate}`}
      snap={snap}
      view={view}
      homeView={homeView}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi
          href="/erp/arrivals"
          icon={ClipboardListIcon}
          label="Arrivals today"
          value={String(snap.arrivalsToday)}
        />
        <Kpi
          href="/erp/in-house"
          icon={HotelIcon}
          label="In-house"
          value={String(snap.inHouse)}
          tone="citrus"
        />
        <Kpi
          href="/erp/departures"
          icon={CalendarClockIcon}
          label="Departures"
          value={String(snap.departuresToday)}
        />
        <Kpi
          href="/erp/reservations"
          icon={CalendarClockIcon}
          label="Holds"
          value={String(snap.holdsCount)}
          tone={snap.holdsCount > 0 ? "destructive" : "accent"}
        />
        <Kpi
          href="/erp/agents/call-tasks"
          icon={PhoneIcon}
          label="Agent calls due"
          value={String(snap.agentCallPending)}
          hint={
            snap.agentCallTasksDue > 0
              ? `${snap.agentCallTasksDue} list${snap.agentCallTasksDue === 1 ? "" : "s"} due`
              : "No open call tasks due"
          }
          tone={snap.agentCallPending > 0 ? "destructive" : "accent"}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Holds awaiting token">
          <HoldsList snap={snap} />
        </Section>
        <Section title="Open folio balance">
          <p className="text-3xl font-semibold tabular-nums text-accent">
            {formatBtn(snap.folioBalanceBtn)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sum of posted lines on open folios
          </p>
          <div className="mt-3">
            <QuickLinks
              links={[
                { href: "/erp/folios", label: "City ledger" },
                { href: "/erp/payments", label: "Payments" },
                { href: "/erp/calendar", label: "Room rack" },
                { href: "/erp/agents/call-tasks", label: "Agent call tasks" },
                { href: "/erp/reservations?new=1", label: "New reservation" },
              ]}
            />
          </div>
        </Section>
      </div>
      <MealPaxStrip snap={snap} />
    </Shell>
  );
}

function FnbBoard({
  snap,
  view,
  homeView,
}: {
  snap: RoleDashboardSnapshot;
  view: DashboardView;
  homeView: DashboardView;
}) {
  return (
    <Shell
      title="F&B"
      subtitle={`Register & service · ${snap.businessDate}`}
      snap={snap}
      view={view}
      homeView={homeView}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          href="/erp/pos"
          icon={ShoppingCartIcon}
          label="Open tickets"
          value={String(snap.openKot)}
          hint={`${snap.kotByStatus.new} new · ${snap.kotByStatus.ready} ready`}
        />
        <Kpi
          href="/erp/kitchen"
          icon={UsersIcon}
          label="Lunch pax"
          value={String(snap.mealCovers.lunch)}
          hint="Meal plan + events"
          tone="citrus"
        />
        <Kpi
          href="/erp/kitchen"
          icon={SoupIcon}
          label="Dinner pax"
          value={String(snap.mealCovers.dinner)}
        />
        <Kpi
          href="/erp/kitchen"
          icon={CalendarClockIcon}
          label="Event pax today"
          value={String(snap.eventPaxToday)}
          hint={`${snap.todayEvents.length} banquet/group`}
        />
      </div>
      <MealPaxStrip snap={snap} emphasize />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Open KOT"
          action={
            <Link href="/erp/pos" className="text-xs text-accent hover:underline">
              POS →
            </Link>
          }
        >
          <OpenKotList snap={snap} />
        </Section>
        <Section
          title="Events & menus today"
          action={
            <Link href="/erp/kitchen" className="text-xs text-accent hover:underline">
              Events →
            </Link>
          }
        >
          <EventsToday snap={snap} />
        </Section>
      </div>
      <QuickLinks
        links={[
          { href: "/erp/pos", label: "POS register" },
          { href: "/erp/kds", label: "Kitchen TV" },
          { href: "/erp/kds/pass", label: "Pass / Expo TV" },
          { href: "/erp/menu", label: "Menu" },
          { href: "/erp/kitchen/food-cost", label: "Food cost" },
        ]}
      />
    </Shell>
  );
}

function KitchenBoard({
  snap,
  view,
  homeView,
}: {
  snap: RoleDashboardSnapshot;
  view: DashboardView;
  homeView: DashboardView;
}) {
  return (
    <Shell
      title="Kitchen"
      subtitle={`Cook line · pax & tickets · ${snap.businessDate}`}
      snap={snap}
      view={view}
      homeView={homeView}
    >
      <MealPaxStrip snap={snap} emphasize />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          href="/erp/kds"
          icon={ShoppingCartIcon}
          label="KOT queue"
          value={String(snap.openKot)}
          hint={`${snap.kotByStatus.new} new · ${snap.kotByStatus.preparing} prep · ${snap.kotByStatus.ready} ready`}
        />
        <Kpi
          href="/erp/kitchen"
          icon={UsersIcon}
          label="BF pax"
          value={String(snap.mealCovers.breakfast)}
          tone="citrus"
        />
        <Kpi
          href="/erp/inventory"
          icon={SoupIcon}
          label="LPG full"
          value={String(snap.gasFull)}
          tone={snap.gasFull < 1 ? "destructive" : "accent"}
          hint={snap.gasFull < 1 ? "Refill spare" : "OK"}
        />
        <Kpi
          href="/erp/inventory"
          icon={ClipboardListIcon}
          label="Low stock SKUs"
          value={String(snap.lowStockSkus)}
          tone={snap.lowStockSkus > 0 ? "destructive" : "citrus"}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Tickets to cook">
          <OpenKotList snap={snap} />
        </Section>
        <Section title="Banquets / set menus (pax)">
          <EventsToday snap={snap} />
        </Section>
      </div>
      <QuickLinks
        links={[
          { href: "/erp/kitchen", label: "Full kitchen board" },
          { href: "/erp/kds", label: "Kitchen TV" },
          { href: "/erp/kds/pass", label: "Pass / Expo TV" },
          { href: "/erp/pos", label: "POS" },
          { href: "/erp/inventory", label: "Stock" },
        ]}
      />
    </Shell>
  );
}

function HkBoard({
  snap,
  view,
  homeView,
}: {
  snap: RoleDashboardSnapshot;
  view: DashboardView;
  homeView: DashboardView;
}) {
  return (
    <Shell
      title="Housekeeping"
      subtitle={`Rooms · ${snap.businessDate}`}
      snap={snap}
      view={view}
      homeView={homeView}
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi
          href="/erp/housekeeping"
          icon={SparklesIcon}
          label="Dirty"
          value={String(snap.rooms.dirty)}
          tone={snap.rooms.dirty > 0 ? "destructive" : "citrus"}
        />
        <Kpi
          href="/erp/housekeeping"
          icon={SparklesIcon}
          label="Inspect"
          value={String(snap.rooms.inspect)}
          tone={snap.rooms.inspect > 0 ? "destructive" : "accent"}
        />
        <Kpi
          href="/erp/housekeeping"
          icon={BedDoubleIcon}
          label="Clean"
          value={String(snap.rooms.clean)}
          tone="citrus"
        />
        <Kpi
          href="/erp/rooms"
          icon={HotelIcon}
          label="Occupied"
          value={String(snap.rooms.occupied)}
        />
        <Kpi
          href="/erp/rooms"
          icon={HotelIcon}
          label="OOO"
          value={String(snap.rooms.ooo)}
        />
      </div>
      <Section title="FO pressure">
        <p className="text-sm text-muted-foreground">
          {snap.arrivalsToday} arrival(s) today · {snap.departuresToday}{" "}
          departure(s) — prioritise dirty rooms for same-day turnover.
        </p>
        <div className="mt-3">
          <QuickLinks
            links={[
              { href: "/erp/housekeeping", label: "HK board" },
              { href: "/erp/rooms", label: "Rooms" },
              { href: "/erp/arrivals", label: "Arrivals" },
              { href: "/erp/lost-found", label: "Lost & found" },
              { href: "/erp/maintenance", label: "Maintenance" },
            ]}
          />
        </div>
      </Section>
    </Shell>
  );
}

function LaundryBoard({
  snap,
  view,
  homeView,
}: {
  snap: RoleDashboardSnapshot;
  view: DashboardView;
  homeView: DashboardView;
}) {
  return (
    <Shell
      title="Laundry"
      subtitle={`Pipeline · ${snap.businessDate}`}
      snap={snap}
      view={view}
      homeView={homeView}
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi
          href="/erp/laundry"
          icon={ShirtIcon}
          label="Open"
          value={String(snap.laundry.open)}
        />
        <Kpi
          href="/erp/laundry"
          icon={ShirtIcon}
          label="Requested"
          value={String(snap.laundry.requested)}
        />
        <Kpi
          href="/erp/laundry"
          icon={ShirtIcon}
          label="Received"
          value={String(snap.laundry.received)}
        />
        <Kpi
          href="/erp/laundry"
          icon={ShirtIcon}
          label="In process"
          value={String(snap.laundry.washing)}
        />
        <Kpi
          href="/erp/laundry"
          icon={ShirtIcon}
          label="Ready"
          value={String(snap.laundry.ready)}
          tone="citrus"
          hint="Deliver to room / FO"
        />
      </div>
      <Section title="Shift actions">
        <QuickLinks
          links={[
            { href: "/erp/laundry", label: "Desk laundry" },
            { href: "/erp/laundry/qr", label: "Scan bag QR" },
            { href: "/staff/laundry", label: "Staff laundry board" },
            { href: "/erp/in-house", label: "In-house rooms" },
          ]}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Intake photos + bag labels on desk · staff scan on `/staff/laundry`.
        </p>
      </Section>
    </Shell>
  );
}

function CashierBoard({
  snap,
  view,
  homeView,
}: {
  snap: RoleDashboardSnapshot;
  view: DashboardView;
  homeView: DashboardView;
}) {
  return (
    <Shell
      title="Cashier"
      subtitle={`POS settle path · ${snap.businessDate}`}
      snap={snap}
      view={view}
      homeView={homeView}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          href="/erp/pos"
          icon={ShoppingCartIcon}
          label="Open tickets"
          value={String(snap.openKot)}
        />
        <Kpi
          href="/erp/payments"
          icon={ReceiptTextIcon}
          label="Open folio balance"
          value={formatBtn(snap.folioBalanceBtn)}
        />
        <Kpi
          href="/erp/kitchen"
          icon={UsersIcon}
          label="BF / lunch / dinner pax"
          value={`${snap.mealCovers.breakfast}/${snap.mealCovers.lunch}/${snap.mealCovers.dinner}`}
          hint="Food covers today"
          tone="citrus"
        />
        <Kpi
          href="/erp/finance/bank-proofs"
          icon={WalletIcon}
          label="Pending bank"
          value={String(snap.pendingBankProofs)}
          tone={snap.pendingBankProofs > 0 ? "destructive" : "accent"}
        />
      </div>
      <Section title="Open tickets">
        <OpenKotList snap={snap} />
      </Section>
      <QuickLinks
        links={[
          { href: "/erp/pos", label: "POS" },
          { href: "/erp/payments", label: "Payments" },
          { href: "/erp/kds", label: "KDS" },
          { href: "/erp/kds/pass", label: "Pass TV" },
          { href: "/erp/folios", label: "Folios" },
        ]}
      />
    </Shell>
  );
}

export function RoleDashboard({
  view,
  snap,
  sessionRole,
}: {
  view: DashboardView;
  snap: RoleDashboardSnapshot;
  sessionRole: DeskRole | null;
}) {
  const homeView = sessionRole
    ? deskRoleToDashboardView(sessionRole)
    : "front_desk";
  const boardProps = { snap, view, homeView } as const;
  const body =
    view === "owner" ? (
      <OwnerBoard {...boardProps} />
    ) : view === "gm" ? (
      <ManagerBoard {...boardProps} />
    ) : view === "front_desk" ? (
      <FrontDeskBoard {...boardProps} />
    ) : view === "fnb" ? (
      <FnbBoard {...boardProps} />
    ) : view === "kitchen" ? (
      <KitchenBoard {...boardProps} />
    ) : view === "hk" ? (
      <HkBoard {...boardProps} />
    ) : view === "laundry" ? (
      <LaundryBoard {...boardProps} />
    ) : (
      <CashierBoard {...boardProps} />
    );

  return (
    <div className="erp space-y-4 p-4 md:p-6">
      {/* Department boards are ModuleHeaderTabs in DeskShell (first header row). */}
      {body}
    </div>
  );
}
