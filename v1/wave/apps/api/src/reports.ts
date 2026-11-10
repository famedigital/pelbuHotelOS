import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { createServiceClient } from "@hotel-os/db";
import { requireDeskJwt } from "./auth.js";

const CATALOG = [
  { id: "rep-01", number: 1, binder: "operations", title: "Arrival & Departure Manifest" },
  { id: "rep-02", number: 2, binder: "operations", title: "RBP & DOT Immigration Report" },
  { id: "rep-03", number: 3, binder: "operations", title: "Housekeeping Discrepancy Sheet" },
  { id: "rep-04", number: 4, binder: "operations", title: "Shift Cashier Reconciliation Slip" },
  { id: "rep-05", number: 5, binder: "revenue", title: "Daily Night Audit Revenue Ledger" },
  { id: "rep-06", number: 6, binder: "revenue", title: "POS Itemized Sales Velocity" },
  { id: "rep-07", number: 7, binder: "revenue", title: "Kitchen Meal Plan Forecast" },
  { id: "rep-08", number: 8, binder: "revenue", title: "Monthly RevPAR & Occupancy Matrix" },
  { id: "rep-09", number: 9, binder: "revenue", title: "Official DRC Form BST-3" },
  { id: "rep-10", number: 10, binder: "purchases", title: "Daily Petty Cash Outflow" },
  { id: "rep-11", number: 11, binder: "purchases", title: "Category-Wise Expense Distribution" },
  { id: "rep-12", number: 12, binder: "purchases", title: "Supplier Accounts Payable Ledger" },
  { id: "rep-13", number: 13, binder: "purchases", title: "F&B Food Cost Percentage Audit" },
  { id: "rep-14", number: 14, binder: "b2b", title: "Tour Operator Credit Aging Analysis" },
  { id: "rep-15", number: 15, binder: "b2b", title: "Group Master Folio Statement" },
  { id: "rep-16", number: 16, binder: "b2b", title: "Guide & Driver Hospitality Log" },
] as const;

function hashPayload(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);
}

/** Last calendar day of month "YYYY-MM" in en-CA form. */
function lastDayOfCalendarMonth(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  if (!y || !m) return `${ym}-28`;
  const last = new Date(Date.UTC(y, m, 0));
  const d = String(last.getUTCDate()).padStart(2, "0");
  return `${ym}-${d}`;
}

