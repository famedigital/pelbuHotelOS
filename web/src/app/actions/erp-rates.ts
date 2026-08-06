"use server";

import { isDeskAuthenticated, requireMoneyDesk } from "@/lib/desk-auth";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const SEASONS = new Set(["peak", "lean", "off"]);
const RATE_TIERS = new Set([
  "public",
  "friends",
  "family",
  "mutual_friends",
  "agents",
  "mou_agents",
]);

export type ErpRatesState = {
  ok: boolean;
  error?: string;
  message?: string;
  savedCount?: number;
};

type RateCellInput = {
  room_type_id: string;
  season_kind: string;
  rate_tier: string;
  /** Double occupancy. */
  amount_btn: number;
  /**
   * Single occupancy. undefined = leave existing; null = clear;
   * number = set.
   */
  amount_single_btn?: number | null;
};

type Admin = ReturnType<typeof createSupabaseAdminClient>;

function revalidateRates() {
  revalidatePath("/erp/rates");
  revalidatePath("/erp/agents");
  revalidatePath("/erp/settings");
  revalidatePath("/erp/rate-plans");
  revalidatePath("/erp/fast-book");
  revalidatePath("/erp/calendar");
  revalidatePath("/book");
  revalidatePath("/rates");
}

function parseRateCells(raw: unknown): RateCellInput[] {
  if (!Array.isArray(raw)) {
    throw new Error("Invalid rate payload.");
  }
  const cells: RateCellInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const roomTypeId = String(row.room_type_id ?? "").trim();
    const seasonKind = String(row.season_kind ?? "").trim().toLowerCase();
    const rateTier = String(row.rate_tier ?? "").trim().toLowerCase();
    const amount = roundBtn(Number(row.amount_btn));

    if (!roomTypeId || !SEASONS.has(seasonKind) || !RATE_TIERS.has(rateTier)) {
      continue;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Each double rate must be a non-negative number.");
    }

    let amountSingle: number | null | undefined = undefined;
    if ("amount_single_btn" in row) {
      if (row.amount_single_btn == null || row.amount_single_btn === "") {
        amountSingle = null;
      } else {
        const s = roundBtn(Number(row.amount_single_btn));
        if (!Number.isFinite(s) || s < 0) {
          throw new Error("Each single rate must be a non-negative number.");
        }
        amountSingle = s;
      }
    }

    cells.push({
      room_type_id: roomTypeId,
      season_kind: seasonKind,
      rate_tier: rateTier,
      amount_btn: amount,
      amount_single_btn: amountSingle,
    });
  }
  if (cells.length === 0) {
    throw new Error("No valid rates to save.");
  }
  return cells;
}

async function upsertOne(
  admin: Admin,
  propertyId: string,
  cell: RateCellInput,
): Promise<void> {
  const { data: existing } = await admin
    .from("room_rates")
    .select("id")
    .eq("property_id", propertyId)
    .eq("room_type_id", cell.room_type_id)
    .eq("season_kind", cell.season_kind)
    .eq("rate_tier", cell.rate_tier)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    amount_btn: cell.amount_btn,
  };
  if (cell.amount_single_btn !== undefined) {
    patch.amount_single_btn = cell.amount_single_btn;
  }

  if (existing?.id) {
    const { error } = await admin
      .from("room_rates")
      .update(patch)
      .eq("id", existing.id);
    if (error) {
      console.error("batchUpsertRoomRates update failed", error);
      throw new Error("Could not update a rate cell.");
    }
    return;
  }

  const { error } = await admin.from("room_rates").insert({
    property_id: propertyId,
    room_type_id: cell.room_type_id,
    season_kind: cell.season_kind,
    rate_tier: cell.rate_tier,
    amount_btn: cell.amount_btn,
    amount_single_btn:
      cell.amount_single_btn === undefined ? null : cell.amount_single_btn,
  });
  if (error) {
    console.error("batchUpsertRoomRates insert failed", error);
    throw new Error("Could not create a rate cell.");
  }
}

/** Spreadsheet batch save — one submit for all edited cells on Room rates. */
export async function batchUpsertRoomRates(
  _prev: ErpRatesState,
  formData: FormData,
): Promise<ErpRatesState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);

    const json = formData.get("rates_json");
    if (typeof json !== "string" || !json.trim()) {
      throw new Error("No rate changes to save.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("Invalid rate payload.");
    }

    const cells = parseRateCells(parsed);
    for (const cell of cells) {
      await upsertOne(admin, propertyId, cell);
    }

    revalidateRates();
    return {
      ok: true,
      savedCount: cells.length,
      message: `Saved ${cells.length} rate${cells.length === 1 ? "" : "s"}.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not save rates.",
    };
  }
}

/** Single-cell save — kept for backward compatibility with legacy matrix editor. */
export async function upsertRoomRate(
  _prev: ErpRatesState,
  formData: FormData,
): Promise<ErpRatesState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);

    const roomTypeId = String(formData.get("room_type_id") ?? "").trim();
    const seasonKind = String(formData.get("season_kind") ?? "")
      .trim()
      .toLowerCase();
    const rateTier = String(formData.get("rate_tier") ?? "").trim().toLowerCase();
    const amountRaw = String(formData.get("amount_btn") ?? "").trim();
    const singleRaw = String(formData.get("amount_single_btn") ?? "").trim();

    if (!roomTypeId) throw new Error("Room type is required.");
    if (!SEASONS.has(seasonKind)) {
      throw new Error("Season must be peak, lean, or off.");
    }
    if (!RATE_TIERS.has(rateTier)) {
      throw new Error("Invalid rate tier.");
    }
    const amount = roundBtn(Number(amountRaw));
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Double amount must be a non-negative number.");
    }

    let amountSingle: number | null = null;
    if (singleRaw !== "") {
      amountSingle = roundBtn(Number(singleRaw));
      if (!Number.isFinite(amountSingle) || amountSingle < 0) {
        throw new Error("Single amount must be a non-negative number.");
      }
    }

    await upsertOne(admin, propertyId, {
      room_type_id: roomTypeId,
      season_kind: seasonKind,
      rate_tier: rateTier,
      amount_btn: amount,
      amount_single_btn: amountSingle,
    });

    revalidateRates();
    return {
      ok: true,
      message: `Rate saved — double Nu ${amount}${
        amountSingle != null ? ` · single Nu ${amountSingle}` : ""
      }.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not save rate.",
    };
  }
}
