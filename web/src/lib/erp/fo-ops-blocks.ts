import type { DayOpsRow } from "@/lib/erp/day-ops-board";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type MealPlanBucket = {
  code: string;
  rooms: number;
  pax: number;
};

export type EmptyRoomBreakdown = {
  sellableTotal: number;
  occupiedToday: number;
  heldToday: number;
  vacant: number;
  ooo: number;
  dirtyVacant: number;
  byType: {
    code: string;
    name: string;
    total: number;
    occupied: number;
    vacant: number;
    ooo: number;
  }[];
};

export function mealPlanBuckets(rows: DayOpsRow[]): MealPlanBucket[] {
  const map = new Map<string, MealPlanBucket>();
  for (const row of rows) {
    const code = (row.meal_plan_code || "EP").toUpperCase();
    const cur = map.get(code) ?? { code, rooms: 0, pax: 0 };
    cur.rooms += Math.max(1, Number(row.rooms) || row.assigned_count || 1);
    cur.pax += Number(row.pax) || 0;
    map.set(code, cur);
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export async function loadEmptyRoomBreakdown(
  admin: Admin,
  propertyId: string,
  businessDate: string,
): Promise<EmptyRoomBreakdown> {
  const date = businessDate.slice(0, 10);
  const [{ data: units }, { data: assigns }, { data: holds }] =
    await Promise.all([
      admin
        .from("room_units")
        .select(
          "id, hk_status, is_active, room_types(code, name, inventory_kind)",
        )
        .eq("property_id", propertyId)
        .eq("is_active", true),
      admin
        .from("room_assignments")
        .select("room_unit_id")
        .eq("property_id", propertyId)
        .lte("from_date", date)
        .gt("to_date", date),
      admin
        .from("bookings")
        .select("id, rooms, status")
        .eq("property_id", propertyId)
        .eq("status", "held")
        .lte("check_in", date)
        .gt("check_out", date),
    ]);

  const occupiedIds = new Set(
    (assigns ?? [])
      .map((a) => a.room_unit_id as string)
      .filter(Boolean),
  );
  const heldRooms = (holds ?? []).reduce(
    (s, b) => s + Math.max(1, Number(b.rooms) || 1),
    0,
  );

  type TypeAgg = {
    code: string;
    name: string;
    total: number;
    occupied: number;
    vacant: number;
    ooo: number;
  };
  const byTypeMap = new Map<string, TypeAgg>();

  let sellableTotal = 0;
  let occupiedToday = 0;
  let ooo = 0;
  let dirtyVacant = 0;

  for (const u of units ?? []) {
    const rt = u.room_types as
      | { code?: string; name?: string; inventory_kind?: string }
      | { code?: string; name?: string; inventory_kind?: string }[]
      | null;
    const type = Array.isArray(rt) ? rt[0] : rt;
    if ((type?.inventory_kind ?? "sellable_guest") !== "sellable_guest") {
      continue;
    }
    const code = type?.code ?? "—";
    const name = type?.name ?? code;
    const agg = byTypeMap.get(code) ?? {
      code,
      name,
      total: 0,
      occupied: 0,
      vacant: 0,
      ooo: 0,
    };
    agg.total += 1;
    sellableTotal += 1;
    const hk = (u.hk_status as string) ?? "clean";
    const occ = occupiedIds.has(u.id as string);
    if (hk === "ooo" || hk === "out_of_order") {
      ooo += 1;
      agg.ooo += 1;
    } else if (occ) {
      occupiedToday += 1;
      agg.occupied += 1;
    } else {
      agg.vacant += 1;
      if (hk === "dirty") dirtyVacant += 1;
    }
    byTypeMap.set(code, agg);
  }

  return {
    sellableTotal,
    occupiedToday,
    heldToday: heldRooms,
    vacant: Math.max(0, sellableTotal - occupiedToday - ooo),
    ooo,
    dirtyVacant,
    byType: [...byTypeMap.values()].sort((a, b) =>
      a.code.localeCompare(b.code),
    ),
  };
}

/** Folio ids that already have an issued INV. */
export async function loadIssuedInvoiceByFolio(
  admin: Admin,
  propertyId: string,
  folioIds: string[],
): Promise<Map<string, { id: string; docNo: string }>> {
  const map = new Map<string, { id: string; docNo: string }>();
  if (folioIds.length === 0) return map;
  const { data } = await admin
    .from("fiscal_documents")
    .select("id, doc_no, folio_id")
    .eq("property_id", propertyId)
    .eq("doc_kind", "invoice")
    .eq("status", "issued")
    .in("folio_id", folioIds);
  for (const d of data ?? []) {
    const fid = d.folio_id as string | null;
    if (fid) {
      map.set(fid, { id: d.id as string, docNo: (d.doc_no as string) ?? "—" });
    }
  }
  return map;
}