export async function registerReportRoutes(app: FastifyInstance) {
  app.get("/v1/reports/catalog", async (req) => {
    await requireDeskJwt(req);
    return { reports: CATALOG };
  });

  app.get("/v1/reports/:id", async (req, reply) => {
    const jwt = await requireDeskJwt(req);
    const id = (req.params as { id: string }).id;
    const meta = CATALOG.find((r) => r.id === id);
    if (!meta) return reply.code(404).send({ error: "Unknown report" });

    const admin = createServiceClient();
    const asOf =
      (req.query as { date?: string }).date ||
      new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" });

    const { data: property } = await admin
      .from("properties")
      .select("id, name, legal_name, tax_id, hotel_code, address, gst_enabled")
      .eq("id", jwt.propertyId)
      .single();

    let rows: Record<string, unknown>[] = [];

    if (id === "rep-01") {
      const { data } = await admin
        .from("bookings")
        .select(
          "confirmation_code, contact_name, check_in, check_out, status, meal_plan_code, adults, room_assignments(room_units(label))",
        )
        .eq("property_id", jwt.propertyId)
        .or(`check_in.eq.${asOf},check_out.eq.${asOf}`)
        .neq("status", "cancelled");
      rows = (data ?? []).map((b) => ({
        conf: b.confirmation_code,
        guest: b.contact_name,
        checkIn: b.check_in,
        checkOut: b.check_out,
        status: b.status,
        meal: b.meal_plan_code,
        pax: b.adults,
      }));
    } else if (id === "rep-02") {
      const { data: borderBookings } = await admin
        .from("bookings")
        .select("id, confirmation_code, check_in, check_out, status")
        .eq("property_id", jwt.propertyId)
        .neq("status", "cancelled")
        .or(`check_in.eq.${asOf},check_out.eq.${asOf}`);
      const ids = (borderBookings ?? []).map((b) => b.id);
      if (ids.length === 0) {
        rows = [];
      } else {
        const { data: guests } = await admin
          .from("booking_guests")
          .select(
            "booking_id, full_name, nationality, passport_or_cid, sdf_ref",
          )
          .in("booking_id", ids);
        const byId = new Map((borderBookings ?? []).map((b) => [b.id, b]));
        rows = (guests ?? []).map((g) => {
          const b = byId.get(g.booking_id as string);
          return {
            booking: b?.confirmation_code,
            guest: g.full_name,
            nationality: g.nationality,
            passportOrCid: g.passport_or_cid,
            sdfRef: g.sdf_ref,
            stayFrom: b?.check_in,
            stayTo: b?.check_out,
          };
        });
      }
    } else if (id === "rep-04") {
      const dayStart = `${asOf}T00:00:00`;
      const dayEnd = `${asOf}T23:59:59.999Z`;
      const { data: shift } = await admin
        .from("cash_till_shifts")
        .select("*")
        .eq("property_id", jwt.propertyId)
        .gte("opened_at", dayStart)
        .lte("opened_at", dayEnd)
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (shift) {
        const opening = Number(shift.opening_balance_btn ?? 0);
        const collected = Number(shift.collected_cash_btn ?? 0);
        const petty = Number(shift.petty_cash_outflow_btn ?? 0);
        rows = [
          { line: "Opening till (BTN)", amount: opening },
          { line: "Cash collected (BTN)", amount: collected },
          { line: "Petty cash out (BTN)", amount: petty },
          {
            line: "Expected closing (BTN)",
            amount: opening + collected - petty,
          },
        ];
      } else {
        rows = [
          {
            note: "No cash_till_shifts opened on this calendar day — open a till or pick another date.",
            asOf,
          },
        ];
      }
    } else if (id === "rep-05") {
      const { data } = await admin
        .from("night_audits")
        .select(
          "business_date, rooms_occupied, rooms_comp, folio_charges_btn, folio_payments_btn, open_folios",
        )
        .eq("property_id", jwt.propertyId)
        .eq("business_date", asOf)
        .maybeSingle();
      if (data) {
        rows = [
          { metric: "Rooms occupied", value: data.rooms_occupied },
          { metric: "Comp rooms", value: data.rooms_comp },
          {
            metric: "Folio charges (BTN)",
            value: Number(data.folio_charges_btn ?? 0),
          },
          {
            metric: "Folio payments (BTN)",
            value: Number(data.folio_payments_btn ?? 0),
          },
          { metric: "Open folios", value: data.open_folios },
        ];
      } else {
        rows = [
          {
            note: "No night_audits row for this business_date — run night audit first.",
            asOf,
          },
        ];
      }
    } else if (id === "rep-06") {
      const { data } = await admin
        .from("order_items")
        .select(
          "name_snapshot, qty, unit_price_btn, orders!inner(property_id, created_at, kot_status)",
        )
        .eq("orders.property_id", jwt.propertyId)
        .gte("orders.created_at", `${asOf}T00:00:00`)
        .lte("orders.created_at", `${asOf}T23:59:59.999Z`);
      const byName = new Map<
        string,
        { qty: number; revenue: number; orders: number }
      >();
      for (const line of data ?? []) {
        const name = String(line.name_snapshot || "Item");
        const qty = Number(line.qty ?? 0);
        const unit = Number(line.unit_price_btn ?? 0);
        const prev = byName.get(name) ?? { qty: 0, revenue: 0, orders: 0 };
        prev.qty += qty;
        prev.revenue += qty * unit;
        prev.orders += 1;
        byName.set(name, prev);
      }
      rows = Array.from(byName.entries()).map(([name, v]) => ({
        item: name,
        qtySold: v.qty,
        revenueBtn: Math.round(v.revenue * 100) / 100,
        lines: v.orders,
      }));
    } else if (id === "rep-07") {
      const { data } = await admin
        .from("booking_night_meals")
        .select("meal_plan_code")
        .eq("property_id", jwt.propertyId)
        .eq("night_date", asOf);
      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        const code = String(row.meal_plan_code || "unknown");
        counts.set(code, (counts.get(code) ?? 0) + 1);
      }
      rows = Array.from(counts.entries()).map(([mealPlan, roomNights]) => ({
        mealPlan,
        roomNights,
      }));
    } else if (id === "rep-08") {
      const month = asOf.slice(0, 7);
      const monthStart = `${month}-01`;
      const lastDay = lastDayOfCalendarMonth(month);
      const daysInMonth = Number(lastDay.slice(8, 10));

      const { count: unitCount } = await admin
        .from("room_units")
        .select("id", { count: "exact", head: true })
        .eq("property_id", jwt.propertyId);

      const { data: nightRows } = await admin
        .from("booking_night_meals")
        .select("id")
        .eq("property_id", jwt.propertyId)
        .gte("night_date", monthStart)
        .lte("night_date", lastDay);

      const roomNightsSold = nightRows?.length ?? 0;
      const inventoryRooms = unitCount ?? 0;
      const occPct =
        inventoryRooms > 0 && daysInMonth > 0
          ? (roomNightsSold / (inventoryRooms * daysInMonth)) * 100
          : 0;

      const { data: folioMonth } = await admin
        .from("folio_lines")
        .select("total_btn, folios!inner(property_id)")
        .eq("folios.property_id", jwt.propertyId)
        .eq("status", "posted")
        .eq("source_type", "room")
        .gte("created_at", `${monthStart}T00:00:00`)
        .lt("created_at", `${lastDay}T23:59:59.999Z`);

      const roomRevenue = (folioMonth ?? []).reduce(
        (a, r) => a + Number(r.total_btn || 0),
        0,
      );
      const adr =
        roomNightsSold > 0 ? roomRevenue / roomNightsSold : 0;
      const revpar =
        inventoryRooms > 0 && daysInMonth > 0
          ? roomRevenue / (inventoryRooms * daysInMonth)
          : 0;

      rows = [
        { metric: "Month", value: month },
        { metric: "Room nights sold", value: roomNightsSold },
        { metric: "Sellable room units", value: inventoryRooms },
        { metric: "Occupancy % (rough)", value: Math.round(occPct * 100) / 100 },
        { metric: "Room revenue (BTN)", value: Math.round(roomRevenue * 100) / 100 },
        { metric: "ADR (BTN)", value: Math.round(adr * 100) / 100 },
        { metric: "RevPAR (BTN)", value: Math.round(revpar * 100) / 100 },
      ];
    } else if (id === "rep-09") {
      const month = asOf.slice(0, 7);
      const { data } = await admin
        .from("folio_lines")
        .select("total_btn, gst_btn, service_charge_btn, created_at, folios!inner(property_id)")
        .eq("folios.property_id", jwt.propertyId)
        .eq("status", "posted")
        .gte("created_at", `${month}-01`)
        .lt("created_at", `${month}-32`);
      const sc = (data ?? []).reduce(
        (a, r) => a + Number(r.service_charge_btn || 0),
        0,
      );
      const bst = (data ?? []).reduce((a, r) => a + Number(r.gst_btn || 0), 0);
      const gross = (data ?? []).reduce(
        (a, r) => a + Number(r.total_btn || 0),
        0,
      );
      rows = [
        { line: "Taxable supplies (gross)", amount: gross },
        { line: "10% Service Charge", amount: sc },
        { line: "10% Bhutan Sales Tax (BST)", amount: bst },
      ];
    } else if (id === "rep-10") {
      const { data } = await admin
        .from("property_expenses")
        .select("description, amount_btn, supplier_name, recorded_at, paid_via")
        .eq("property_id", jwt.propertyId)
        .eq("paid_via", "front_till")
        .gte("recorded_at", `${asOf}T00:00:00`)
        .lte("recorded_at", `${asOf}T23:59:59`);
      rows = data ?? [];
    } else if (id === "rep-11") {
      const month = asOf.slice(0, 7);
      const monthEnd = lastDayOfCalendarMonth(month);
      const { data } = await admin
        .from("property_expenses")
        .select("category, amount_btn")
        .eq("property_id", jwt.propertyId)
        .gte("recorded_at", `${month}-01T00:00:00`)
        .lte("recorded_at", `${monthEnd}T23:59:59.999Z`);
      const byCat = new Map<string, number>();
      for (const row of data ?? []) {
        const cat = String(row.category || "uncategorized");
        byCat.set(cat, (byCat.get(cat) ?? 0) + Number(row.amount_btn ?? 0));
      }
      rows = Array.from(byCat.entries()).map(([category, amountBtn]) => ({
        category,
        amountBtn: Math.round(amountBtn * 100) / 100,
      }));
    } else if (id === "rep-12") {
      const { data } = await admin
        .from("property_expenses")
        .select("supplier_name, amount_btn, paid_via, recorded_at")
        .eq("property_id", jwt.propertyId)
        .eq("paid_via", "credit_unpaid")
        .order("recorded_at", { ascending: false })
        .limit(500);
      rows = (data ?? []).map((e) => ({
        supplier: e.supplier_name,
        amountBtn: e.amount_btn,
        recordedAt: e.recorded_at,
      }));
    } else if (id === "rep-13") {
      const month = asOf.slice(0, 7);
      const monthStart = `${month}-01`;
      const monthEnd = lastDayOfCalendarMonth(month);
      const { data: purchases } = await admin
        .from("inventory_purchase_order_lines")
        .select("line_total_btn, purchase_orders!inner(property_id, status, created_at)")
        .eq("purchase_orders.property_id", jwt.propertyId)
        .gte("purchase_orders.created_at", `${monthStart}T00:00:00`)
        .lte("purchase_orders.created_at", `${monthEnd}T23:59:59.999Z`);

      const { data: fbOrders } = await admin
        .from("orders")
        .select("total_btn, created_at, outlet")
        .eq("property_id", jwt.propertyId)
        .gte("created_at", `${monthStart}T00:00:00`)
        .lte("created_at", `${monthEnd}T23:59:59.999Z`)
        .in("outlet", ["restaurant", "bar", "cafe", "pastry"]);

      const foodPurchases = (purchases ?? []).reduce(
        (a, l) => a + Number(l.line_total_btn ?? 0),
        0,
      );
      const fbRev = (fbOrders ?? []).reduce(
        (a, o) => a + Number(o.total_btn ?? 0),
        0,
      );
      const costPct = fbRev > 0 ? (foodPurchases / fbRev) * 100 : 0;
      rows = [
        {
          line: "Inventory PO line spend (month, BTN)",
          amount: Math.round(foodPurchases * 100) / 100,
        },
        {
          line: "F&B outlet orders revenue (month, BTN)",
          amount: Math.round(fbRev * 100) / 100,
        },
        {
          line: "Food cost % (PO÷F&B revenue)",
          amount: Math.round(costPct * 100) / 100,
        },
      ];
    } else if (id === "rep-15") {
      const { data } = await admin
        .from("folios")
        .select("id, label, status, booking_id")
        .eq("property_id", jwt.propertyId)
        .eq("folio_type", "master")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(100);
      rows = data ?? [];
    } else if (id === "rep-16") {
      const { data } = await admin
        .from("booking_rooms")
        .select(
          "inventory_kind, booking_id, bookings!inner(property_id, confirmation_code, check_in, check_out, status)",
        )
        .eq("bookings.property_id", jwt.propertyId)
        .in("inventory_kind", ["guide_comp", "driver_comp"])
        .limit(500);
      rows = (data ?? [])
        .filter((br) => {
          const b = br.bookings as { status?: string } | null;
          return b?.status !== "cancelled";
        })
        .filter((br) => {
          const b = br.bookings as { check_in?: string; check_out?: string };
          const cin = b.check_in ?? "";
          const cout = b.check_out ?? "";
          return cin <= asOf && cout >= asOf;
        })
        .map((br) => {
          const b = br.bookings as {
            confirmation_code?: string;
            check_in?: string;
            check_out?: string;
          };
          return {
            booking: b.confirmation_code,
            kind: br.inventory_kind,
            checkIn: b.check_in,
            checkOut: b.check_out,
          };
        });
    } else if (id === "rep-03") {
      const { data } = await admin
        .from("room_units")
        .select("label, hk_status")
        .eq("property_id", jwt.propertyId)
        .order("label");
      rows = data ?? [];
    } else if (id === "rep-14") {
      const { data } = await admin
        .from("agent_property_links")
        .select(
          "credit_limit, credit_used, agents!inner(id, company_name)",
        )
        .eq("property_id", jwt.propertyId);
      rows = (data ?? []).map((row) => {
        const agent = row.agents as { company_name?: string } | null;
        const limit = Number(row.credit_limit ?? 0);
        const used = Number(row.credit_used ?? 0);
        return {
          agent: agent?.company_name,
          creditLimit: limit,
          creditUsed: used,
          availableBtn: Math.max(0, limit - used),
          agingNote:
            "Aging buckets need dated agent_credit_ledger / invoice due paths — not in this report yet.",
        };
      });
    } else {
      rows = [{ note: "Unknown report id in catalog", id, asOf }];
    }

    const payload = {
      meta,
      property: {
        name: property?.name,
        legalName: property?.legal_name ?? null,
        tpn: property?.tax_id ?? null,
        license: property?.hotel_code ?? null,
        address: property?.address ?? null,
      },
      asOf,
      rows,
    };
    return {
      ...payload,
      verificationHash: hashPayload(payload),
      format: id === "rep-04" ? "THERMAL_80MM" : "A4",
    };
  });
}
