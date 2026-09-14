import { calculateRoomNightTax } from "@/lib/pricing";
import {
  lookupRoomRateBtn,
  resolveSeasonKind,
  type RateTier,
  type SeasonKind,
} from "@/lib/rates";
import { loadRoomRateTaxSettings } from "@/lib/room-rate-tax";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type BookingSource =
  | "owner"
  | "reservation"
  | "agent"
  | "client"
  | "ota";

const DEFAULT_TTL: Record<BookingSource, Record<SeasonKind, number>> = {
  client: { peak: 12, lean: 48, off: 168 },
  agent: { peak: 24, lean: 72, off: 240 },
  reservation: { peak: 6, lean: 24, off: 72 },
  owner: { peak: 6, lean: 24, off: 72 },
  ota: { peak: 24, lean: 48, off: 72 },
};

export async function resolveHoldTtlHours(
  admin: Admin,
  propertyId: string,
  source: BookingSource,
  checkIn: string,
): Promise<{ hours: number; seasonKind: SeasonKind }> {
  const seasonKind = await resolveSeasonKind(admin, propertyId, checkIn);
  const { data } = await admin
    .from("hold_ttl_rules")
    .select("ttl_hours")
    .eq("property_id", propertyId)
    .eq("source", source)
    .eq("season_kind", seasonKind)
    .maybeSingle();

  const hours =
    data?.ttl_hours != null
      ? Number(data.ttl_hours)
      : DEFAULT_TTL[source][seasonKind];
  return { hours: Math.max(1, hours), seasonKind };
}

export function holdExpiresAtFromNow(ttlHours: number): string {
  return new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
}

export type DepositRule = {
  mode: "one_night" | "fixed" | "percent";
  floor_btn: number;
  percent: number | null;
  bank_hint: string | null;
};

export async function loadDepositRule(
  admin: Admin,
  propertyId: string,
): Promise<DepositRule> {
  const { data } = await admin
    .from("property_deposit_rules")
    .select("mode, floor_btn, percent, bank_hint")
    .eq("property_id", propertyId)
    .maybeSingle();

  if (!data) {
    return {
      mode: "one_night",
      floor_btn: 2000,
      percent: null,
      bank_hint: null,
    };
  }
  return {
    mode: data.mode as DepositRule["mode"],
    floor_btn: Number(data.floor_btn ?? 0),
    percent: data.percent == null ? null : Number(data.percent),
    bank_hint: (data.bank_hint as string | null) ?? null,
  };
}

/** Token = max(floor, mode amount). one_night uses sellable first-night total. */
export async function computeTokenRequiredBtn(
  admin: Admin,
  args: {
    propertyId: string;
    checkIn: string;
    roomLines: { roomTypeId: string; qty: number }[];
    rateTier?: RateTier;
    /** For occupancy (1 adult → single sheet rate when set). */
    adults?: number;
    estimatedStayTotalBtn?: number;
  },
): Promise<number> {
  const rule = await loadDepositRule(admin, args.propertyId);
  const seasonKind = await resolveSeasonKind(
    admin,
    args.propertyId,
    args.checkIn,
  );
  const tier = args.rateTier ?? "public";

  let modeAmount = rule.floor_btn;

  if (rule.mode === "fixed") {
    modeAmount = rule.floor_btn;
  } else if (rule.mode === "percent") {
    // Prefer wizard/agent stay quote (all-in) when present.
    const stay =
      args.estimatedStayTotalBtn != null &&
      Number.isFinite(args.estimatedStayTotalBtn) &&
      args.estimatedStayTotalBtn > 0
        ? Number(args.estimatedStayTotalBtn)
        : (await estimateOneNightTotal(admin, {
            propertyId: args.propertyId,
            seasonKind,
            tier,
            roomLines: args.roomLines,
            adults: args.adults,
          })) * 2;
    const pct = rule.percent ?? 20;
    modeAmount = (stay * pct) / 100;
  } else {
    modeAmount = await estimateOneNightTotal(admin, {
      propertyId: args.propertyId,
      seasonKind,
      tier,
      roomLines: args.roomLines,
      adults: args.adults,
    });
  }

  return Math.max(rule.floor_btn, Math.round(modeAmount * 100) / 100);
}

/** First-night guest-facing room total (GST/SC via property rate tax settings). */
async function estimateOneNightTotal(
  admin: Admin,
  args: {
    propertyId: string;
    seasonKind: SeasonKind;
    tier: RateTier;
    roomLines: { roomTypeId: string; qty: number }[];
    adults?: number;
  },
): Promise<number> {
  const taxSettings = await loadRoomRateTaxSettings(admin, args.propertyId);
  let total = 0;
  for (const line of args.roomLines) {
    const rate = await lookupRoomRateBtn(admin, {
      propertyId: args.propertyId,
      roomTypeId: line.roomTypeId,
      seasonKind: args.seasonKind,
      rateTier: args.tier,
      adults: args.adults,
    });
    if (rate == null) continue;
    const nightAllIn = calculateRoomNightTax(rate, taxSettings).totalBtn;
    total += nightAllIn * line.qty;
  }
  return total;
}

export function paymentLinkToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
