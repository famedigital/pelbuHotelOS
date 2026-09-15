import { PrintButton } from "@/components/erp/PrintButton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { thimphuToday } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { formatBtn } from "@/lib/pricing";
import {
  computeManagerFlash,
  formatFlashMoney,
} from "@/lib/reports/manager-flash";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Reports",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function monthStartIso(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

type Props = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function ErpReportsPage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();
  const since = monthStartIso(today);
  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : since;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : today;

  const [
    flash,
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
    computeManagerFlash(admin, propertyId, { from, to }),
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
    (b) => String(b.check_in) <= today && String(b.check_out) > today,
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
  const agentProd = new Map<
    string,
    { id: string; name: string; bookings: number }
  >();
  for (const b of bookingsRes.data ?? []) {
    const aid = b.agent_id as string | null;
    if (!aid) continue;
    const agent = agentMap.get(aid);
    const name = (agent?.company_name as string) ?? aid.slice(0, 8);
    const cur = agentProd.get(aid) ?? { id: aid, name, bookings: 0 };
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
    <div className="erp mx-auto w-full max-w-[1200px] space-y-10 p-4 md:p-6 print:max-w-none print:p-0">
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Reports
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Manager flash &amp; MTD
          </h1>
          <p className="text-sm text-muted-foreground">
            ADR / OCC / RevPAR use sellable rooms only (comp beds excluded).
          </p>
        </div>
        <PrintButton label="Print flash" />
      </header>

      <section className="space-y-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Report catalog
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Named reports with date and entity filters — not a free-form query
            builder.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: `/erp/reports/performance?from=${from}&to=${to}`,
              title: "Owner performance",
              blurb: "Targets vs achieved · income · OpEx · agents & countries",
            },
            {
              href: `/erp/reports/agent-production?from=${from}&to=${to}`,
              title: "Agent production",
              blurb: "Bookings, room-nights, quoted totals",
            },
            {
              href: `/erp/reports/agent-ar?from=${from}&to=${to}`,
              title: "Agent AR & habit",
              blurb: "Outstanding, aging, payment mix",
            },
            {
              href: `/erp/reports/deposit-due?from=${from}&to=${to}`,
              title: "Deposit due",
              blurb: "Token shortfall · release deposit date",
            },
            {
              href: `/erp/reports/cancellations?from=${from}&to=${to}`,
              title: "Cancellations",
              blurb: "Cancelled and no-show stays",
            },
            {
              href: `/erp/reports/meal-count?from=${from}&to=${to}`,
              title: "Meal count",
              blurb: "Covers by meal plan for a night",
            },
            {
              href: `/erp/reports/fo-occupancy?from=${from}&to=${to}`,
              title: "FO occupancy",
              blurb: "Daily OCC% · arrivals · departs",
            },
            {
              href: `/erp/reports/room-moves?from=${from}&to=${to}`,
              title: "Room move audit",
              blurb: "Who moved which assignment",
            },
            {
              href: `/erp/reports/guest-ar-aging?from=${from}&to=${to}`,
              title: "Guest AR aging",
              blurb: "Open folios · 30/60/90 slabs",
            },
            {
              href: `/erp/reports/staff-attendance?from=${from}&to=${to}`,
              title: "Staff attendance",
              blurb: "Punches and estimated hours",
            },
            {
              href: `/erp/reports/inventory-movements?from=${from}&to=${to}`,
              title: "Inventory movements",
              blurb: "Receive / issue / waste by item",
            },
          ].map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-lg border bg-card p-4 transition-colors hover:border-accent/40 hover:bg-accent/5"
            >
              <p className="text-sm font-medium text-foreground">{card.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">
          Manager flash · {from} → {to}
        </h1>
        <p className="text-sm text-muted-foreground">
          Sellable capacity {flash.sellableCapacity} · {flash.days} night
          {flash.days === 1 ? "" : "s"}
        </p>
      </div>

      <section className="space-y-4 rounded-lg border bg-card p-4 print:break-inside-avoid">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              Manager flash
            </p>
            <p className="mt-1 text-sm text-muted-foreground print:hidden">
              Date range (inclusive) · room nights / sellable capacity nights
            </p>
          </div>
          <form
            className="flex flex-wrap items-end gap-2 print:hidden"
            action="/erp/reports"
            method="get"
          >
            <div className="space-y-1">
              <Label htmlFor="from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input
                id="from"
                type="date"
                name="from"
                defaultValue={from}
                className="h-9 w-40"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input
                id="to"
                type="date"
                name="to"
                defaultValue={to}
                className="h-9 w-40"
              />
            </div>
            <Button type="submit" variant="outline" className="h-9">
              Apply
            </Button>
          </form>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="OCC %" value={`${flash.occupancyPct}%`} />
          <Stat
            label="Room nights"
            value={`${flash.roomNightsSold} / ${flash.capacityNights}`}
          />
          <Stat label="Room revenue" value={formatFlashMoney(flash.roomRevenueBtn)} />
          <Stat label="ADR" value={formatFlashMoney(flash.adrBtn)} />
          <Stat label="RevPAR" value={formatFlashMoney(flash.revparBtn)} />
        </div>
        <p className="text-xs text-muted-foreground">
          Window {from} → {to} · {flash.days} day{flash.days === 1 ? "" : "s"} ·
          sellable inventory {flash.sellableCapacity}
        </p>
      </section>

      <p className="text-xs text-muted-foreground print:hidden">
        Export CSV:{" "}
        <a
          href={`/api/erp/export?kind=payments&since=${since}`}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          payments
        </a>
        {" · "}
        <a
          href={`/api/erp/export?kind=expenses&since=${since}`}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          expenses
        </a>
        {" · "}
        <a
          href={`/api/erp/export?kind=folio_lines&since=${since}`}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          folio lines
        </a>
        {" · "}
        <a
          href={`/api/erp/export?kind=gst_filing&since=${since}`}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          GST filing
        </a>
        {" · "}
        <Link
          href="/erp/night-audit"
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          night audit
        </Link>
      </p>

      <section className="space-y-3 print:hidden">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Occupancy today
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <p className="text-xs text-muted-foreground">
          HK:{" "}
          {Object.entries(hkCounts)
            .map(([k, v]) => `${k} ${v}`)
            .join(" · ") || "n/a"}
        </p>
      </section>

      <section className="space-y-3 print:hidden">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          This month — money
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Payments in" value={formatBtn(paymentsIn)} />
          <Stat label="Expenses" value={formatBtn(expensesOut)} />
          <Stat label="Room folio" value={formatBtn(roomFolio)} />
          <Stat label="GST on folio" value={formatBtn(gstCollected)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="F&amp;B order sales" value={formatBtn(fnbSales)} />
          <Stat label="F&amp;B GST" value={formatBtn(fnbGst)} />
          <Stat label="Guest services folio" value={formatBtn(serviceFolio)} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2 print:hidden">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              F&amp;B by outlet
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fnbByOutlet.size === 0 ? (
              <p className="text-sm text-muted-foreground">
                No F&amp;B sales this month.
              </p>
            ) : (
              <ul>
                {[...fnbByOutlet.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([outlet, total]) => (
                    <li
                      key={outlet}
                      className="flex justify-between border-b py-3 text-sm last:border-0"
                    >
                      <span className="text-foreground">{outlet}</span>
                      <span className="tabular-nums">{formatBtn(total)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              Agent production
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agentRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No agent bookings this month.
              </p>
            ) : (
              <ul>
                {agentRows.map((a) => (
                  <li
                    key={a.id}
                    className="flex justify-between border-b py-3 text-sm last:border-0"
                  >
                    <Link
                      href={`/erp/agents/${a.id}`}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {a.name}
                    </Link>
                    <span className="tabular-nums text-muted-foreground">
                      {a.bookings} booking{a.bookings === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {(agentsRes.data ?? []).length > 0 ? (
              <div className="mt-6 border-t pt-4">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-accent uppercase">
                  Credit snapshot
                </p>
                <ul className="mt-2">
                  {(agentsRes.data ?? [])
                    .filter((a) => Number(a.credit_limit) > 0)
                    .map((a) => (
                      <li
                        key={a.id as string}
                        className="flex justify-between border-b py-2 text-xs last:border-0"
                      >
                        <Link
                          href={`/erp/agents/${a.id as string}`}
                          className="hover:underline"
                        >
                          {a.company_name as string}
                        </Link>
                        <span className="tabular-nums text-muted-foreground">
                          {formatBtn(Number(a.credit_used))} /{" "}
                          {formatBtn(Number(a.credit_limit))}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Audit trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(auditRes.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No audit events yet — money/ops actions will appear here.
            </p>
          ) : (
            <ul>
              {(auditRes.data ?? []).map((e) => (
                <li key={e.id as string} className="border-b py-3 text-sm last:border-0">
                  <p className="font-medium text-foreground">
                    {e.summary as string}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.action as string} · {e.actor as string} ·{" "}
                    {String(e.created_at).slice(0, 16).replace("T", " ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-2 py-4">
      <CardContent>
        <p className="text-[10px] font-semibold tracking-[0.18em] text-accent uppercase">
          {label}
        </p>
        <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
