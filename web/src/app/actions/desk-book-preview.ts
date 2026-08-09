"use server";

import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  isBookableAgentStatus,
} from "@/lib/agents/status";
import { calculateRoomNightTax, formatGuestBtn, roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import {
  agentRateTier,
  lookupRoomRateBtn,
  nightsBetween,
  resolveSeasonKind,
  type RateTier,
} from "@/lib/rates";
import { loadRoomRateTaxSettings } from "@/lib/room-rate-tax";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DeskStayQuote = {
  ok: true;
  nights: number;
  systemNightlyBtn: number | null;
  stayRoomsBtn: number | null;
  guestNightlyDisplay: string | null;
  guestStayDisplay: string | null;
  rateTier: string;
  seasonKind: string;
};

export type DeskStayQuoteError = { ok: false; error: string };

/**
 * Live price preview for DeskBookModal (no inventory lock).
 */
export async function previewDeskStayQuote(input: {
  checkIn: string;
  checkOut: string;
  roomTypeId: string;
  qty: number;
  adults?: number;
  source?: string;
  agentId?: string | null;
}): Promise<DeskStayQuote | DeskStayQuoteError> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired." };
    }
    const checkIn = (input.checkIn ?? "").trim();
    const checkOut = (input.checkOut ?? "").trim();
    const roomTypeId = (input.roomTypeId ?? "").trim();
    const qty = Math.max(1, Math.floor(Number(input.qty) || 1));
    if (!checkIn || !checkOut || !roomTypeId) {
      return { ok: false, error: "Dates and room type required." };
    }
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1) {
      return { ok: false, error: "Check-out must be after check-in." };
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    let tier: RateTier = "public";
    const source = (input.source ?? "reservation").trim();
    if (source === "mou_agent") tier = agentRateTier("mou_agents");
    else if (source === "agent") tier = agentRateTier("agents");

    if (input.agentId) {
      const { data: agent } = await admin
        .from("agents")
        .select("id, status, rate_tier")
        .eq("id", input.agentId)
        .maybeSingle();
      if (agent && isBookableAgentStatus(agent.status as string)) {
        tier = agentRateTier(agent.rate_tier as string);
      }
    }

    const season = await resolveSeasonKind(admin, propertyId, checkIn);
    const taxSettings = await loadRoomRateTaxSettings(admin, propertyId);
    const sheet = await lookupRoomRateBtn(admin, {
      propertyId,
      roomTypeId,
      seasonKind: season,
      rateTier: tier,
      adults: input.adults ?? 2,
    });
    if (sheet == null) {
      return {
        ok: true,
        nights,
        systemNightlyBtn: null,
        stayRoomsBtn: null,
        guestNightlyDisplay: null,
        guestStayDisplay: null,
        rateTier: tier,
        seasonKind: season,
      };
    }

    const nightAllIn = calculateRoomNightTax(sheet, taxSettings).totalBtn;
    const stay = roundBtn(nightAllIn * qty * nights);
    return {
      ok: true,
      nights,
      systemNightlyBtn: roundBtn(nightAllIn),
      stayRoomsBtn: stay,
      guestNightlyDisplay: formatGuestBtn(nightAllIn),
      guestStayDisplay: formatGuestBtn(stay),
      rateTier: tier,
      seasonKind: season,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not preview rate.",
    };
  }
}
