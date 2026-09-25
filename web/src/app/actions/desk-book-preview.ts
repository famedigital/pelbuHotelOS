"use server";

import { isDeskAuthenticated } from "@/lib/desk-auth";
import { isBookableAgentStatus } from "@/lib/agents/status";
import { countAgentOpenRooms } from "@/lib/agents/open-rooms";
import { soldQtyByRoomType } from "@/lib/inventory-availability";
import { resolveStayAddonsForBook } from "@/lib/meal-plans";
import { calculateRoomNightTax, formatGuestBtn, roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import {
  agentRateTier,
  isRateTier,
  lookupRoomRateBtn,
  nightsBetween,
  resolveSeasonKind,
  type RateTier,
} from "@/lib/rates";
import { loadRoomRateTaxSettings } from "@/lib/room-rate-tax";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DeskQuoteLine = {
  roomTypeId: string;
  code: string;
  name: string;
  qty: number;
  /** Effective nightly used for package (agreed override or sheet). */
  nightlyBtn: number | null;
  /** Sheet nightly before FO override (null when no rate). */
  sheetNightlyBtn?: number | null;
  stayBtn: number | null;
  occupancy?: "single" | "double";
  mealPlanCode?: string;
  adults?: number;
  children?: number;
  extraBeds?: number;
};

export type DeskQuoteLineInput = {
  roomTypeId: string;
  qty: number;
  occupancy?: "single" | "double";
  mealPlanCode?: string | null;
  adults?: number;
  children?: number;
  extraBeds?: number;
  /** Override sheet nightly (all-in) for package preview. */
  agreedNightlyBtn?: number | null;
};

export type DeskAvailLine = {
  roomTypeId: string;
  code: string;
  capacity: number;
  sold: number;
  remaining: number;
};

export type DeskStayQuote = {
  ok: true;
  nights: number;
  /** Room blended nightly before package addons (per room-night). */
  systemNightlyBtn: number | null;
  /** Rooms only stay total. */
  stayRoomsBtn: number | null;
  guestNightlyDisplay: string | null;
  guestStayDisplay: string | null;
  rateTier: string;
  seasonKind: string;
  lines: DeskQuoteLine[];
  totalRooms: number;
  mixedCategories: boolean;
  mealPlanCode: string;
  mealStayBtn: number;
  mealPerNightBtn: number;
  extraBedStayBtn: number;
  extraBedPerNightBtn: number;
  /** Room + meal + extra / nights / rooms when available. */
  packageNightlyBtn: number | null;
  packageStayBtn: number | null;
  /** Live leftover by room type for the stay window (all inventory kinds). */
  availability: DeskAvailLine[];
  remainingByRoomTypeId: Record<string, number>;
  /** Soft agent room-cap signal (book never hard-blocks). */
  agentOpenRooms: number | null;
  agentRoomCap: number | null;
  agentCompanyName: string | null;
};

export type DeskStayQuoteError = { ok: false; error: string };

/**
 * Live price preview for DeskBookModal (no inventory lock).
 * Accepts multi-category `lines` or legacy single roomTypeId + qty.
 * Meal plan + extra beds included in package totals when provided.
 */
export async function previewDeskStayQuote(input: {
  checkIn: string;
  checkOut: string;
  /** Prefer for multi-category cart (supports per-line meal/occ/pax). */
  lines?: DeskQuoteLineInput[];
  /** @deprecated single-type — used when lines empty */
  roomTypeId?: string;
  qty?: number;
  adults?: number;
  /**
   * Room rate occupancy. When set, prefers single/double sheet rate
   * (`amount_single_btn` vs `amount_btn`). Defaults from adults when omitted.
   * Per-line occupancy on `lines[]` overrides this for that category.
   */
  occupancy?: "single" | "double";
  children?: number;
  extraBeds?: number;
  mealPlanCode?: string | null;
  source?: string;
  agentId?: string | null;
  /**
   * Explicit FO rate pickup tier (public / personal / agent / special).
   * When set to a known RateTier, wins over agent profile default.
   */
  rateTier?: string | null;
}): Promise<DeskStayQuote | DeskStayQuoteError> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired." };
    }
    const checkIn = (input.checkIn ?? "").trim();
    const checkOut = (input.checkOut ?? "").trim();
    if (!checkIn || !checkOut) {
      return { ok: false, error: "Dates required." };
    }
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1) {
      return { ok: false, error: "Check-out must be after check-in." };
    }

    const rawLines =
      input.lines && input.lines.length > 0
        ? input.lines
        : input.roomTypeId
          ? [
              {
                roomTypeId: input.roomTypeId.trim(),
                qty: Math.max(1, Math.floor(Number(input.qty) || 1)),
              } as DeskQuoteLineInput,
            ]
          : [];

    /** Keep first occurrence's line config when merging qty by type. */
    const merged = new Map<string, DeskQuoteLineInput>();
    for (const l of rawLines) {
      const id = (l.roomTypeId ?? "").trim();
      if (!id) continue;
      const q = Math.max(0, Math.floor(Number(l.qty) || 0));
      if (q < 1) continue;
      const prev = merged.get(id);
      if (prev) {
        merged.set(id, { ...prev, qty: prev.qty + q });
      } else {
        merged.set(id, { ...l, roomTypeId: id, qty: q });
      }
    }
    if (merged.size === 0) {
      return { ok: false, error: "Add at least one room category." };
    }

    const adultsGlobal = Math.max(1, Math.floor(Number(input.adults) || 2));
    const occupancyGlobal: "single" | "double" =
      input.occupancy === "single" || input.occupancy === "double"
        ? input.occupancy
        : adultsGlobal === 1
          ? "single"
          : "double";
    const childrenGlobal = Math.max(0, Math.floor(Number(input.children) || 0));
    const extraBedsGlobal = Math.max(
      0,
      Math.floor(Number(input.extraBeds) || 0),
    );

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    let tier: RateTier = "public";
    const source = (input.source ?? "reservation").trim();
    if (source === "mou_agent") tier = agentRateTier("mou_agents");
    else if (source === "agent") tier = agentRateTier("agents");
    else if (input.rateTier && isRateTier(input.rateTier)) {
      tier = input.rateTier;
    }

    let agentOpenRooms: number | null = null;
    let agentRoomCap: number | null = null;
    let agentCompanyName: string | null = null;

    if (input.agentId) {
      const { data: agent } = await admin
        .from("agents")
        .select("id, company_name, status, rate_tier, open_room_cap")
        .eq("id", input.agentId)
        .maybeSingle();
      if (agent && isBookableAgentStatus(agent.status as string)) {
        // Profile default; FO rate pickup may override below.
        if (!isRateTier(input.rateTier ?? null)) {
          tier = agentRateTier(agent.rate_tier as string);
        }
        agentCompanyName = (agent.company_name as string) ?? null;
        agentRoomCap = Math.max(0, Number(agent.open_room_cap ?? 15));
        try {
          agentOpenRooms = await countAgentOpenRooms(admin, {
            propertyId,
            agentId: agent.id as string,
          });
        } catch {
          agentOpenRooms = null;
        }
      }
    }

    // Explicit FO rate pickup always wins when valid.
    if (isRateTier(input.rateTier ?? null)) {
      tier = input.rateTier as RateTier;
    }

    const season = await resolveSeasonKind(admin, propertyId, checkIn);
    const taxSettings = await loadRoomRateTaxSettings(admin, propertyId);

    const typeIds = [...merged.keys()];
    const { data: typeRows } = await admin
      .from("room_types")
      .select("id, code, name, inventory_kind, unit_count")
      .eq("property_id", propertyId)
      .in("id", typeIds);

    const typeById = new Map(
      (typeRows ?? []).map((r) => [
        r.id as string,
        {
          code: (r.code as string) ?? "",
          name: (r.name as string) ?? "Room",
          kind: (r.inventory_kind as string) ?? "sellable_guest",
          unitCount: Number(r.unit_count ?? 0),
        },
      ]),
    );

    /** Full property availability for steppers + rail (all types). */
    const soldMap = await soldQtyByRoomType(
      admin,
      propertyId,
      checkIn,
      checkOut,
    );
    const { data: allTypes } = await admin
      .from("room_types")
      .select("id, code, unit_count")
      .eq("property_id", propertyId);
    const availability: DeskAvailLine[] = (allTypes ?? []).map((t) => {
      const capacity = Number(t.unit_count ?? 0);
      const sold = soldMap.get(t.id as string) ?? 0;
      return {
        roomTypeId: t.id as string,
        code: (t.code as string) ?? "",
        capacity,
        sold,
        remaining: Math.max(capacity - sold, 0),
      };
    });
    const remainingByRoomTypeId: Record<string, number> = {};
    for (const a of availability) {
      remainingByRoomTypeId[a.roomTypeId] = a.remaining;
    }

    const lines: DeskQuoteLine[] = [];
    let stayTotal = 0;
    let totalRooms = 0;
    let anyNull = false;
    let mealStayBtn = 0;
    let extraBedStayBtn = 0;

    for (const [roomTypeId, lineIn] of merged) {
      const meta = typeById.get(roomTypeId);
      if (!meta) {
        return { ok: false, error: "Unknown room type in cart." };
      }
      if (meta.kind !== "sellable_guest") continue;

      const qty = lineIn.qty;
      const adults = Math.max(
        1,
        Math.floor(Number(lineIn.adults ?? adultsGlobal) || adultsGlobal),
      );
      const occupancy: "single" | "double" =
        lineIn.occupancy === "single" || lineIn.occupancy === "double"
          ? lineIn.occupancy
          : occupancyGlobal;
      const children = Math.max(
        0,
        Math.floor(Number(lineIn.children ?? childrenGlobal) || 0),
      );
      const extraBeds = Math.max(
        0,
        Math.floor(Number(lineIn.extraBeds ?? extraBedsGlobal) || 0),
      );
      const mealPlanCode =
        lineIn.mealPlanCode?.trim() || input.mealPlanCode || "EP";

      const sheet = await lookupRoomRateBtn(admin, {
        propertyId,
        roomTypeId,
        seasonKind: season,
        rateTier: tier,
        occupancy,
        adults,
      });

      const agreed =
        lineIn.agreedNightlyBtn != null &&
        Number.isFinite(lineIn.agreedNightlyBtn) &&
        lineIn.agreedNightlyBtn >= 0
          ? roundBtn(Number(lineIn.agreedNightlyBtn))
          : null;

      const sheetAllIn =
        sheet != null
          ? calculateRoomNightTax(sheet, taxSettings).totalBtn
          : null;

      if (sheetAllIn == null && agreed == null) {
        anyNull = true;
        lines.push({
          roomTypeId,
          code: meta.code,
          name: meta.name,
          qty,
          nightlyBtn: null,
          sheetNightlyBtn: null,
          stayBtn: null,
          occupancy,
          mealPlanCode,
          adults,
          children,
          extraBeds,
        });
        totalRooms += qty;
        continue;
      }

      const nightAllIn = agreed ?? (sheetAllIn as number);
      const stay = roundBtn(nightAllIn * qty * nights);
      stayTotal = roundBtn(stayTotal + stay);
      totalRooms += qty;
      lines.push({
        roomTypeId,
        code: meta.code,
        name: meta.name,
        qty,
        nightlyBtn: roundBtn(nightAllIn),
        sheetNightlyBtn: sheetAllIn != null ? roundBtn(sheetAllIn) : null,
        stayBtn: stay,
        occupancy,
        mealPlanCode,
        adults,
        children,
        extraBeds,
      });

      const addons = await resolveStayAddonsForBook(admin, propertyId, {
        mealPlanCode,
        adults: adults * qty,
        children: children * qty,
        extraBeds: extraBeds * qty,
        nights,
      });
      mealStayBtn = roundBtn(mealStayBtn + addons.mealPlanAmountBtn);
      extraBedStayBtn = roundBtn(extraBedStayBtn + addons.extraBedAmountBtn);
    }

    if (totalRooms < 1) {
      return { ok: false, error: "Add at least one guest room." };
    }

    // Fallback: if no per-line meal inputs, use global once (legacy carts).
    if (
      mealStayBtn === 0 &&
      extraBedStayBtn === 0 &&
      (input.mealPlanCode || adultsGlobal)
    ) {
      const addons = await resolveStayAddonsForBook(admin, propertyId, {
        mealPlanCode: input.mealPlanCode,
        adults: adultsGlobal,
        children: childrenGlobal,
        extraBeds: extraBedsGlobal,
        nights,
      });
      mealStayBtn = roundBtn(addons.mealPlanAmountBtn);
      extraBedStayBtn = roundBtn(addons.extraBedAmountBtn);
    }

    const mealPerNightBtn =
      nights > 0 ? roundBtn(mealStayBtn / nights) : mealStayBtn;
    const extraBedPerNightBtn =
      nights > 0 ? roundBtn(extraBedStayBtn / nights) : extraBedStayBtn;

    const emptyBreak = {
      availability,
      remainingByRoomTypeId,
      agentOpenRooms,
      agentRoomCap,
      agentCompanyName,
    };

    if (anyNull || lines.some((l) => l.nightlyBtn == null)) {
      return {
        ok: true,
        nights,
        systemNightlyBtn: null,
        stayRoomsBtn: null,
        guestNightlyDisplay: null,
        guestStayDisplay: null,
        rateTier: tier,
        seasonKind: season,
        lines,
        totalRooms,
        mixedCategories: lines.length > 1,
        mealPlanCode: input.mealPlanCode ?? "EP",
        mealStayBtn,
        mealPerNightBtn,
        extraBedStayBtn,
        extraBedPerNightBtn,
        packageNightlyBtn: null,
        packageStayBtn: null,
        ...emptyBreak,
      };
    }

    const blended =
      totalRooms > 0 && nights > 0
        ? roundBtn(stayTotal / (totalRooms * nights))
        : null;
    const packageStayBtn = roundBtn(stayTotal + mealStayBtn + extraBedStayBtn);
    const packageNightlyBtn =
      totalRooms > 0 && nights > 0
        ? roundBtn(packageStayBtn / (totalRooms * nights))
        : null;

    return {
      ok: true,
      nights,
      systemNightlyBtn: packageNightlyBtn ?? blended,
      stayRoomsBtn: stayTotal,
      guestNightlyDisplay:
        packageNightlyBtn != null
          ? formatGuestBtn(packageNightlyBtn)
          : blended != null
            ? formatGuestBtn(blended)
            : null,
      guestStayDisplay: formatGuestBtn(packageStayBtn),
      rateTier: tier,
      seasonKind: season,
      lines,
      totalRooms,
      mixedCategories: lines.length > 1,
      mealPlanCode: input.mealPlanCode ?? lines[0]?.mealPlanCode ?? "EP",
      mealStayBtn,
      mealPerNightBtn,
      extraBedStayBtn,
      extraBedPerNightBtn,
      packageNightlyBtn,
      packageStayBtn,
      ...emptyBreak,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not preview rate.",
    };
  }
}
