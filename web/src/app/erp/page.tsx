import { RoleReadinessStrip } from "@/components/erp/RoleReadinessStrip";
import { BookingLifecycleActions } from "@/components/erp/BookingLifecycleActions";
import { DeskLiveRefresh } from "@/components/erp/DeskLiveRefresh";
import { OrderBoard } from "@/components/erp/order-board/OrderBoard";
import type {
  OrderBoardBooking,
  OrderTicket,
} from "@/components/erp/order-board/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { thimphuToday } from "@/lib/erp-lists";
import { computeRoleReadiness } from "@/lib/erp/readiness";
import type { KotStatus } from "@/lib/kot";
import { formatBtn } from "@/lib/pricing";
import {
  loadProperty,
  resolveActivePropertyId,
} from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  CalendarClockIcon,
  ClipboardListIcon,
  HotelIcon,
  ReceiptTextIcon,
  ShoppingCartIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const metadata = {
  title: "Desk dashboard | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  return value;
}

export default async function ErpDashboardPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const activeProperty = await loadProperty(admin, propertyId);

  const [
    { data: bookings },
    { data: orders },
    { data: services },
    { data: enquiries },
    { data: agents },
    { data: folios },
  ] = await Promise.all([
    admin
      .from("bookings")
      .select(
        "id, contact_name, contact_phone, check_in, check_out, adults, rooms, status, created_at, hold_expires_at, token_required_btn, token_received_btn",
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("orders")
      .select(
        "id, customer_name, phone, outlet, delivery_type, delivery_area, order_source, total_btn, status, kot_status, booking_id, folio_id, posted_to_folio_at, confirmed_at, confirmed_by, payment_recorded_at, payment_journal_no, created_at, voided_at, order_items(name_snapshot, qty)",
      )
      .eq("property_id", propertyId)
      .in("kot_status", ["new", "preparing", "ready"])
      .is("voided_at", null)
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("service_requests")
      .select(
        "id, kind, contact_name, contact_phone, preferred_on, preferred_time, party_size, status, created_at",
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("enquiries")
      .select("id, topic, contact_name, contact_phone, message, status, created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("agents")
      .select(
        "id, company_name, market, contact_name, contact_phone, status, wants_mou, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("folios")
      .select("id, booking_id, label, status, created_at, folio_lines(total_btn, status)")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const allBookings = bookings ?? [];
  const heldBookings = allBookings.filter((b) => b.status === "held");
  const today = thimphuToday();
  const arrivingToday = allBookings.filter(
    (b) =>
      b.check_in === today &&
      ["pending", "confirmed"].includes(b.status as string),
  );
  const inHouse = allBookings.filter((b) => b.status === "checked_in");
  const openTickets: OrderTicket[] = (orders ?? []).map((row) => ({
    id: row.id as string,
    customerName: (row.customer_name as string | null) ?? "Walk-in",
    phone: (row.phone as string | null) ?? null,
    outlet: (row.outlet as string | null) ?? "kitchen",
    deliveryType: (row.delivery_type as string | null) ?? null,
    deliveryArea: (row.delivery_area as string | null) ?? null,
    orderSource: (row.order_source as string | null) ?? null,
    totalBtn: Number(row.total_btn ?? 0),
    kotStatus: row.kot_status as KotStatus,
    bookingId: (row.booking_id as string | null) ?? null,
    folioId: (row.folio_id as string | null) ?? null,
    postedToFolioAt: (row.posted_to_folio_at as string | null) ?? null,
    confirmedAt: (row.confirmed_at as string | null) ?? null,
    confirmedBy: (row.confirmed_by as string | null) ?? null,
    paymentRecordedAt: (row.payment_recorded_at as string | null) ?? null,
    paymentJournalNo: (row.payment_journal_no as string | null) ?? null,
    createdAt: row.created_at as string,
    items: (
      (row.order_items as { name_snapshot: string; qty: number }[] | null) ?? []
    ).map((item) => ({
      name: item.name_snapshot,
      qty: Number(item.qty),
    })),
  }));
  const openBookings: OrderBoardBooking[] = inHouse.map((booking) => ({
    id: booking.id as string,
    contactName: (booking.contact_name as string | null) ?? "Guest",
    checkIn: booking.check_in as string,
  }));

  const folioBalance = (folios ?? []).reduce((sum, f) => {
    const bal = ((f.folio_lines as { total_btn: number; status: string }[] | null) ?? [])
      .filter((l) => l.status === "posted")
      .reduce((s, l) => s + Number(l.total_btn ?? 0), 0);
    return sum + bal;
  }, 0);

  const setupIncomplete = activeProperty && !activeProperty.setup_completed_at;
  const readinessTiles = await computeRoleReadiness(admin, propertyId);

  return (
    <div className="erp space-y-6 p-4 md:p-6">
      {setupIncomplete ? (
        <Alert variant="destructive">
          <AlertTitle>Setup incomplete</AlertTitle>
          <AlertDescription>
            Finish setup for {activeProperty.name}.{" "}
            <a
              href={`/erp/properties/${propertyId}/setup`}
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              Finish setup →
            </a>
          </AlertDescription>
        </Alert>
      ) : null}

      <RoleReadinessStrip tiles={readinessTiles} />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          href="/erp/arrivals"
          icon={ClipboardListIcon}
          label="Arrivals today"
          value={String(arrivingToday.length)}
          hint="Due in today (pending / confirmed)"
          tone="accent"
        />
        <KpiCard
          href="/erp/in-house"
          icon={HotelIcon}
          label="In-house"
          value={String(inHouse.length)}
          hint="Currently checked in"
          tone="citrus"
        />
        <KpiCard
          href="/erp/reservations"
          icon={CalendarClockIcon}
          label="Holds awaiting token"
          value={String(heldBookings.length)}
          hint="Bank/cash token pending"
          tone="destructive"
        />
        <KpiCard
          href="/erp/payments"
          icon={ReceiptTextIcon}
          label="Open folio balance"
          value={formatBtn(folioBalance)}
          hint="Sum of posted lines"
          tone="accent"
        />
      </div>

      {/* Holds + KOT triage board */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClockIcon className="size-4 text-destructive" />
              Holds awaiting token
            </CardTitle>
            <CardDescription>
              Confirm when bank/cash token arrives · unpaid holds expire by season TTL
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {heldBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open holds.</p>
            ) : (
              heldBookings.map((row) => (
                <div
                  key={row.id as string}
                  className="rounded-lg border bg-card p-3 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-foreground">
                      {(row.contact_name as string) ?? "Guest"} · {row.contact_phone as string}
                    </p>
                    <StatusBadge value="held" />
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {fmtDate(row.check_in as string)} → {fmtDate(row.check_out as string)} ·
                    token {formatBtn(Number(row.token_required_btn ?? 0))}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {row.id as string}
                  </p>
                  <div className="mt-2">
                    <BookingLifecycleActions
                      bookingId={row.id as string}
                      status="held"
                      tokenRequired={Number(row.token_required_btn ?? 0)}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCartIcon className="size-4 text-accent" />
                Order board
              </CardTitle>
              <CardDescription>
                Triage open kitchen tickets · tap a card for full actions · F&amp;B
                day ops live on Kitchen board (covers, meal publish, food cost)
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href="/erp/kitchen"
                className="text-xs font-medium text-accent underline-offset-4 hover:underline"
              >
                Kitchen board →
              </Link>
              <DeskLiveRefresh />
            </div>
          </CardHeader>
          <CardContent>
            <OrderBoard tickets={openTickets} openBookings={openBookings} />
          </CardContent>
        </Card>
      </div>

      {/* Activity stream */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ActivityCard title="Open folios" empty="No folios yet.">
          {(folios ?? []).map((folio) => {
            const balance = ((folio.folio_lines as { total_btn: number; status: string }[] | null) ?? [])
              .filter((line) => line.status === "posted")
              .reduce((sum, line) => sum + Number(line.total_btn ?? 0), 0);
            return (
              <div
                key={folio.id as string}
                className="rounded-lg border bg-card p-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-foreground">{folio.label as string}</p>
                  <StatusBadge value={folio.status as string} />
                </div>
                <p className="mt-1 text-muted-foreground">
                  Balance {formatBtn(balance)} · booking {(folio.booking_id as string) ?? "walk-in"}
                </p>
                <a
                  href={`/erp/folios/${folio.id as string}`}
                  className="mt-2 inline-flex items-center text-xs font-medium text-accent underline-offset-4 hover:underline"
                >
                  Open folio →
                </a>
              </div>
            );
          })}
        </ActivityCard>

        <ActivityCard title="Recent bookings" empty="No bookings yet.">
          {allBookings.slice(0, 6).map((row) => (
            <div
              key={row.id as string}
              className="rounded-lg border bg-card p-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-foreground">
                  {(row.contact_name as string) ?? "Guest"} · {row.contact_phone as string}
                </p>
                <StatusBadge value={row.status as string} />
              </div>
              <p className="mt-1 text-muted-foreground">
                {fmtDate(row.check_in as string)} → {fmtDate(row.check_out as string)} ·{" "}
                {row.adults as number} adults · {row.rooms as number} rooms
              </p>
              {["pending", "confirmed", "checked_in"].includes(row.status as string) ? (
                <a
                  href={`/erp/check-in?id=${row.id as string}`}
                  className="mt-2 inline-flex items-center text-xs font-medium text-accent underline-offset-4 hover:underline"
                >
                  {(row.status as string) === "checked_in" ? "Manage / check out →" : "Check in →"}
                </a>
              ) : null}
            </div>
          ))}
        </ActivityCard>

        <ActivityCard title="Spa / meeting requests" empty="No service requests yet.">
          {(services ?? []).slice(0, 6).map((row) => (
            <div
              key={row.id as string}
              className="rounded-lg border bg-card p-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-foreground">
                  {row.kind as string} · {row.contact_name as string}
                </p>
                <StatusBadge value={row.status as string} />
              </div>
              <p className="mt-1 text-muted-foreground">
                {fmtDate(row.preferred_on as string)}
                {row.preferred_time ? ` · ${row.preferred_time}` : ""} · party {row.party_size as number}
              </p>
            </div>
          ))}
        </ActivityCard>
      </div>
    </div>
  );
}

function KpiCard({
  href,
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone: "accent" | "citrus" | "destructive";
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

function ActivityCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  const list = items.flat().filter(Boolean);
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <UsersIcon className="size-4 text-muted-foreground" />
          {title}
          {list.length > 0 ? (
            <Badge variant="secondary" className="ml-auto">
              {list.length}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          list
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ value }: { value: string }) {
  if (!value) return null;
  const tone =
    value === "checked_in" || value === "approved" || value === "open"
      ? "border-citrus/40 bg-citrus-tint/60 text-citrus"
      : value === "confirmed" || value === "ready"
        ? "border-accent/30 bg-accent/10 text-accent"
        : value === "held" || value === "pending"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap ${tone}`}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}
