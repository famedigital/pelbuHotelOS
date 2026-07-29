import { DeskHeader } from "@/components/erp/DeskHeader";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Reports | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function monthStartIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function ErpReportsPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  const propertyId = property?.id as string | undefined;
  if (!propertyId) {
    return (
      <div className="min-h-screen bg-ivory">
        <DeskHeader title="Reports" />
        <main className="mx-auto max-w-[1200px] px-6 py-10">
          <p className="text-sm text-maroon">Property not configured.</p>
        </main>
      </div>
    );
  }

  const since = monthStartIso();
  const today = todayIso();

  const [
    roomTypesRes,
    bookingsRes,
    bookingRoomsRes,
    ordersRes,
    folioLinesRes,
    agentsRes,
    paymentsRes,
    expensesRes,
    auditRes,
    hkRes,
  ] = await Promise.all([
    admin
      .from("room_types")
      .select("id, code, name, inventory_kind, unit_count")
      .eq("property_id", propertyId),
    admin
      .from("bookings")
      .select("id, status, check_in, check_out, agent_id, contact_name")
      .eq("property_id", propertyId)
      .gte("check_in", since)
      .limit(500),
    admin
      .from("booking_rooms")
      .select("booking_id, qty, inventory_kind, room_type_id")
      .limit(1000),
    admin
      .from("orders")
      .select("id, outlet, total_btn, gst_btn, status, created_at")
      .eq("property_id", propertyId)
      .gte("created_at", since)
      .limit(500),
    admin
      .from("folios")
      .select("id, folio_lines(source_type, total_btn, gst_btn, status, created_at)")
      .eq("property_id", propertyId)
      .limit(300),
    admin
      .from("agents")
      .select("id, company_name, market, credit_limit, credit_used, status")
      .limit(100),
    admin
      .from("payments")
      .select("id, amount_btn, method, created_at")
      .eq("property_id", propertyId)
      .gte("created_at", since)
      .limit(300),
    admin
      .from("expenses")
      .select("id, amount_btn, category, expense_date")
      .eq("property_id", propertyId)
      .gte("expense_date", since)
      .limit(300),
    admin
      .from("audit_events")
      .select("id, action, summary, actor, created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("room_units")
      .select("id, hk_status")
      .eq("property_id", propertyId),
  ]);

  const roomTypes = roomTypesRes.data ?? [];
  const sellableCapacity = roomTypes
    .filter((r) => r.inventory_kind === "sellable_guest")
    .reduce((s, r) => s + Number(r.unit_count ?? 0), 0);
  const compCapacity = roomTypes
    .filter((r) =>
      ["guide_comp", "driver_comp"].includes(r.inventory_kind as string),
    )
    .reduce((s, r) => s + Number(r.unit_count ?? 0), 0);

  const inHouse = (bookingsRes.data ?? []).filter((b) =>
    ["confirmed", "checked_in"].includes(b.status as string),
  );
  const todayInHouse = inHouse.filter(
    (b) =>
      String(b.check_in) <= today &&
      String(b.check_out) > today,
  );

  const bookingIds = new Set(todayInHouse.map((b) => b.id as string));
  let sellableOcc = 0;
  let compOcc = 0;
  for (const line of bookingRoomsRes.data ?? []) {
    if (!bookingIds.has(line.booking_id as string)) continue;
    const qty = Number(line.qty ?? 0);
    if ((line.inventory_kind as string) === "sellable_guest") sellableOcc += qty;
    else if (
      ["guide_comp", "driver_comp"].includes(line.inventory_kind as string)
    ) {
      compOcc += qty;
    }
  }

  const occPct =
    sellableCapacity > 0
      ? Math.round((sellableOcc / sellableCapacity) * 1000) / 10
      : 0;

  const orders = ordersRes.data ?? [];
  const fnbByOutlet = new Map<string, number>();
  let fnbSales = 0;
  let fnbGst = 0;
  for (const o of orders) {
    if ((o.status as string) === "cancelled") continue;
    const total = Number(o.total_btn ?? 0);
    const gst = Number(o.gst_btn ?? 0);
    fnbSales += total;
    fnbGst += gst;
    const outlet = (o.outlet as string) || "other";
    fnbByOutlet.set(outlet, (fnbByOutlet.get(outlet) ?? 0) + total);
  }

  const folioLines = (folioLinesRes.data ?? []).flatMap((f) => {
    const lines =
      (f.folio_lines as
        | {
            source_type: string;
            total_btn: number;
            gst_btn: number;
            status: string;
            created_at: string;
          }[]
        | null) ?? [];
    return lines.filter(
      (l) => l.status === "posted" && String(l.created_at) >= since,
    );
  });
  const roomFolio = folioLines
    .filter((l) => l.source_type === "room")
    .reduce((s, l) => s + Number(l.total_btn), 0);
  const serviceFolio = folioLines
    .filter((l) => l.source_type === "service")
    .reduce((s, l) => s + Number(l.total_btn), 0);
  const gstCollected = folioLines.reduce((s, l) => s + Number(l.gst_btn), 0);

  const paymentsIn = (paymentsRes.data ?? []).reduce(
    (s, p) => s + Number(p.amount_btn ?? 0),
    0,
  );
  const expensesOut = (expensesRes.data ?? []).reduce(
    (s, e) => s + Number(e.amount_btn ?? 0),
    0,
  );

  const agentMap = new Map(
    (agentsRes.data ?? []).map((a) => [a.id as string, a]),
  );
  const agentProd = new Map<string, { name: string; bookings: number }>();
  for (const b of bookingsRes.data ?? []) {
    const aid = b.agent_id as string | null;
    if (!aid) continue;
    const agent = agentMap.get(aid);
    const name = (agent?.company_name as string) ?? aid.slice(0, 8);
    const cur = agentProd.get(aid) ?? { name, bookings: 0 };
    cur.bookings += 1;
    agentProd.set(aid, cur);
  }
  const agentRows = [...agentProd.values()].sort(
    (a, b) => b.bookings - a.bookings,
  );

  const hkCounts: Record<string, number> = {};
  for (const u of hkRes.data ?? []) {
    const st = u.hk_status as string;
    hkCounts[st] = (hkCounts[st] ?? 0) + 1;
  }

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader title="Reports" />
      <main className="mx-auto max-w-[1200px] space-y-12 px-6 py-10 md:px-8">
        <p className="text-sm text-muted-foreground">
          Month from {since} Â· ADR uses sellable rooms only (comp beds excluded).
        </p>
        <p className="text-xs text-muted-foreground">
          Export CSV:{" "}
          <a
            href={`/api/erp/export?kind=payments&since=${since}`}
            className="font-medium text-maroon underline-offset-4 hover:underline"
          >
            payments
          </a>
          {" Â· "}
          <a
            href={`/api/erp/export?kind=expenses&since=${since}`}
            className="font-medium text-maroon underline-offset-4 hover:underline"
          >
            expenses
          </a>
          {" Â· "}
          <a
            href={`/api/erp/export?kind=folio_lines&since=${since}`}
            className="font-medium text-maroon underline-offset-4 hover:underline"
          >
            folio lines
          </a>
        </p>

        <section>
          <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
            Occupancy today
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Sellable occ %" value={`${occPct}%`} />
            <Stat
              label="Sellable rooms used"
              value={`${sellableOcc} / ${sellableCapacity}`}
            />
            <Stat
              label="Comp beds used"
              value={`${compOcc} / ${compCapacity}`}
            />
            <Stat label="In-house bookings" value={String(todayInHouse.length)} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            HK:{" "}
            {Object.entries(hkCounts)
              .map(([k, v]) => `${k} ${v}`)
              .join(" Â· ") || "n/a"}
          </p>
        </section>

        <section>
          <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
            This month — money
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Payments in" value={formatBtn(paymentsIn)} />
            <Stat label="Expenses" value={formatBtn(expensesOut)} />
            <Stat label="Room folio" value={formatBtn(roomFolio)} />
            <Stat label="GST on folio" value={formatBtn(gstCollected)} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="F&B order sales" value={formatBtn(fnbSales)} />
            <Stat label="F&B GST" value={formatBtn(fnbGst)} />
            <Stat label="Guest services folio" value={formatBtn(serviceFolio)} />
          </div>
        </section>

        <div className="grid gap-10 lg:grid-cols-2">
          <section>
            <div className="border-b border-espresso/15 pb-2">
              <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
                F&amp;B by outlet
              </h2>
            </div>
            {fnbByOutlet.size === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No F&amp;B sales this month.</p>
            ) : (
              <ul className="mt-2">
                {[...fnbByOutlet.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([outlet, total]) => (
                    <li
                      key={outlet}
                      className="flex justify-between border-b border-espresso/10 py-3 text-sm"
                    >
                      <span className="text-espresso">{outlet}</span>
                      <span className="tabular-nums">{formatBtn(total)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section>
            <div className="border-b border-espresso/15 pb-2">
              <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
                Agent production
              </h2>
            </div>
            {agentRows.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No agent bookings this month.</p>
            ) : (
              <ul className="mt-2">
                {agentRows.map((a) => (
                  <li
                    key={a.name}
                    className="flex justify-between border-b border-espresso/10 py-3 text-sm"
                  >
                    <span className="text-espresso">{a.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {a.bookings} booking{a.bookings === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {(agentsRes.data ?? []).length > 0 ? (
              <div className="mt-6 border-t border-espresso/10 pt-4">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-gold uppercase">
                  Credit snapshot
                </p>
                <ul className="mt-2">
                  {(agentsRes.data ?? [])
                    .filter((a) => Number(a.credit_limit) > 0)
                    .map((a) => (
                      <li
                        key={a.id as string}
                        className="flex justify-between border-b border-espresso/10 py-2 text-xs"
                      >
                        <span>{a.company_name as string}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatBtn(Number(a.credit_used))} /{" "}
                          {formatBtn(Number(a.credit_limit))}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>

        <section>
          <div className="border-b border-espresso/15 pb-2">
            <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
              Audit trail
            </h2>
          </div>
          {(auditRes.data ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No audit events yet — money/ops actions will appear here.
            </p>
          ) : (
            <ul className="mt-2">
              {(auditRes.data ?? []).map((e) => (
                <li
                  key={e.id as string}
                  className="border-b border-espresso/10 py-3 text-sm"
                >
                  <p className="font-medium text-espresso">{e.summary as string}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.action as string} Â· {e.actor as string} Â·{" "}
                    {String(e.created_at).slice(0, 16).replace("T", " ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-espresso/10 bg-white px-4 py-4">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-gold uppercase">
        {label}
      </p>
      <p className="mt-2 text-lg tabular-nums text-espresso">{value}</p>
    </div>
  );
}
