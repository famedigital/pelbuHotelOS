import type { HotelOsSupabase } from "@hotel-os/db";

export type SeasonKind = "peak" | "lean" | "off";

export type RateTier =
  | "public"
  | "friends"
  | "family"
  | "mutual_friends"
  | "agents"
  | "mou_agents";

const RATE_TIERS: ReadonlySet<string> = new Set([
  "public",
  "friends",
  "family",
  "mutual_friends",
  "agents",
  "mou_agents",
]);

export function isRateTier(v: string | null | undefined): v is RateTier {
  return Boolean(v && RATE_TIERS.has(v));
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  const nights = Math.round((b - a) / 86_400_000);
  return Math.max(1, nights);
}

export function roundBtn(n: number): number {
  return Math.round(n * 100) / 100;
}

export function pickRoomRateAmount(
  row: {
    amount_btn?: number | null;
    amount_single_btn?: number | null;
  } | null,
  args: { occupancy?: "single" | "double"; adults?: number },
): number | null {
  if (!row) return null;
  if (row.amount_btn == null && row.amount_single_btn == null) return null;

  const wantSingle =
    args.occupancy === "single" ||
    (args.occupancy !== "double" &&
      args.adults != null &&
      Number(args.adults) === 1);

  if (wantSingle) {
    const single = row.amount_single_btn;
    if (single != null && Number.isFinite(Number(single))) {
      return Number(single);
    }
  }

  if (row.amount_btn == null) return null;
  return Number(row.amount_btn);
}

export async function resolveSeasonKind(
  admin: HotelOsSupabase,
  propertyId: string,
  onDate: string,
): Promise<SeasonKind> {
  const { data, error } = await admin
    .from("seasons")
    .select("kind")
    .eq("property_id", propertyId)
    .lte("starts_on", onDate)
    .gte("ends_on", onDate)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[resolveSeasonKind]", { propertyId, onDate, error });
  }
  const kind = data?.kind as SeasonKind | undefined;
  if (kind === "peak" || kind === "lean" || kind === "off") return kind;
  return "lean";
}

export async function lookupRoomRateBtn(
  admin: HotelOsSupabase,
  args: {
    propertyId: string;
    roomTypeId: string;
    seasonKind: SeasonKind;
    rateTier: RateTier;
    occupancy?: "single" | "double";
    adults?: number;
  },
): Promise<number | null> {
  const { data, error } = await admin
    .from("room_rates")
    .select("room_type_id, amount_btn, amount_single_btn")
    .eq("property_id", args.propertyId)
    .eq("season_kind", args.seasonKind)
    .eq("rate_tier", args.rateTier)
    .eq("label", "Standard")
    .is("agent_id", null)
    .is("guest_label", null)
    .eq("active", true)
    .eq("room_type_id", args.roomTypeId)
    .maybeSingle();
  if (error) {
    console.error("[lookupRoomRateBtn]", { args, error });
    // Soft: missing rates table/columns → null BAR, not 500
    return null;
  }
  return pickRoomRateAmount(data, {
    occupancy: args.occupancy,
    adults: args.adults,
  });
}

export async function listSellableRoomTypes(
  admin: HotelOsSupabase,
  propertyId: string,
) {
  let q = await admin
    .from("room_types")
    .select("id, code, name, inventory_kind, unit_count")
    .eq("property_id", propertyId)
    .eq("inventory_kind", "sellable_guest")
    .order("name");
  if (q.error) {
    // Older schemas may lack inventory_kind — fall back to all types
    q = await admin
      .from("room_types")
      .select("id, code, name, inventory_kind, unit_count")
      .eq("property_id", propertyId)
      .order("name");
    if (q.error) throw q.error;
  }
  return (q.data ?? []).map((r) => ({
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    inventoryKind: (r.inventory_kind as string) || "sellable_guest",
    unitCount: Number(r.unit_count || 0),
  }));
}

export type PropertyStayQuote = {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  seasonKind: SeasonKind;
  availableRooms: number;
  nightlyFromBtn: number | null;
  stayFromBtn: number | null;
  roomTypeQuotes: Array<{
    roomTypeId: string;
    name: string;
    code: string;
    nightlyBtn: number | null;
    stayTotalBtn: number | null;
  }>;
};

/** Date-scoped availability + BAR from room_rates (public tier). */
export async function quotePropertyStay(
  admin: HotelOsSupabase,
  args: {
    propertyId: string;
    checkIn: string;
    checkOut: string;
    rooms?: number;
    adults?: number;
  },
): Promise<PropertyStayQuote> {
  const nights = nightsBetween(args.checkIn, args.checkOut);
  const seasonKind = await resolveSeasonKind(
    admin,
    args.propertyId,
    args.checkIn,
  );

  // room_units has no is_active column; OOO rooms are excluded via hk_status.
  const { data: unitRows, error: uErr } = await admin
    .from("room_units")
    .select("id, room_type_id, hk_status")
    .eq("property_id", args.propertyId)
    .neq("hk_status", "ooo");
  if (uErr) throw uErr;
  const units: Array<{ id: unknown; room_type_id: unknown }> = unitRows ?? [];

  const { data: assignments, error: aErr } = await admin
    .from("room_assignments")
    .select("room_unit_id, from_date, to_date")
    .eq("property_id", args.propertyId)
    .lt("from_date", args.checkOut)
    .gt("to_date", args.checkIn);
  if (aErr) {
    console.error("[quotePropertyStay] assignments", aErr);
    throw new Error(aErr.message ?? "Could not load room assignments");
  }

  const blocked = new Set(
    (assignments ?? []).map((r) => r.room_unit_id as string),
  );
  return finishQuote(admin, args, seasonKind, nights, units ?? [], blocked);
}

async function finishQuote(
  admin: HotelOsSupabase,
  args: {
    propertyId: string;
    checkIn: string;
    checkOut: string;
    rooms?: number;
    adults?: number;
  },
  seasonKind: SeasonKind,
  nights: number,
  units: Array<{ id: unknown; room_type_id: unknown }>,
  blocked: Set<string>,
): Promise<PropertyStayQuote> {
  const availableUnits = units.filter((u) => !blocked.has(String(u.id)));
  const types = await listSellableRoomTypes(admin, args.propertyId);
  const roomTypeQuotes = [];
  let nightlyFrom: number | null = null;

  for (const t of types) {
    const nightly = await lookupRoomRateBtn(admin, {
      propertyId: args.propertyId,
      roomTypeId: t.id,
      seasonKind,
      rateTier: "public",
      adults: args.adults ?? 2,
    });
    const stayTotal =
      nightly == null ? null : roundBtn(nightly * nights * (args.rooms ?? 1));
    if (nightly != null && (nightlyFrom == null || nightly < nightlyFrom)) {
      nightlyFrom = nightly;
    }
    roomTypeQuotes.push({
      roomTypeId: t.id,
      name: t.name,
      code: t.code,
      nightlyBtn: nightly,
      stayTotalBtn: stayTotal,
    });
  }

  return {
    propertyId: args.propertyId,
    checkIn: args.checkIn,
    checkOut: args.checkOut,
    nights,
    seasonKind,
    availableRooms: availableUnits.length,
    nightlyFromBtn: nightlyFrom,
    stayFromBtn:
      nightlyFrom == null
        ? null
        : roundBtn(nightlyFrom * nights * (args.rooms ?? 1)),
    roomTypeQuotes,
  };
}
