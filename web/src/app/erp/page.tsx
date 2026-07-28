import {
  postOrderToBookingFolio,
  updateOrderKotStatus,
} from "@/app/actions/erp-pos";
import { BookingLifecycleActions } from "@/components/erp/BookingLifecycleActions";
import { DeskHeader } from "@/components/erp/DeskHeader";
import { DeskLiveRefresh } from "@/components/erp/DeskLiveRefresh";
import { deskPinConfigured, isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import {
  listProperties,
  loadProperty,
  resolveActivePropertyId,
} from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const metadata = {
  title: "Desk inbox | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const KOT_FLOW = ["new", "preparing", "ready", "served"] as const;
const KOT_LABEL: Record<string, string> = {
  new: "New",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
};

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  return value;
}

export default async function ErpInboxPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const [activeProperty, properties] = await Promise.all([
    loadProperty(admin, propertyId),
    listProperties(admin),
  ]);

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
        "id, customer_name, phone, outlet, delivery_type, total_btn, status, kot_status, booking_id, folio_id, posted_to_folio_at, created_at, order_items(name_snapshot, qty)",
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(25),
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

  const openBookings = (bookings ?? []).filter((row) =>
    ["pending", "held", "confirmed", "checked_in"].includes(row.status as string),
  );
  const heldBookings = (bookings ?? []).filter(
    (row) => (row.status as string) === "held",
  );
  const orderBuckets = {
    new: (orders ?? []).filter((row) => (row.kot_status as string) === "new"),
    preparing: (orders ?? []).filter((row) => (row.kot_status as string) === "preparing"),
    ready: (orders ?? []).filter((row) => (row.kot_status as string) === "ready"),
    served: (orders ?? []).filter((row) => (row.kot_status as string) === "served"),
  };

  const setupIncomplete = activeProperty && !activeProperty.setup_completed_at;

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader
        title="Inbox"
        properties={properties}
        activePropertyId={propertyId}
      />
      <main className="mx-auto max-w-[1200px] space-y-12 px-6 py-10 md:px-8">
        {!deskPinConfigured() ? (
          <p className="border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-espresso">
            Dev mode: desk PIN not set. Add <code className="font-mono">DESK_PIN</code>{" "}
            before production.
          </p>
        ) : null}

        {setupIncomplete ? (
          <p className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-espresso">
            Setup incomplete for {activeProperty.name}.{" "}
            <a
              href={`/erp/properties/${propertyId}/setup`}
              className="font-medium text-maroon underline-offset-4 hover:underline"
            >
              Finish setup →
            </a>
          </p>
        ) : null}

        <InboxSection
          title="Holds awaiting token"
          subtitle="Confirm when bank/cash token arrives · unpaid holds expire by season TTL"
          empty="No open holds."
        >
          {heldBookings.map((row) => (
            <li key={row.id as string} className="border-b border-espresso/10 py-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-espresso">
                  {(row.contact_name as string) ?? "Guest"} · {row.contact_phone as string}
                </p>
                <StatusPill value="held" />
              </div>
              <p className="mt-1 text-muted">
                {fmtDate(row.check_in as string)} → {fmtDate(row.check_out as string)} ·
                token {formatBtn(Number(row.token_required_btn ?? 0))}
                {row.hold_expires_at
                  ? ` · expires ${new Date(row.hold_expires_at as string).toLocaleString("en-BT", { timeZone: "Asia/Thimphu" })}`
                  : ""}
              </p>
              <p className="mt-1 font-mono text-xs text-espresso/50">{row.id as string}</p>
              <BookingLifecycleActions
                bookingId={row.id as string}
                status="held"
                tokenRequired={Number(row.token_required_btn ?? 0)}
              />
            </li>
          ))}
        </InboxSection>

        <InboxSection
          title="P2 order board"
          subtitle="Move tickets across the kitchen flow"
          empty="No orders yet."
          trailing={<DeskLiveRefresh />}
        >
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
            {KOT_FLOW.map((bucket) => (
              <OrderBoardColumn
                key={bucket}
                title={KOT_LABEL[bucket]}
                orders={orderBuckets[bucket]}
                openBookings={openBookings}
              />
            ))}
          </div>
        </InboxSection>

        <InboxSection title="Open folios" empty="No folios yet.">
          {(folios ?? []).map((folio) => {
            const balance = ((folio.folio_lines as { total_btn: number; status: string }[] | null) ?? [])
              .filter((line) => line.status === "posted")
              .reduce((sum, line) => sum + Number(line.total_btn ?? 0), 0);
            return (
              <li key={folio.id as string} className="border-b border-espresso/10 py-4 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-espresso">{folio.label as string}</p>
                  <StatusPill value={folio.status as string} />
                </div>
                <p className="mt-1 text-muted">
                  Balance {formatBtn(balance)} · booking {(folio.booking_id as string) ?? "walk-in"}
                </p>
                <p className="mt-1 font-mono text-xs text-espresso/50">{folio.id as string}</p>
                <a
                  href={`/erp/folios/${folio.id as string}`}
                  className="mt-2 inline-flex min-h-10 items-center text-xs font-medium text-maroon underline-offset-4 hover:underline"
                >
                  Open folio →
                </a>
              </li>
            );
          })}
        </InboxSection>

        <InboxSection title="Room bookings" empty="No bookings yet.">
          {(bookings ?? []).map((row) => (
            <li key={row.id as string} className="border-b border-espresso/10 py-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-espresso">
                  {(row.contact_name as string) ?? "Guest"} · {row.contact_phone as string}
                </p>
                <StatusPill value={row.status as string} />
              </div>
              <p className="mt-1 text-muted">
                {fmtDate(row.check_in as string)} → {fmtDate(row.check_out as string)} ·{" "}
                {row.adults as number} adults · {row.rooms as number} rooms
              </p>
              <p className="mt-1 font-mono text-xs text-espresso/50">{row.id as string}</p>
              {["pending", "confirmed", "checked_in"].includes(row.status as string) ? (
                <a
                  href={`/erp/check-in?id=${row.id as string}`}
                  className="mt-2 inline-flex min-h-10 items-center text-xs font-medium text-maroon underline-offset-4 hover:underline"
                >
                  {(row.status as string) === "checked_in"
                    ? "Manage / check out →"
                    : "Check in →"}
                </a>
              ) : null}
              {(row.status as string) !== "held" ? (
                <BookingLifecycleActions
                  bookingId={row.id as string}
                  status={row.status as string}
                  tokenRequired={Number(row.token_required_btn ?? 0)}
                />
              ) : null}
            </li>
          ))}
        </InboxSection>

        <InboxSection title="Spa / meeting requests" empty="No service requests yet.">
          {(services ?? []).map((row) => (
            <li key={row.id as string} className="border-b border-espresso/10 py-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-espresso">
                  {row.kind as string} · {row.contact_name as string} ·{" "}
                  {row.contact_phone as string}
                </p>
                <StatusPill value={row.status as string} />
              </div>
              <p className="mt-1 text-muted">
                {fmtDate(row.preferred_on as string)}
                {row.preferred_time ? ` · ${row.preferred_time}` : ""} · party{" "}
                {row.party_size as number}
              </p>
              <p className="mt-1 font-mono text-xs text-espresso/50">{row.id as string}</p>
            </li>
          ))}
        </InboxSection>

        <InboxSection title="Enquiries" empty="No enquiries yet.">
          {(enquiries ?? []).map((row) => (
            <li key={row.id as string} className="border-b border-espresso/10 py-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-espresso">
                  {row.topic as string} · {row.contact_name as string} ·{" "}
                  {row.contact_phone as string}
                </p>
                <StatusPill value={row.status as string} />
              </div>
              <p className="mt-1 text-muted line-clamp-2">{row.message as string}</p>
              <p className="mt-1 font-mono text-xs text-espresso/50">{row.id as string}</p>
            </li>
          ))}
        </InboxSection>

        <InboxSection title="Agent applications" empty="No agent applications yet.">
          {(agents ?? []).map((row) => (
            <li key={row.id as string} className="border-b border-espresso/10 py-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-espresso">
                  {row.company_name as string} · {row.market as string}
                </p>
                <StatusPill value={row.status as string} />
              </div>
              <p className="mt-1 text-muted">
                {(row.contact_name as string) ?? "—"} ·{" "}
                {(row.contact_phone as string) ?? "—"} · MoU{" "}
                {row.wants_mou ? "yes" : "no"}
              </p>
              <p className="mt-1 font-mono text-xs text-espresso/50">{row.id as string}</p>
            </li>
          ))}
        </InboxSection>
      </main>
    </div>
  );
}

