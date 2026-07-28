import {
  postOrderToBookingFolio,
  updateOrderKotStatus,
} from "@/app/actions/erp-pos";
import { DeskHeader } from "@/components/erp/DeskHeader";
import { deskPinConfigured, isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const metadata = {
  title: "Desk inbox | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  return value;
}

export default async function ErpInboxPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const admin = createSupabaseAdminClient();

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
        "id, contact_name, contact_phone, check_in, check_out, adults, rooms, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("orders")
      .select(
        "id, customer_name, phone, outlet, delivery_type, total_btn, status, kot_status, booking_id, folio_id, posted_to_folio_at, created_at, order_items(name_snapshot, qty)",
      )
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("service_requests")
      .select(
        "id, kind, contact_name, contact_phone, preferred_on, preferred_time, party_size, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("enquiries")
      .select("id, topic, contact_name, contact_phone, message, status, created_at")
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
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const openBookings = (bookings ?? []).filter((row) =>
    ["pending", "confirmed", "checked_in"].includes(row.status as string),
  );
  const orderBuckets = {
    new: (orders ?? []).filter((row) => (row.kot_status as string) === "new"),
    preparing: (orders ?? []).filter((row) => (row.kot_status as string) === "preparing"),
    ready: (orders ?? []).filter((row) => (row.kot_status as string) === "ready"),
    served: (orders ?? []).filter((row) => (row.kot_status as string) === "served"),
  };

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader title="Inbox" />
      <main className="mx-auto max-w-[1200px] space-y-10 px-6 py-10 md:px-8">
        {!deskPinConfigured() ? (
          <p className="border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-espresso">
            Dev mode: desk PIN not set. Add <code className="font-mono">DESK_PIN</code>{" "}
            before production.
          </p>
        ) : null}

        <InboxSection title="P2 order board" empty="No orders yet.">
          <div className="grid gap-6 lg:grid-cols-2">
            <OrderBoardColumn
              title="New"
              orders={orderBuckets.new}
              openBookings={openBookings}
            />
            <OrderBoardColumn
              title="Preparing"
              orders={orderBuckets.preparing}
              openBookings={openBookings}
            />
            <OrderBoardColumn
              title="Ready"
              orders={orderBuckets.ready}
              openBookings={openBookings}
            />
            <OrderBoardColumn
              title="Served"
              orders={orderBuckets.served}
              openBookings={openBookings}
            />
          </div>
        </InboxSection>

        <InboxSection title="Open folios" empty="No folios yet.">
          {(folios ?? []).map((folio) => {
            const balance = ((folio.folio_lines as { total_btn: number; status: string }[] | null) ?? [])
              .filter((line) => line.status === "posted")
              .reduce((sum, line) => sum + Number(line.total_btn ?? 0), 0);
            return (
              <li key={folio.id as string} className="border-b border-espresso/10 py-3 text-sm">
                <p className="font-medium text-espresso">
                  {folio.label as string} · <span className="uppercase tracking-wide">{folio.status as string}</span>
                </p>
                <p className="text-muted">
                  Balance {formatBtn(balance)} · booking {(folio.booking_id as string) ?? "walk-in"}
                </p>
                <p className="mt-1 font-mono text-xs text-espresso/50">{folio.id as string}</p>
              </li>
            );
          })}
        </InboxSection>

        <InboxSection title="Room bookings" empty="No bookings yet.">
          {(bookings ?? []).map((row) => (
            <li key={row.id as string} className="border-b border-espresso/10 py-3 text-sm">
              <p className="font-medium text-espresso">
                {(row.contact_name as string) ?? "Guest"} · {row.contact_phone as string}
              </p>
              <p className="text-muted">
                {fmtDate(row.check_in as string)} → {fmtDate(row.check_out as string)} ·{" "}
                {row.adults as number} adults · {row.rooms as number} rooms ·{" "}
                <span className="uppercase tracking-wide">{row.status as string}</span>
              </p>
              <p className="mt-1 font-mono text-xs text-espresso/50">{row.id as string}</p>
            </li>
          ))}
        </InboxSection>

        <InboxSection title="Spa / meeting requests" empty="No service requests yet.">
          {(services ?? []).map((row) => (
            <li key={row.id as string} className="border-b border-espresso/10 py-3 text-sm">
              <p className="font-medium text-espresso">
                {row.kind as string} · {row.contact_name as string} ·{" "}
                {row.contact_phone as string}
              </p>
              <p className="text-muted">
                {fmtDate(row.preferred_on as string)}
                {row.preferred_time ? ` · ${row.preferred_time}` : ""} · party{" "}
                {row.party_size as number} ·{" "}
                <span className="uppercase tracking-wide">{row.status as string}</span>
              </p>
              <p className="mt-1 font-mono text-xs text-espresso/50">{row.id as string}</p>
            </li>
          ))}
        </InboxSection>

        <InboxSection title="Enquiries" empty="No enquiries yet.">
          {(enquiries ?? []).map((row) => (
            <li key={row.id as string} className="border-b border-espresso/10 py-3 text-sm">
              <p className="font-medium text-espresso">
                {row.topic as string} · {row.contact_name as string} ·{" "}
                {row.contact_phone as string}
              </p>
              <p className="text-muted line-clamp-2">{row.message as string}</p>
              <p className="mt-1 font-mono text-xs text-espresso/50">{row.id as string}</p>
            </li>
          ))}
        </InboxSection>

        <InboxSection title="Agent applications" empty="No agent applications yet.">
          {(agents ?? []).map((row) => (
            <li key={row.id as string} className="border-b border-espresso/10 py-3 text-sm">
              <p className="font-medium text-espresso">
                {row.company_name as string} · {row.market as string}
              </p>
              <p className="text-muted">
                {(row.contact_name as string) ?? "—"} ·{" "}
                {(row.contact_phone as string) ?? "—"} · MoU{" "}
                {row.wants_mou ? "yes" : "no"} ·{" "}
                <span className="uppercase tracking-wide">{row.status as string}</span>
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
    <section>
      <h2 className="text-sm font-medium tracking-[0.18em] text-gold uppercase">
        {title}
      </h2>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 border-t border-espresso/10">{list}</ul>
      )}
    </section>
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
    <section className="border border-espresso/10 bg-white p-4">
      <h3 className="text-sm font-medium tracking-[0.18em] text-gold uppercase">{title}</h3>
      {orders.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No orders.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {orders.map((row) => {
            const items =
              ((row.order_items as { name_snapshot: string; qty: number }[] | null) ?? [])
                .map((item) => `${item.qty}× ${item.name_snapshot}`)
                .join(", ") || "Items pending";
            return (
              <li key={row.id as string} className="border border-espresso/10 p-3 text-sm">
                <p className="font-medium text-espresso">
                  {row.customer_name as string} · {formatBtn(Number(row.total_btn))}
                </p>
                <p className="text-muted">
                  {(row.outlet as string) ?? "order"} · {(row.delivery_type as string) ?? "pickup"} ·{" "}
                  {(row.kot_status as string) ?? "new"}
                </p>
                <p className="mt-1 text-muted">{items}</p>
                <p className="mt-1 font-mono text-xs text-espresso/50">{row.id as string}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {["new", "preparing", "ready", "served"].map((status) => (
                    <form key={status} action={updateOrderKotStatus}>
                      <input type="hidden" name="order_id" value={row.id as string} />
                      <input type="hidden" name="kot_status" value={status} />
                      <button
                        type="submit"
                        className="inline-flex min-h-10 items-center rounded-sm border border-espresso/20 px-3 text-xs text-espresso"
                      >
                        {status}
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
                      className="min-h-10 rounded-sm border border-espresso/20 px-3 text-xs text-espresso"
                    >
                      <option value="" disabled>
                        Charge to booking folio
                      </option>
                      {openBookings.map((booking) => (
                        <option key={booking.id as string} value={booking.id as string}>
                          {((booking.contact_name as string) ?? "Guest")} · {fmtDate(booking.check_in as string)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="inline-flex min-h-10 items-center rounded-sm bg-gold px-3 text-xs font-medium text-espresso"
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
