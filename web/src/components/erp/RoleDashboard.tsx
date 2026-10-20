import { BookingLifecycleActions } from "@/components/erp/BookingLifecycleActions";
import { TomorrowArrivals } from "@/components/erp/TomorrowArrivals";
import { MissingGuideScans } from "@/components/erp/MissingGuideScans";
import { DeskBlurFade } from "@/components/erp/DeskBlurFade";
import { DeskMetricTicker } from "@/components/erp/DeskMetricTicker";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { GuestForecastPanel } from "@/components/erp/GuestForecastPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "@/lib/erp/dashboard-views";
import type { RoleDashboardSnapshot } from "@/lib/erp/role-dashboard";
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
    <DeskBlurFade>
    <Link
      href={href}
      className="group block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
    >
      <Card className="gap-0 py-0 shadow-none transition-colors group-hover:border-accent/40 group-hover:bg-muted/30">
        <CardContent className="px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {label}
            </p>
            <Icon className={`size-3.5 shrink-0 ${toneClass}`} />
          </div>
          <p className={`mt-1 text-lg font-semibold tracking-tight tabular-nums ${toneClass}`}>
            <DeskMetricTicker value={value} className={toneClass} />
          </p>
          {hint ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {hint}
              <span className="ml-1 text-accent opacity-0 transition-opacity group-hover:opacity-100">
                →
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
    </DeskBlurFade>
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
    <Card className="gap-0 py-0 shadow-none">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b px-3 py-2">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold tracking-tight">
            {title}
          </CardTitle>
          {description ? (
            <CardDescription className="text-xs">{description}</CardDescription>
          ) : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="px-3 py-2.5">{children}</CardContent>
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
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <FrontDeskLiveRefresh />
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
              { href: "/erp/reports/agent-commerce", label: "Agent commerce" },
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-4">
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

function DeskDayStat({
  href,
  label,
  value,
  tone = "quiet",
  className = "",
}: {
  href: string;
  label: string;
  value: string;
  tone?: "quiet" | "citrus" | "destructive";
  className?: string;
}) {
  const valueClass =
    tone === "citrus"
      ? "text-citrus"
      : tone === "destructive"
        ? "text-destructive"
        : "text-foreground";
  return (
    <Link
      href={href}
      className={`group px-3 py-2.5 outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:px-4 ${className}`}
    >
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className={`mt-0.5 text-xl font-semibold tracking-tight tabular-nums ${valueClass}`}>
        <DeskMetricTicker value={value} className={valueClass} />
      </p>
    </Link>
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
  const meals = snap.mealCovers;
  const covers = [
    { label: "Breakfast", value: meals.breakfast },
    { label: "Lunch", value: meals.lunch },
    { label: "Dinner", value: meals.dinner },
    { label: "Events", value: meals.eventCovers },
  ];
  return (
    <Shell
      title="Front desk"
      subtitle={`Shift home · ${fmtDate(snap.businessDate)}`}
      snap={snap}
      view={view}
      homeView={homeView}
    >
      <section className="overflow-hidden rounded-xl border bg-card" aria-label="Today desk">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              {fmtDate(snap.businessDate)}
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Today
            </h2>
          </div>
          <Button asChild variant="default" className="min-h-11">
            <Link href="/erp/stayview">Open StayView</Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 border-t sm:grid-cols-4">
          <DeskDayStat
            href="/erp/stayview"
            label="Arrivals"
            value={String(snap.arrivalsToday)}
            className="border-r border-b sm:border-b-0"
          />
          <DeskDayStat
            href="/erp/stayview"
            label="In-house"
            value={String(snap.inHouse)}
            tone={snap.inHouse > 0 ? "citrus" : "quiet"}
            className="border-b sm:border-r sm:border-b-0"
          />
          <DeskDayStat
            href="/erp/stayview"
            label="Departures"
            value={String(snap.departuresToday)}
            className="border-r"
          />
          <DeskDayStat
            href="/erp/stayview"
            label="Open folio"
            value={formatBtn(snap.folioBalanceBtn)}
            tone={snap.folioBalanceBtn > 0 ? "destructive" : "quiet"}
          />
        </div>
        <div className="border-t px-4 py-4 sm:px-5" aria-label="Food covers pax today">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Food covers</p>
            <Link
              href="/erp/kitchen"
              className="text-xs font-medium text-accent underline-offset-4 hover:underline"
            >
              Kitchen
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {covers.map((row) => (
              <div key={row.label}>
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
                  {row.value}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">pax</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <TomorrowArrivals rows={snap.tomorrowArrivals} />
      <MissingGuideScans rows={snap.missingGuideScans} />
      <QuickLinks
        links={[
          { href: "/erp/stayview", label: "StayView" },
          { href: "/erp/calendar", label: "Stay View" },
          { href: "/erp/hr/rota", label: "Rota" },
          { href: "/erp/inventory/moves", label: "Store issues" },
          { href: "/erp/agents/call-tasks", label: "Agent call tasks" },
          { href: "/erp/folios", label: "City ledger" },
        ]}
      />
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          href="/erp/pos"
          icon={ShoppingCartIcon}
          label="Open tickets"
          value={String(snap.openKot)}
          hint={`${snap.kotByStatus.new} new · ${snap.kotByStatus.ready} ready`}
        />
        <Kpi
          href="/erp/fnb/day"
          icon={UsersIcon}
          label="Arriving meal pax"
          value={String(snap.arrivingMealPax)}
          hint="Today’s arrivals on BB/MAP/AP"
          tone="citrus"
        />
        <Kpi
          href="/erp/fnb/day"
          icon={SoupIcon}
          label="In-house meal pax"
          value={String(snap.inHouseMealPax)}
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
          title="Day meal board"
          action={
            <Link href="/erp/fnb/day" className="text-xs text-accent hover:underline">
              Guest × meal →
            </Link>
          }
        >
          <EventsToday snap={snap} />
        </Section>
      </div>
      <QuickLinks
        links={[
          { href: "/erp/pos", label: "POS register" },
          { href: "/erp/fnb/day", label: "F&B day board" },
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
          href="/erp/fnb/day"
          icon={CalendarClockIcon}
          label="Arriving meal"
          value={String(snap.arrivingMealPax)}
          hint="Heads arriving today on meal plan"
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
          { href: "/erp/fnb/day", label: "Arrivals / due-out meals" },
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
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
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
          departure(s)
          {snap.departuresWithLaundry > 0
            ? ` · ${snap.departuresWithLaundry} due out with open laundry`
            : ""}{" "}
          — prioritise dirty rooms for same-day turnover.
        </p>
        <div className="mt-3">
          <QuickLinks
            links={[
              { href: "/erp/housekeeping", label: "HK board" },
              { href: "/erp/rooms", label: "Rooms" },
              { href: "/erp/arrivals", label: "Arrivals" },
              { href: "/erp/departures", label: "Departures" },
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
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
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
      <Section title="Due out with open laundry">
        <p className="text-sm text-muted-foreground">
          {snap.departuresWithLaundry > 0
            ? `${snap.departuresWithLaundry} departure(s) still have open laundry — clear before checkout.`
            : "No due-out stays with open laundry."}
        </p>
        <div className="mt-3">
          <QuickLinks
            links={[
              { href: "/erp/laundry", label: "Desk laundry" },
              { href: "/erp/laundry/qr", label: "Scan bag QR" },
              { href: "/staff/laundry", label: "Staff laundry board" },
              { href: "/erp/departures", label: "Departures" },
              { href: "/erp/in-house", label: "In-house rooms" },
            ]}
          />
        </div>
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