function InboxSection({
  title,
  subtitle,
  empty,
  children,
  trailing,
}: {
  title: string;
  subtitle?: string;
  empty: string;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  const list = items.flat().filter(Boolean);
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-espresso/15 pb-2">
        <div>
          <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {trailing}
          {list.length > 0 ? (
            <p className="text-xs text-muted">{list.length}</p>
          ) : null}
        </div>
      </div>
      {list.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2">{list}</ul>
      )}
    </section>
  );
}

function StatusPill({ value }: { value: string }) {
  if (!value) return null;
  const tone =
    value === "checked_in" || value === "approved" || value === "open"
      ? "border-gold/40 bg-gold/10 text-gold"
      : value === "confirmed" || value === "ready"
        ? "border-espresso/20 bg-espresso/[0.05] text-espresso"
        : value === "held"
          ? "border-maroon/30 bg-maroon/5 text-maroon"
          : "border-espresso/15 text-muted";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

function OrderBoardColumn({
  title,
  orders,
  openBookings,
}: {
  title: string;
  orders: Record<string, unknown>[];
  openBookings: Record<string, unknown>[];
}) {
  return (
    <section className="flex flex-col border border-espresso/10 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
          {title}
        </h3>
        <span className="text-xs text-muted">{orders.length}</span>
      </div>
      {orders.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No orders.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {orders.map((row) => {
            const items =
              ((row.order_items as { name_snapshot: string; qty: number }[] | null) ?? [])
                .map((item) => `${item.qty}× ${item.name_snapshot}`)
                .join(", ") || "Items pending";
            return (
              <li key={row.id as string} className="border border-espresso/10 bg-ivory/40 p-3 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-espresso">{row.customer_name as string}</p>
                  <p className="tabular-nums text-espresso">{formatBtn(Number(row.total_btn))}</p>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {(row.outlet as string) ?? "order"} ·{" "}
                  {(row.delivery_type as string) ?? "pickup"}
                </p>
                <p className="mt-1 text-xs text-muted">{items}</p>
                <p className="mt-1 font-mono text-[10px] text-espresso/50">
                  {row.id as string}
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {KOT_FLOW.map((status) => (
                    <form key={status} action={updateOrderKotStatus}>
                      <input type="hidden" name="order_id" value={row.id as string} />
                      <input type="hidden" name="kot_status" value={status} />
                      <button
                        type="submit"
                        className="inline-flex min-h-9 items-center rounded-sm border border-espresso/20 px-2.5 text-[11px] text-espresso transition-colors hover:border-espresso/50 hover:bg-espresso/[0.03]"
                      >
                        {KOT_LABEL[status]}
                      </button>
                    </form>
                  ))}
                </div>

                {!row.posted_to_folio_at && openBookings.length > 0 ? (
                  <form action={postOrderToBookingFolio} className="mt-3 flex flex-wrap gap-2">
                    <input type="hidden" name="order_id" value={row.id as string} />
                    <select
                      name="booking_id"
                      defaultValue=""
                      className="min-h-9 flex-1 rounded-sm border border-espresso/20 px-2 text-xs text-espresso outline-none focus:border-gold"
                    >
                      <option value="" disabled>
                        Charge to booking folio
                      </option>
                      {openBookings.map((booking) => (
                        <option key={booking.id as string} value={booking.id as string}>
                          {((booking.contact_name as string) ?? "Guest")} ·{" "}
                          {fmtDate(booking.check_in as string)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="inline-flex min-h-9 items-center rounded-sm bg-gold px-3 text-xs font-medium text-espresso transition-opacity hover:opacity-90"
                    >
                      Post
                    </button>
                  </form>
                ) : row.posted_to_folio_at ? (
                  <p className="mt-3 text-xs text-muted">
                    Posted to folio {(row.folio_id as string) ?? "—"}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
