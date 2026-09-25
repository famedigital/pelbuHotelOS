import {
  PublishMealServiceForm,
} from "@/components/erp/KitchenOpsForms";
import {
  KitchenEventsPanel,
  type KitchenEventRow,
} from "@/components/erp/KitchenEventsPanel";
import { KitchenCoversSection } from "@/components/erp/KitchenCoversSection";
import { KitchenStaffSection } from "@/components/erp/KitchenStaffSection";
import { DayOpsGuestPanel } from "@/components/erp/DayOpsGuestPanel";
import { MealServiceBoard } from "@/components/erp/MealServiceBoard";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadDayOpsBoard } from "@/lib/erp/day-ops-board";
import { computeMealCovers } from "@/lib/kitchen/covers";
import { computeFoodCostPeriod } from "@/lib/kitchen/food-cost";
import { loadMealServicesForDate } from "@/lib/kitchen/meal-service";
import { computeKitchenStaffBoard } from "@/lib/kitchen/staff-shift";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { thimphuToday } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Kitchen board",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function monthStart(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

export default async function KitchenBoardPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();
  const from = monthStart(today);

  const [
    covers,
    staffBoard,
    foodCost,
    mealServices,
    dayOps,
    gasRes,
    stockRes,
    expiryRes,
    eventsRes,
    servicesRes,
    foliosRes,
  ] = await Promise.all([
      computeMealCovers(admin, propertyId, today),
      computeKitchenStaffBoard(admin, propertyId, today),
      computeFoodCostPeriod(admin, propertyId, from, today),
      loadMealServicesForDate(admin, propertyId, today),
      loadDayOpsBoard(admin, propertyId, today),
      admin
        .from("inventory_items")
        .select("sku, name, qty_on_hand, reorder_level")
        .eq("property_id", propertyId)
        .in("sku", ["LPG-FULL", "LPG-EMPTY"]),
      admin
        .from("inventory_items")
        .select("id, sku, name, category, qty_on_hand, reorder_level, unit")
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .in("category", ["produce", "meat", "dairy", "dry", "vegetables", "grocery", "kitchen"])
        .order("category")
        .order("name")
        .limit(80),
      admin
        .from("inventory_movements")
        .select("item_id, expires_on, inventory_items(name, category, sku)")
        .eq("property_id", propertyId)
        .eq("movement_kind", "receive")
        .not("expires_on", "is", null)
        .gte("expires_on", today)
        .order("expires_on")
        .limit(40),
      admin
        .from("kitchen_events")
        .select(
          "id, event_date, title, covers, meal_period, notes, service_time, service_end, menu_note, venue, contact_name, contact_phone, status, rate_per_pax_btn, package_total_btn, deposit_btn, billing_status, bill_note, folio_id, booking_id, posted_folio_line_id, folios(id, label)",
        )
        .eq("property_id", propertyId)
        .gte("event_date", today)
        .neq("status", "cancelled")
        .order("event_date")
        .order("service_time")
        .limit(40),
      admin
        .from("service_requests")
        .select("id, kind, contact_name, preferred_on, party_size, status")
        .eq("property_id", propertyId)
        .in("kind", ["meeting", "spa", "event"])
        .gte("preferred_on", today)
        .order("preferred_on")
        .limit(10),
      admin
        .from("folios")
        .select("id, label, booking_id, status")
        .eq("property_id", propertyId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

  const gasFull =
    gasRes.data?.find((g) => g.sku === "LPG-FULL")?.qty_on_hand ?? 0;
  const gasEmpty =
    gasRes.data?.find((g) => g.sku === "LPG-EMPTY")?.qty_on_hand ?? 0;

  const stockRows = stockRes.data ?? [];
  const lowStock = stockRows.filter(
    (i) => Number(i.qty_on_hand) <= Number(i.reorder_level),
  );

  const expiryRows = (expiryRes.data ?? []).map((row) => {
    const item = row.inventory_items as {
      name?: string;
      category?: string;
      sku?: string;
    } | null;
    return {
      name: item?.name ?? item?.sku ?? "Item",
      category: item?.category ?? "other",
      expiresOn: row.expires_on as string,
    };
  });

  const filterCategories = ["all", "produce", "meat", "dairy", "dry"] as const;
  const gasOk = Number(gasFull) >= 1;
  const stockOk = lowStock.length === 0;
  const foodCostOk = foodCost.foodCostPct <= 32;

  const kitchenEvents: KitchenEventRow[] = (eventsRes.data ?? []).map((ev) => {
    const folioJoin = ev.folios as
      | { id?: string; label?: string }
      | { id?: string; label?: string }[]
      | null;
    const folio = Array.isArray(folioJoin) ? folioJoin[0] : folioJoin;
    return {
      id: ev.id as string,
      eventDate: ev.event_date as string,
      title: ev.title as string,
      covers: Number(ev.covers ?? 0),
      mealPeriod: (ev.meal_period as string) ?? "all",
      notes: (ev.notes as string | null) ?? null,
      serviceTime: (ev.service_time as string | null) ?? null,
      serviceEnd: (ev.service_end as string | null) ?? null,
      menuNote: (ev.menu_note as string | null) ?? null,
      venue: (ev.venue as string | null) ?? null,
      contactName: (ev.contact_name as string | null) ?? null,
      contactPhone: (ev.contact_phone as string | null) ?? null,
      status: (ev.status as string) ?? "planned",
      ratePerPaxBtn:
        ev.rate_per_pax_btn == null ? null : Number(ev.rate_per_pax_btn),
      packageTotalBtn:
        ev.package_total_btn == null ? null : Number(ev.package_total_btn),
      depositBtn: Number(ev.deposit_btn ?? 0),
      billingStatus: (ev.billing_status as string) ?? "none",
      billNote: (ev.bill_note as string | null) ?? null,
      folioId: (ev.folio_id as string | null) ?? null,
      bookingId: (ev.booking_id as string | null) ?? null,
      postedFolioLineId: (ev.posted_folio_line_id as string | null) ?? null,
      folioLabel: (folio?.label as string | null | undefined) ?? null,
    };
  });

  const folioOptions = (foliosRes.data ?? []).map((f) => ({
    id: f.id as string,
    label: (f.label as string) || (f.id as string).slice(0, 8),
    bookingId: (f.booking_id as string | null) ?? null,
  }));

  return (
    <DeskListShell
      eyebrow="F&B operations"
      heading="Kitchen board"
      blurb="Meal covers, publish BF/lunch/dinner service to FO & F&B, staff on shift, gas, stock, and food cost."
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/erp/pos"
            className="inline-flex h-9 items-center rounded-md border px-3 text-xs hover:bg-muted"
          >
            F&B POS
          </Link>
          <Link
            href="/erp/kitchen/food-cost"
            className="inline-flex h-9 items-center rounded-md border px-3 text-xs hover:bg-muted"
          >
            Food cost worksheet
          </Link>
          <Link
            href="/erp/inventory"
            className="inline-flex h-9 items-center rounded-md border px-3 text-xs hover:bg-muted"
          >
            Stock
          </Link>
          <Link
            href="/erp/kds"
            className="inline-flex h-9 items-center rounded-md border px-3 text-xs hover:bg-muted"
          >
            Kitchen TV
          </Link>
        </div>
      }
    >
      <section className="space-y-4" aria-label="Service readiness">
        <KitchenCoversSection covers={covers} businessDate={today} />
        <div className="grid gap-6 lg:grid-cols-2">
          <DayOpsGuestPanel
            title={`Arrivals · meal plans · ${dayOps.arrivingMealPax} pax`}
            blurb="Heads arriving today — prep before first service."
            rows={dayOps.arrivals.filter((r) => r.meal_plan_code !== "EP")}
            emptyMessage="No meal-plan arrivals today."
          />
          <DayOpsGuestPanel
            title="Due out · last meal"
            blurb="Departing stays — confirm final breakfast before CO."
            rows={dayOps.departures.filter((r) => r.meal_plan_code !== "EP")}
            showFolio
            emptyMessage="No meal-plan departures today."
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <PublishMealServiceForm
            defaultDate={today}
            defaultPeriod="breakfast"
            defaultHeads={covers.breakfast}
          />
          <PublishMealServiceForm
            defaultDate={today}
            defaultPeriod="dinner"
            defaultHeads={covers.dinner}
          />
        </div>
        <MealServiceBoard services={mealServices} businessDate={today} />
        <KitchenStaffSection board={staffBoard} businessDate={today} />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/erp/inventory"
          className={`block rounded-xl border bg-card p-4 hover:border-accent/40 ${
            gasOk ? "" : "border-destructive/40"
          }`}
        >
          <p className="text-xs text-muted-foreground">LPG cylinders</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {Number(gasFull)} full · {Number(gasEmpty)} empty
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {gasOk ? "Spare full OK" : "Low — refill spare cylinder"}
          </p>
        </Link>
        <Link
          href="/erp/inventory"
          className={`block rounded-xl border bg-card p-4 hover:border-accent/40 ${
            stockOk ? "" : "border-amber-400/50"
          }`}
        >
          <p className="text-xs text-muted-foreground">Grocery stock</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {stockOk ? "OK" : `${lowStock.length} low`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Meat · veg · dairy · dry goods
          </p>
        </Link>
        <Link
          href="/erp/kitchen/food-cost"
          className={`block rounded-xl border bg-card p-4 hover:border-accent/40 ${
            foodCostOk ? "" : "border-amber-400/50"
          }`}
        >
          <p className="text-xs text-muted-foreground">Food cost MTD</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{foodCost.foodCostPct}%</p>
          <p className="mt-1 text-xs text-muted-foreground">
            COGS {formatBtn(foodCost.cogsBtn)} / sales {formatBtn(foodCost.fnbSalesBtn)}
          </p>
        </Link>
        <Card className="gap-2 py-4">
          <CardContent>
            <p className="text-xs text-muted-foreground">Upcoming events</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {kitchenEvents.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {kitchenEvents.reduce((s, e) => s + e.covers, 0)} pax · banquets
              &amp; groups
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grocery · meat · veg</CardTitle>
            <CardDescription>
              {lowStock.length > 0 ? (
                <span className="text-destructive">{lowStock.length} SKU(s) at/below reorder</span>
              ) : (
                "Stock levels OK"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {filterCategories.map((cat) => (
                <Badge key={cat} variant="outline" className="capitalize">
                  {cat}
                </Badge>
              ))}
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 border-b bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Cat</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stockRows.map((row) => (
                    <tr key={row.id as string}>
                      <td className="px-3 py-2 font-medium">{row.name as string}</td>
                      <td className="px-3 py-2 capitalize text-muted-foreground">
                        {row.category as string}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          Number(row.qty_on_hand) <= Number(row.reorder_level)
                            ? "text-destructive font-medium"
                            : ""
                        }`}
                      >
                        {Number(row.qty_on_hand)} {row.unit as string}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {expiryRows.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-accent uppercase">
                  Expiring soon
                </p>
                <ul className="space-y-1 text-sm">
                  {expiryRows.map((row, i) => (
                    <li key={`${row.name}-${i}`} className="flex justify-between">
                      <span>
                        {row.name}{" "}
                        <span className="text-muted-foreground">({row.category})</span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">{row.expiresOn}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Events &amp; groups</CardTitle>
              <CardDescription>
                Banquets and extra covers — menu, time, pax, venue, and package
                bill (link / post to folio)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <KitchenEventsPanel
                defaultDate={today}
                events={kitchenEvents}
                folios={folioOptions}
              />
            </CardContent>
          </Card>

          {(servicesRes.data ?? []).length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Meeting / spa requests</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y text-sm">
                  {(servicesRes.data ?? []).map((sr) => (
                    <li key={sr.id as string} className="py-2">
                      <p className="font-medium capitalize">{sr.kind as string}</p>
                      <p className="text-xs text-muted-foreground">
                        {sr.contact_name as string} · {sr.preferred_on as string} · party{" "}
                        {sr.party_size as number}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </DeskListShell>
  );
}
