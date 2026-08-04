import "server-only";

import type { RateTier, SeasonKind } from "@/lib/rates";
import { loadRoomRateTaxSettings } from "@/lib/room-rate-tax";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type { SeasonKind } from "@/lib/rates";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export const SEASON_ORDER: SeasonKind[] = ["peak", "lean", "off"];

export type RateCardSeason = {
  kind: SeasonKind;
  startsOn: string | null;
  endsOn: string | null;
};

export type RateCardRoom = {
  id: string;
  code: string;
  name: string;
  /** season_kind → amount_btn for a single tier */
  amounts: Partial<Record<SeasonKind, number>>;
};

export type RateCardTierBlock = {
  tier: RateTier;
  label: string;
  rooms: RateCardRoom[];
};

export type PublicRateCard = {
  propertyId: string;
  propertyName: string;
  seasons: RateCardSeason[];
  currentSeasonKind: SeasonKind;
  inclusiveOfGstSc: boolean;
  defaultMealPlan: { code: string; name: string; blurb: string | null } | null;
  mealPlans: { code: string; name: string; blurb: string | null }[];
  /** Public / BAR rack only */
  publicTier: RateCardTierBlock;
  whatsapp: string | null;
};

export type AgentRateCard = {
  agents: RateCardTierBlock;
  mouAgents: RateCardTierBlock;
};

const TIER_LABELS: Record<string, string> = {
  public: "Public / rack",
  agents: "Travel partner (agents)",
  mou_agents: "MoU agents",
};

function asSeasonKind(value: string | null | undefined): SeasonKind | null {
  if (value === "peak" || value === "lean" || value === "off") return value;
  return null;
}

function todayThimphuIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Thimphu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function seasonWindows(
  rows: { kind: string; starts_on: string; ends_on: string }[],
): RateCardSeason[] {
  const byKind = new Map<SeasonKind, RateCardSeason>();
  for (const row of rows) {
    const kind = asSeasonKind(row.kind);
    if (!kind) continue;
    if (!byKind.has(kind)) {
      byKind.set(kind, {
        kind,
        startsOn: row.starts_on,
        endsOn: row.ends_on,
      });
    }
  }
  return SEASON_ORDER.map(
    (kind) => byKind.get(kind) ?? { kind, startsOn: null, endsOn: null },
  );
}

function resolveCurrentSeason(
  seasons: { kind: string; starts_on: string; ends_on: string }[],
  onDate: string,
): SeasonKind {
  for (const s of seasons) {
    if (s.starts_on <= onDate && onDate <= s.ends_on) {
      const k = asSeasonKind(s.kind);
      if (k) return k;
    }
  }
  return "lean";
}

function buildTierRooms(
  roomTypes: { id: string; code: string; name: string }[],
  rates: {
    room_type_id: string;
    season_kind: string;
    rate_tier: string;
    amount_btn: number;
  }[],
  tier: RateTier,
): RateCardRoom[] {
  const filtered = rates.filter((r) => r.rate_tier === tier);
  return roomTypes
    .map((rt) => {
      const amounts: Partial<Record<SeasonKind, number>> = {};
      for (const r of filtered) {
        if (r.room_type_id !== rt.id) continue;
        const sk = asSeasonKind(r.season_kind);
        if (!sk) continue;
        amounts[sk] = Number(r.amount_btn);
      }
      return {
        id: rt.id,
        code: rt.code,
        name: rt.name,
        amounts,
      };
    })
    .filter((room) => Object.keys(room.amounts).length > 0);
}

async function loadSellableGuestRooms(
  admin: Admin,
  propertyId: string,
): Promise<{ id: string; code: string; name: string }[]> {
  const { data } = await admin
    .from("room_types")
    .select("id, code, name")
    .eq("property_id", propertyId)
    .eq("inventory_kind", "sellable_guest")
    .order("name");
  return (data ?? []).map((r) => ({
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
  }));
}

async function loadRatesForTiers(
  admin: Admin,
  propertyId: string,
  tiers: RateTier[],
): Promise<
  {
    room_type_id: string;
    season_kind: string;
    rate_tier: string;
    amount_btn: number;
  }[]
> {
  const { data } = await admin
    .from("room_rates")
    .select("room_type_id, season_kind, rate_tier, amount_btn")
    .eq("property_id", propertyId)
    .in("rate_tier", tiers)
    .limit(500);
  return (data ?? []).map((r) => ({
    room_type_id: r.room_type_id as string,
    season_kind: r.season_kind as string,
    rate_tier: r.rate_tier as string,
    amount_btn: Number(r.amount_btn),
  }));
}

/**
 * Public rack card — public tier only. Never loads agent / MoU amounts.
 */
export async function loadPublicRateCard(
  admin: Admin,
  propertyId: string,
): Promise<PublicRateCard | null> {
  const [
    { data: property },
    { data: seasonRows },
    tax,
    roomTypes,
    rates,
    { data: mealRows },
  ] = await Promise.all([
    admin
      .from("properties")
      .select("id, name, whatsapp, default_meal_plan_code")
      .eq("id", propertyId)
      .maybeSingle(),
    admin
      .from("seasons")
      .select("kind, starts_on, ends_on")
      .eq("property_id", propertyId)
      .order("starts_on"),
    loadRoomRateTaxSettings(admin, propertyId),
    loadSellableGuestRooms(admin, propertyId),
    loadRatesForTiers(admin, propertyId, ["public"]),
    admin
      .from("meal_plans")
      .select("code, name, blurb, is_active, sort_order")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  if (!property) return null;

  const seasonsRaw = (seasonRows ?? []) as {
    kind: string;
    starts_on: string;
    ends_on: string;
  }[];
  const today = todayThimphuIso();
  const currentSeasonKind = resolveCurrentSeason(seasonsRaw, today);

  const mealPlans = (mealRows ?? []).map((m) => ({
    code: m.code as string,
    name: m.name as string,
    blurb: (m.blurb as string | null) ?? null,
  }));
  const defaultCode =
    (property.default_meal_plan_code as string | null)?.trim() || "EP";
  const defaultMealPlan =
    mealPlans.find((m) => m.code === defaultCode) ??
    mealPlans[0] ??
    null;

  return {
    propertyId,
    propertyName: (property.name as string) || "Pelbu Suites",
    seasons: seasonWindows(seasonsRaw),
    currentSeasonKind,
    inclusiveOfGstSc: tax.inclusiveOfGstSc,
    defaultMealPlan,
    mealPlans,
    publicTier: {
      tier: "public",
      label: TIER_LABELS.public,
      rooms: buildTierRooms(roomTypes, rates, "public"),
    },
    whatsapp: (property.whatsapp as string | null) ?? null,
  };
}

/**
 * Agent / MoU rate card — call only after validated gate cookie/session.
 */
export async function loadAgentRateCard(
  admin: Admin,
  propertyId: string,
): Promise<AgentRateCard> {
  const [roomTypes, rates] = await Promise.all([
    loadSellableGuestRooms(admin, propertyId),
    loadRatesForTiers(admin, propertyId, ["agents", "mou_agents"]),
  ]);

  return {
    agents: {
      tier: "agents",
      label: TIER_LABELS.agents,
      rooms: buildTierRooms(roomTypes, rates, "agents"),
    },
    mouAgents: {
      tier: "mou_agents",
      label: TIER_LABELS.mou_agents,
      rooms: buildTierRooms(roomTypes, rates, "mou_agents"),
    },
  };
}

export function seasonLabel(kind: SeasonKind): string {
  if (kind === "peak") return "Peak";
  if (kind === "off") return "Off";
  return "Lean";
}
