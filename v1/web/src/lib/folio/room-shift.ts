import { calculateRoomNightTax, roundBtn, type RoomNightTaxOptions } from "@/lib/pricing";

/**
 * In-house room shift.
 * Nights already slept stay on the old door. Tonight (the business date)
 * through checkout moves to the new door.
 * A complimentary upgrade keeps the quoted nightly. Adding it to the bill
 * tops up the balance by the gap for the nights still left.
 */

export type ShiftBillChoice = "complimentary" | "top_up";

export type RoomShiftPlan =
  | { ok: false; error: string }
  | { ok: true; mode: "full" | "split"; shiftDate: string };

export function planInHouseRoomShift(input: {
  fromDate: string;
  toDate: string;
  businessDate: string;
}): RoomShiftPlan {
  const from = input.fromDate.slice(0, 10);
  const to = input.toDate.slice(0, 10);
  const business = input.businessDate.slice(0, 10);
  if (!(from && to && business) || to <= from) {
    return { ok: false, error: "This stay has no nights left to move." };
  }
  const shiftDate = business > from ? business : from;
  if (shiftDate >= to) {
    return {
      ok: false,
      error: "This guest checks out today. There is no night left to move.",
    };
  }
  return {
    ok: true,
    mode: shiftDate > from ? "split" : "full",
    shiftDate,
  };
}

/** Nights from the move date through checkout. Checkout day is not a night. */
export function nightsFromShift(shiftDate: string, checkOut: string): number {
  const start = Date.parse(`${shiftDate.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${checkOut.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

/** Guest-balance gap for the nights still to come. Negative means the new room is cheaper. */
export function upgradeBalanceChange(input: {
  quotedGuestNightly: number;
  newGuestNightly: number;
  nights: number;
}): { nightlyGapBtn: number; balanceChangeBtn: number } {
  const nightlyGapBtn = roundBtn(input.newGuestNightly - input.quotedGuestNightly);
  const nights = Math.max(0, Math.floor(input.nights));
  return {
    nightlyGapBtn,
    balanceChangeBtn: roundBtn(nightlyGapBtn * nights),
  };
}

/**
 * Complimentary upgrade waives a higher tariff. Charging less than the
 * calculated gap (or crediting more than a cheaper room) also needs a manager.
 */
export function upgradeNeedsManagerPin(input: {
  choice: ShiftBillChoice;
  suggestedBalanceBtn: number;
  topUpBalanceBtn: number;
}): boolean {
  if (input.choice === "complimentary") {
    return input.suggestedBalanceBtn > 0.5;
  }
  return input.topUpBalanceBtn < input.suggestedBalanceBtn - 0.5;
}

/** Split a guest-facing balance change into the folio tax fields. */
export function taxFromGuestBalance(
  guestTotal: number,
  settings: RoomNightTaxOptions,
) {
  const sign = guestTotal < 0 ? -1 : 1;
  const abs = Math.abs(roundBtn(guestTotal));
  if (abs < 0.005) {
    return calculateRoomNightTax(0, settings);
  }
  if (settings.inclusiveOfGstSc) {
    const tax = calculateRoomNightTax(abs, settings);
    return scaleTax(tax, sign);
  }
  const sc = settings.applyServiceCharge ? Math.max(0, settings.serviceChargeRate) : 0;
  const gst = Math.max(0, settings.gstRate);
  const divisor = (1 + sc) * (1 + gst);
  const net = divisor > 0 ? abs / divisor : abs;
  const tax = calculateRoomNightTax(net, {
    ...settings,
    inclusiveOfGstSc: false,
  });
  return scaleTax(tax, sign);
}

function scaleTax(
  tax: ReturnType<typeof calculateRoomNightTax>,
  sign: number,
) {
  if (sign >= 0) return tax;
  return {
    ...tax,
    amountBtn: roundBtn(tax.amountBtn * sign),
    serviceChargeBtn: roundBtn(tax.serviceChargeBtn * sign),
    gstBtn: roundBtn(tax.gstBtn * sign),
    totalBtn: roundBtn(tax.totalBtn * sign),
  };
}
