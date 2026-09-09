import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type SeasonKind = "peak" | "lean" | "off";

export type RateTier =
  | "public"
  | "friends"
  | "family"
  | "mutual_friends"
  | "agents"
  | "mou_agents";

export async function resolveSeasonKind(
  admin: Admin,
  propertyId: string,
  onDate: string,
): Promise<SeasonKind> {
  const { data } = await admin
    .from("seasons")
    .select("kind")
    .eq("property_id", propertyId)
    .lte("starts_on", onDate)
    .gte("ends_on", onDate)
    .limit(1)
    .maybeSingle();

  const kind = data?.kind as SeasonKind | undefined;
  if (kind === "peak" || kind === "lean" || kind === "off") return kind;
  return "lean";
}

export async function lookupRoomRateBtn(
  admin: Admin,
  args: {
    propertyId: string;
    roomTypeId: string;
    seasonKind: SeasonKind;
    rateTier: RateTier;
    /**
     * When `single` and a single rate is stored, return that.
     * Default `double` keeps existing desk behaviour.
     */
    occupancy?: "single" | "double";
    /** Convenience: adults === 1 selects single when available. */
    adults?: number;
  },
): Promise<number | null> {
  const map = await lookupRoomRatesBatch(admin, {
    propertyId: args.propertyId,
    roomTypeIds: [args.roomTypeId],
    seasonKind: args.seasonKind,
    rateTier: args.rateTier,
    occupancy: args.occupancy,
    adults: args.adults,
  });
  return map.get(args.roomTypeId) ?? null;
}

/** Shared amount pick — batch and single lookups must stay identical. */
export function pickRoomRateAmount(
  row: {
    amount_btn?: number | null;
    amount_single_btn?: number | null;
  } | null,
  args: {
    occupancy?: "single" | "double";
    adults?: number;
  },
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

/** One query for many room types — parity with lookupRoomRateBtn per id. */
export async function lookupRoomRatesBatch(
  admin: Admin,
  args: {
    propertyId: string;
    roomTypeIds: string[];
    seasonKind: SeasonKind;
    rateTier: RateTier;
    occupancy?: "single" | "double";
    adults?: number;
  },
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  const ids = [...new Set(args.roomTypeIds.filter(Boolean))];
  for (const id of ids) out.set(id, null);
  if (ids.length === 0) return out;

  const { data } = await admin
    .from("room_rates")
    .select("room_type_id, amount_btn, amount_single_btn")
    .eq("property_id", args.propertyId)
    .eq("season_kind", args.seasonKind)
    .eq("rate_tier", args.rateTier)
    .in("room_type_id", ids);

  for (const row of data ?? []) {
    const roomTypeId = row.room_type_id as string;
    out.set(
      roomTypeId,
      pickRoomRateAmount(row, {
        occupancy: args.occupancy,
        adults: args.adults,
      }),
    );
  }

  return out;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00Z`);
  const b = new Date(`${checkOut}T00:00:00Z`);
  const ms = b.getTime() - a.getTime();
  const nights = Math.round(ms / (1000 * 60 * 60 * 24));
  return Math.max(1, nights);
}

export async function pelbuPropertyId(admin: Admin): Promise<string> {
  const { data: property, error } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  if (error || !property) {
    throw new Error("Hotel property is not configured.");
  }
  return property.id as string;
}

const RATE_TIERS: ReadonlySet<string> = new Set([
  "public",
  "friends",
  "family",
  "mutual_friends",
  "agents",
  "mou_agents",
]);

export function agentRateTier(agentTier: string | null | undefined): RateTier {
  if (agentTier && RATE_TIERS.has(agentTier)) return agentTier as RateTier;
  return "agents";
}
