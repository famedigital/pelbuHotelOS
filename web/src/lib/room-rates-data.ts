import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type RoomTypeLite = {
  id: string;
  code: string;
  name: string;
  inventory_kind: string;
};

export type RateMatrixRow = {
  id: string | null;
  room_type_id: string;
  room_type_name: string;
  season_kind: string;
  rate_tier: string;
  amount_btn: number;
};

export type SeasonWindow = {
  id?: string;
  kind: string;
  starts_on: string;
  ends_on: string;
};

export async function loadRoomRatesMatrix(
  admin: Admin,
  propertyId: string,
): Promise<{
  rows: RateMatrixRow[];
  roomTypes: RoomTypeLite[];
  seasons: SeasonWindow[];
}> {
  const [ratesRes, roomTypesRes, seasonsRes] = await Promise.all([
    admin
      .from("room_rates")
      .select(
        "id, season_kind, rate_tier, amount_btn, room_type_id, room_types(id, code, name, inventory_kind)",
      )
      .eq("property_id", propertyId)
      .order("season_kind")
      .order("rate_tier")
      .limit(500),
    admin
      .from("room_types")
      .select("id, code, name, inventory_kind")
      .eq("property_id", propertyId)
      .order("name"),
    admin
      .from("seasons")
      .select("id, kind, starts_on, ends_on")
      .eq("property_id", propertyId)
      .order("starts_on"),
  ]);

  type RoomRateRaw = {
    id: string;
    season_kind: string;
    rate_tier: string;
    amount_btn: number;
    room_type_id?: string;
    room_types?:
      | { id: string; code: string; name: string; inventory_kind: string }
      | { id: string; code: string; name: string; inventory_kind: string }[]
      | null;
  };

  const rateRows = (ratesRes.data ?? []) as unknown as RoomRateRaw[];
  const roomTypesRaw = (roomTypesRes.data ?? []) as RoomTypeLite[];

  const rows: RateMatrixRow[] = rateRows.map((r) => {
    const rt = r.room_types;
    const room = Array.isArray(rt) ? rt[0] : rt;
    return {
      id: r.id,
      room_type_id: (r.room_type_id ?? room?.id) as string,
      room_type_name: room?.name ?? "—",
      season_kind: r.season_kind,
      rate_tier: r.rate_tier,
      amount_btn: Number(r.amount_btn ?? 0),
    };
  });

  const seasons = (seasonsRes.data ?? []).map((s) => ({
    id: s.id as string,
    kind: s.kind as string,
    starts_on: s.starts_on as string,
    ends_on: s.ends_on as string,
  }));

  return {
    rows,
    roomTypes: roomTypesRaw,
    seasons,
  };
}
