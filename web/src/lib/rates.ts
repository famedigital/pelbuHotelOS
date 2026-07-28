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
  },
): Promise<number | null> {
  const { data } = await admin
    .from("room_rates")
    .select("amount_btn")
    .eq("property_id", args.propertyId)
    .eq("room_type_id", args.roomTypeId)
    .eq("season_kind", args.seasonKind)
    .eq("rate_tier", args.rateTier)
    .maybeSingle();

  if (data?.amount_btn == null) return null;
  return Number(data.amount_btn);
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
