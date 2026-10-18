import {
  lookupRoomRatesBatch,
  resolveSeasonKind,
  type RateTier,
} from "@/lib/rates";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type AskRoomTypeAnswer = {
  roomTypeId: string;
  code: string;
  name: string;
  capacity: number;
  /** Sellable left after confirmed + checked-in + live holds. */
  free: number;
  /** Live holds only. */
  held: number;
  /** Checked-in overlapping. */
  inHouse: number;
  /** Confirmed (not yet in) overlapping. */
  confirmed: number;
  /** Sheet nightly Nu for the selected tier (null if missing). */
  rateBtn: number | null;
};

export type AskAvailabilityAnswer = {
  checkIn: string;
  checkOut: string;
  nights: number;
  roomsRequested: number;
  rateTier: RateTier;
  seasonKind: string;
  types: AskRoomTypeAnswer[];
  /** True when any type has free >= roomsRequested. */
  yes: boolean;
  totalFree: number;
};

type QtyMap = Map<string, number>;

function addQty(map: QtyMap, roomTypeId: string, qty: number) {
  map.set(roomTypeId, (map.get(roomTypeId) ?? 0) + qty);
}

async function qtyByStatus(
  admin: Admin,
  propertyId: string,
  checkIn: string,
  checkOut: string,
  status: "confirmed" | "checked_in" | "held",
): Promise<QtyMap> {
  const nowIso = new Date().toISOString();
  let q = admin
    .from("bookings")
    .select("id, booking_rooms(qty, room_type_id)")
    .eq("property_id", propertyId)
    .eq("status", status)
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);

  if (status === "held") {
    q = q.gt("hold_expires_at", nowIso);
  }

  const { data } = await q;
  const map: QtyMap = new Map();
  for (const booking of data ?? []) {
    for (const line of (booking.booking_rooms ?? []) as {
      qty: number;
      room_type_id: string;
    }[]) {
      addQty(map, line.room_type_id, Number(line.qty));
    }
  }
  return map;
}

/** Free / held / in + sheet rate for FO Ask (≤5s phone answer). */
export async function answerAvailability(
  admin: Admin,
  args: {
    propertyId: string;
    checkIn: string;
    checkOut: string;
    roomsRequested: number;
    rateTier: RateTier;
  },
): Promise<AskAvailabilityAnswer> {
  const { propertyId, checkIn, checkOut, roomsRequested, rateTier } = args;
  const nights = Math.max(
    1,
    Math.round(
      (Date.parse(`${checkOut}T00:00:00Z`) -
        Date.parse(`${checkIn}T00:00:00Z`)) /
        86_400_000,
    ),
  );

  const [{ data: types }, confirmed, held, inHouse, seasonKind] =
    await Promise.all([
      admin
        .from("room_types")
        .select("id, code, name, unit_count")
        .eq("property_id", propertyId)
        .eq("inventory_kind", "sellable_guest")
        .order("code"),
      qtyByStatus(admin, propertyId, checkIn, checkOut, "confirmed"),
      qtyByStatus(admin, propertyId, checkIn, checkOut, "held"),
      qtyByStatus(admin, propertyId, checkIn, checkOut, "checked_in"),
      resolveSeasonKind(admin, propertyId, checkIn),
    ]);

  const roomTypeIds = (types ?? []).map((t) => t.id as string);
  const rates = await lookupRoomRatesBatch(admin, {
    propertyId,
    roomTypeIds,
    seasonKind,
    rateTier,
  });

  const answers: AskRoomTypeAnswer[] = (types ?? []).map((t) => {
    const id = t.id as string;
    const capacity = Number(t.unit_count ?? 0);
    const c = confirmed.get(id) ?? 0;
    const h = held.get(id) ?? 0;
    const i = inHouse.get(id) ?? 0;
    const free = Math.max(capacity - c - h - i, 0);
    return {
      roomTypeId: id,
      code: t.code as string,
      name: (t.name as string) || (t.code as string),
      capacity,
      free,
      held: h,
      inHouse: i,
      confirmed: c,
      rateBtn: rates.get(id) ?? null,
    };
  });

  const totalFree = answers.reduce((s, a) => s + a.free, 0);
  const yes = answers.some((a) => a.free >= roomsRequested);

  return {
    checkIn,
    checkOut,
    nights,
    roomsRequested,
    rateTier,
    seasonKind,
    types: answers,
    yes,
    totalFree,
  };
}
