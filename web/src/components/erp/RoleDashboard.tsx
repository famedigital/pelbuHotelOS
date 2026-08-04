import { BookingLifecycleActions } from "@/components/erp/BookingLifecycleActions";
import { DeskLiveRefresh } from "@/components/erp/DeskLiveRefresh";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DeskRole } from "@/lib/desk-auth";
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
  ClipboardListIcon,
  HotelIcon,
  ReceiptTextIcon,
  ShirtIcon,
  ShoppingCartIcon,
  SoupIcon,
  SparklesIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

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

function GuestForecastPanel({ snap }: { snap: RoleDashboardSnapshot }) {
  const f = snap.guestForecast;
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
  function weekday(iso: string): string {
    const d = new Date(`${iso}T12:00:00Z`);
    return wd[d.getUTCDay()] ?? "";
  }
  const maxRoom = Math.max(1, ...f.weekly.map((d) => d.rooms), ...f.monthly.map((d) => d.rooms));

  return (
    <section
      className="rounded-xl border bg-card p-4"
      aria-label="Guest forecast weekly and monthly"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Guest forecast
          </p>
          <p className="text-xs text-muted-foreground">
            From held, confirmed, and in-house bookings · {fmtDate(f.businessDate)}
          </p>
        </div>
        <Link
          href="/erp/calendar"
          className="text-xs font-medium text-accent underline-offset-4 hover:underline"
        >
          Room rack →
        </Link>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Next 7 days
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              Arr {f.weekTotals.arrivals} · Dep {f.weekTotals.departures} · peak{" "}
              {f.weekTotals.peakGuests} guests / {f.weekTotals.peakRooms} rms
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[280px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b text-[10px] tracking-wide text-muted-foreground uppercase">
                  <th className="py-1.5 pr-2 font-medium">Day</th>
                  <th className="py-1.5 pr-2 font-medium tabular-nums">Arr</th>
                  <th className="py-1.5 pr-2 font-medium tabular-nums">Dep</th>
                  <th className="py-1.5 pr-2 font-medium tabular-nums">Rooms</th>
                  <th className="py-1.5 font-medium tabular-nums">Guests</th>
                </tr>
              </thead>
              <tbody>
                {f.weekly.map((day) => (
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
                    <td className="py-1.5 pr-2 tabular-nums">{day.departures}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{day.rooms}</td>
                    <td className="py-1.5 tabular-nums font-medium">{day.guests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              This month
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              Arr {f.monthTotals.arrivals} · Dep {f.monthTotals.departures} · avg{" "}
              {f.monthTotals.avgGuests} guests / {f.monthTotals.avgRooms} rms
            </p>
          </div>
          <div
            className="flex h-24 items-end gap-px"
            role="img"
            aria-label="Daily in-house rooms for the calendar month"
          >
            {f.monthly.map((day) => {
              const h = Math.max(4, Math.round((day.rooms / maxRoom) * 100));
              const isToday = day.date === f.businessDate;
              return (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.guests} guests, ${day.rooms} rooms, ${day.arrivals} arr / ${day.departures} dep`}
                  className={`min-w-0 flex-1 rounded-t-sm ${
                    isToday
                      ? "bg-accent"
                      : day.rooms > 0
                        ? "bg-accent/45"
                        : "bg-muted"
                  }`}
                  style={{ height: `${h}%` }}
                />
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground uppercase">Arrivals</p>
              <p className="text-lg font-semibold tabular-nums">
                {f.monthTotals.arrivals}
              </p>
            </div>
            <div className="rounded-lg border px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground uppercase">
                Departures
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {f.monthTotals.departures}
              </p>
            </div>
            <div className="rounded-lg border px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground uppercase">
                Peak guests
              </p>
              <p className="text-lg font-semibold tabular-nums text-citrus">
                {f.monthTotals.peakGuests}
              </p>
            </div>
            <div className="rounded-lg border px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground uppercase">
                Peak rooms
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {f.monthTotals.peakRooms}
              </p>
            </div>
          </div>
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
  children,
}: {
  title: string;
  subtitle: string;
  snap: RoleDashboardSnapshot;
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
      <GuestForecastPanel snap={snap} />
      {children}
    </div>
  );
}

function OwnerBoard({ snap }: { snap: RoleDashboardSnapshot }) {
  return (
    <Shell
      title="Owner"
      subtitle={`${snap.propertyName ?? "Property"} · ${snap.businessDate}`}
      snap={snap}
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

function ManagerBoard({ snap }: { snap: RoleDashboardSnapshot }) {
  return (
    <Shell
      title="Manager"
      subtitle={`Duty board · ${snap.businessDate}`}
      snap={snap}
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
          { href: "/erp/reports", label: "Flash reports" },
        ]}
      />
    </Shell>
  );
}

function FrontDeskBoard({ snap }: { snap: RoleDashboardSnapshot }) {
  return (
    <Shell title="Front desk" subtitle={`Shift home · ${snap.businessDate}`} snap={snap}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

function FnbBoard({ snap }: { snap: RoleDashboardSnapshot }) {
  return (
    <Shell title="F&B" subtitle={`Register & service · ${snap.businessDate}`} snap={snap}>
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

function KitchenBoard({ snap }: { snap: RoleDashboardSnapshot }) {
  return (
    <Shell
      title="Kitchen"
      subtitle={`Cook line · pax & tickets · ${snap.businessDate}`}
      snap={snap}
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

function HkBoard({ snap }: { snap: RoleDashboardSnapshot }) {
  return (
    <Shell title="Housekeeping" subtitle={`Rooms · ${snap.businessDate}`} snap={snap}>
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

function LaundryBoard({ snap }: { snap: RoleDashboardSnapshot }) {
  return (
    <Shell title="Laundry" subtitle={`Pipeline · ${snap.businessDate}`} snap={snap}>
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

function CashierBoard({ snap }: { snap: RoleDashboardSnapshot }) {
  return (
    <Shell title="Cashier" subtitle={`POS settle path · ${snap.businessDate}`} snap={snap}>
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
  const canPreview = sessionRole === "owner" || sessionRole === "gm";
  const homeView = sessionRole
    ? deskRoleToDashboardView(sessionRole)
    : "front_desk";
  const body =
    view === "owner" ? (
      <OwnerBoard snap={snap} />
    ) : view === "gm" ? (
      <ManagerBoard snap={snap} />
    ) : view === "front_desk" ? (
      <FrontDeskBoard snap={snap} />
    ) : view === "fnb" ? (
      <FnbBoard snap={snap} />
    ) : view === "kitchen" ? (
      <KitchenBoard snap={snap} />
    ) : view === "hk" ? (
      <HkBoard snap={snap} />
    ) : view === "laundry" ? (
      <LaundryBoard snap={snap} />
    ) : (
      <CashierBoard snap={snap} />
    );

  return (
    <div className="erp space-y-4 p-4 md:p-6">
      <DashboardViewSwitcher
        active={view}
        canPreview={canPreview}
        homeView={homeView}
      />
      {body}
    </div>
  );
}
