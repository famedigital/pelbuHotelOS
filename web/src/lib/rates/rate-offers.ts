import "server-only";

import { pickRoomRateAmount, type RateTier, type SeasonKind } from "@/lib/rates";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export { offerListLabel } from "@/lib/rates/rate-offer-label";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export const STANDARD_RATE_LABEL = "Standard";

export type RateOffer = {
  id: string;
  roomTypeId: string;
  roomTypeName: string;
  seasonKind: string;
  rateTier: string;
  label: string;
  agentId: string | null;
  agentName: string | null;
  guestLabel: string | null;
  amountBtn: number;
  amountSingleBtn: number | null;
  active: boolean;
};

export function offerNightlyAmount(
  row: { amount_btn?: number | null; amount_single_btn?: number | null },
  adults: number | null | undefined,
): number | null {
  return pickRoomRateAmount(row, { adults: adults ?? undefined });
}

type RawOffer = {
  id: string;
  room_type_id: string;
  season_kind: string;
  rate_tier: string;
  label: string | null;
  agent_id: string | null;
  guest_label: string | null;
  amount_btn: number;
  amount_single_btn: number | null;
  active: boolean | null;
  room_types?: { name?: string } | { name?: string }[] | null;
  agents?: { company_name?: string } | { company_name?: string }[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function mapRateOffer(row: RawOffer): RateOffer {
  const room = one(row.room_types);
  const agent = one(row.agents);
  return {
    id: row.id,
    roomTypeId: row.room_type_id,
    roomTypeName: room?.name?.trim() || "Room",
    seasonKind: row.season_kind,
    rateTier: row.rate_tier,
    label: (row.label ?? STANDARD_RATE_LABEL).trim() || STANDARD_RATE_LABEL,
    agentId: row.agent_id,
    agentName: agent?.company_name?.trim() || null,
    guestLabel: row.guest_label?.trim() || null,
    amountBtn: Number(row.amount_btn),
    amountSingleBtn:
      row.amount_single_btn == null ? null : Number(row.amount_single_btn),
    active: row.active !== false,
  };
}

/** Offers the desk can draw onto this stay. Shared tiers plus this agent and this guest. */
export async function listStayRateOffers(
  admin: Admin,
  args: {
    propertyId: string;
    roomTypeId: string | null;
    seasonKind: SeasonKind;
    agentId: string | null;
    guestName: string | null;
  },
): Promise<RateOffer[]> {
  let query = admin
    .from("room_rates")
    .select(
      "id, room_type_id, season_kind, rate_tier, label, agent_id, guest_label, amount_btn, amount_single_btn, active, room_types(name), agents(company_name)",
    )
    .eq("property_id", args.propertyId)
    .eq("season_kind", args.seasonKind)
    .eq("active", true);
  if (args.roomTypeId) query = query.eq("room_type_id", args.roomTypeId);

  const { data, error } = await query.limit(400);
  if (error) throw new Error(error.message);

  const guest = args.guestName?.trim().toLowerCase() ?? "";
  const rows = ((data ?? []) as unknown as RawOffer[]).map(mapRateOffer);
  return rows.filter((row) => {
    if (row.agentId && row.agentId !== args.agentId) return false;
    if (row.guestLabel && row.guestLabel.toLowerCase() !== guest) return false;
    return true;
  });
}

export async function listNamedRateOffers(
  admin: Admin,
  propertyId: string,
): Promise<RateOffer[]> {
  const { data, error } = await admin
    .from("room_rates")
    .select(
      "id, room_type_id, season_kind, rate_tier, label, agent_id, guest_label, amount_btn, amount_single_btn, active, room_types(name), agents(company_name)",
    )
    .eq("property_id", propertyId)
    .eq("active", true)
    .order("label")
    .limit(500);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawOffer[])
    .map(mapRateOffer)
    .filter(
      (row) =>
        row.label.toLowerCase() !== "standard" ||
        row.agentId != null ||
        row.guestLabel != null,
    );
}

export function isSharedStandardOffer(row: {
  label?: string | null;
  agent_id?: string | null;
  guest_label?: string | null;
}): boolean {
  const label = (row.label ?? STANDARD_RATE_LABEL).trim().toLowerCase();
  return label === "standard" && !row.agent_id && !row.guest_label?.trim();
}

export type { RateTier };
