import type { FastifyInstance } from "fastify";
import { createServiceClient } from "@hotel-os/db";
import { requireDeskJwt } from "./auth.js";

type Hk = "clean" | "dirty" | "inspected" | "maintenance";

function mapHk(raw: string | null | undefined): Hk {
  const v = String(raw || "clean").toLowerCase();
  if (v === "dirty") return "dirty";
  if (v === "inspect" || v === "inspected") return "inspected";
  if (v === "ooo" || v === "maintenance") return "maintenance";
  return "clean";
}

function mapStayStatus(raw: string | null | undefined) {
  const v = String(raw || "").toLowerCase();
  if (v === "checked_in" || v === "in_house") return "in_house" as const;
  if (v === "checked_out") return "checked_out" as const;
  if (v === "cancelled") return "cancelled" as const;
  if (v === "no_show") return "no_show" as const;
  if (v === "held") return "held" as const;
  return "confirmed" as const;
}

export async function buildDeskSnapshot(propertyId: string) {
  const admin = createServiceClient();
  const { data: property, error: pErr } = await admin
    .from("properties")
    .select("id, name, slug")
    .eq("id", propertyId)
    .single();
  if (pErr || !property) throw pErr || new Error("property missing");

  const { data: rooms } = await admin
    .from("room_units")
    .select("id, label, floor_label, hk_status, room_types(name)")
    .eq("property_id", propertyId)
    .order("label");

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Thimphu",
  });
  const windowStart = new Date(`${today}T00:00:00Z`);
  windowStart.setUTCDate(windowStart.getUTCDate() - 2);
  const windowEnd = new Date(`${today}T00:00:00Z`);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 14);
  const from = windowStart.toISOString().slice(0, 10);
  const to = windowEnd.toISOString().slice(0, 10);

  const { data: bookings, error: bookingsErr } = await admin
    .from("bookings")
    .select(
      `id, confirmation_code, contact_name, contact_phone, status, check_in, check_out,
       meal_plan_code, adults, children, quoted_total_btn, agent_id,
       agents(company_name),
       room_assignments(room_unit_id, room_units(id, label)),
       folios(id, folio_lines(id, source_type, description, qty, unit_price_btn, total_btn, created_at, status, reverses_line_id))`,
    )
    .eq("property_id", propertyId)
    .neq("status", "cancelled")
    .lte("check_in", to)
    .gte("check_out", from)
    .order("check_in")
    .limit(400);
  if (bookingsErr) {
    // Never hand the desk an empty board on a query error — it looks like "no guests".
    throw new Error(`Desk snapshot failed: ${bookingsErr.message}`);
  }

  const roomRows = (rooms ?? []).map((r) => {
    const rt = r.room_types as { name?: string } | { name?: string }[] | null;
    const cat = Array.isArray(rt) ? rt[0]?.name : rt?.name;
    const floorNum = Number(String(r.floor_label || "1").replace(/\D/g, "")) || 1;
    return {
      id: r.id as string,
      roomNumber: String(r.label),
      floor: floorNum,
      category: cat || "Room",
      status: mapHk(r.hk_status as string),
      occupiedStayId: null as string | null,
    };
  });

  const stays = (bookings ?? []).map((b) => {
    const assigns = (b.room_assignments as unknown as Array<{
      room_unit_id: string;
      room_units?:
        | { id: string; label: string }
        | { id: string; label: string }[]
        | null;
    }>) ?? [];
    const first = assigns[0];
    const ru = first?.room_units;
    const roomUnit = Array.isArray(ru) ? ru[0] : ru;
    const roomId = first?.room_unit_id ?? roomUnit?.id ?? null;
    const roomNumber = roomUnit?.label ? String(roomUnit.label) : undefined;
    if (roomId) {
      const room = roomRows.find((r) => r.id === roomId);
      if (room && ["checked_in", "in_house"].includes(String(b.status))) {
        room.occupiedStayId = b.id as string;
      }
    }

    type SnapLine = {
      id: string;
      source_type: string;
      description: string;
      qty: number;
      unit_price_btn: number;
      total_btn: number;
      created_at: string;
      status: string;
      reverses_line_id: string | null;
    };
    const folios = (b.folios as Array<{ folio_lines?: SnapLine[] }>) ?? [];
    const allLines = folios.flatMap((f) => f.folio_lines ?? []);
    // Same rule as Innora lib/folio/balance.ts: posted lines only, and drop
    // reversal rows of voided originals. Payments are negative credit lines.
    const voided = new Set(allLines.filter((l) => l.status === "voided").map((l) => l.id));
    const visible = allLines.filter(
      (l) => l.status === "posted" && !(l.reverses_line_id && voided.has(l.reverses_line_id)),
    );
    const isPayment = (l: SnapLine) =>
      l.source_type === "payment" || l.source_type === "deposit";
    const lines = visible.filter((l) => !isPayment(l));
    const paid = visible
      .filter(isPayment)
      .reduce((a, l) => a + Math.abs(Number(l.total_btn || 0)), 0);
    const balance = Math.round(visible.reduce((a, l) => a + Number(l.total_btn || 0), 0) * 100) / 100;
    const billed = Math.round((balance + paid) * 100) / 100;
    const agent = b.agents as { company_name?: string } | null;

    return {
      id: b.id as string,
      bookingRef: String(b.confirmation_code),
      guestName: String(b.contact_name || "Guest"),
      guestPhone: (b.contact_phone as string) || undefined,
      roomId,
      roomNumber,
      status: mapStayStatus(b.status as string),
      arrivalDate: String(b.check_in),
      departureDate: String(b.check_out),
      mealPlan: (b.meal_plan_code as "EP" | "CP" | "MAP" | "AP" | "BB") || "EP",
      paxAdults: Number(b.adults ?? 1),
      paxChildren: Number(b.children ?? 0),
      agencyName: agent?.company_name ?? null,
      agencyId: (b.agent_id as string) || null,
      folioCharges: lines.map((l) => ({
        id: l.id,
        stayId: b.id as string,
        description: l.description,
        category: "extra" as const,
        quantity: Number(l.qty || 1),
        rateBtn: Number(l.unit_price_btn || 0),
        serviceChargeBtn: 0,
        bstTaxBtn: 0,
        totalBtn: Number(l.total_btn || 0),
        postedAt: l.created_at,
        postedByStaffId: "system",
      })),
      totalBilledBtn: billed,
      totalPaidBtn: Math.round(paid * 100) / 100,
      balanceDueBtn: balance,
    };
  });

  const { data: shift } = await admin
    .from("cash_till_shifts")
    .select("*")
    .eq("property_id", propertyId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: expenses } = await admin
    .from("property_expenses")
    .select("*")
    .eq("property_id", propertyId)
    .order("recorded_at", { ascending: false })
    .limit(100);

  return {
    propertyId: property.id,
    propertyName: property.name,
    syncedAt: new Date().toISOString(),
    rooms: roomRows,
    stays,
    cashTill: {
      openingBalanceBtn: Number(shift?.opening_balance_btn ?? 0),
      collectedCashBtn: Number(shift?.collected_cash_btn ?? 0),
      pettyCashOutflowBtn: Number(shift?.petty_cash_outflow_btn ?? 0),
      activeShiftStaffName: String(shift?.opened_by_name ?? ""),
      shiftStartedAt: String(shift?.opened_at ?? new Date().toISOString()),
      shiftId: (shift?.id as string) || null,
    },
    expenses: (expenses ?? []).map((e) => ({
      id: e.id as string,
      category: e.category,
      description: String(e.description),
      amountBtn: Number(e.amount_btn),
      paidVia: e.paid_via,
      supplierName: (e.supplier_name as string) || undefined,
      recordedByStaffId: String(e.recorded_by_staff_id || ""),
      timestamp: String(e.recorded_at),
      idempotencyKey: (e.idempotency_key as string) || undefined,
    })),
  };
}

export async function registerSnapshotRoutes(app: FastifyInstance) {
  app.get("/v1/desk/snapshot", async (req) => {
    const jwt = await requireDeskJwt(req);
    const propertyId =
      (req.query as { propertyId?: string }).propertyId || jwt.propertyId;
    if (propertyId !== jwt.propertyId) {
      throw new Error("property_id mismatch with session");
    }
    return buildDeskSnapshot(propertyId);
  });
}
