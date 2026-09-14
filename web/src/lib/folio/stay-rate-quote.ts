import { calculateRoomNightTax, roundBtn } from "@/lib/pricing";

/** Tax options used for listed room rates → guest-facing all-in night. */
export type StayRoomTaxOpts = {
  gstRate: number;
  serviceChargeRate: number;
  applyServiceCharge: boolean;
  inclusiveOfGstSc: boolean;
};

/**
 * Convert a stored room listed amount (sheet or agreed) to guest all-in nightly,
 * using the same rule as night-audit / folio room posts.
 */
export function roomNightAllInBtn(
  listedAmountBtn: number,
  tax: StayRoomTaxOpts,
): number {
  return calculateRoomNightTax(listedAmountBtn, {
    gstRate: tax.gstRate,
    serviceChargeRate: tax.serviceChargeRate,
    applyServiceCharge: tax.applyServiceCharge,
    inclusiveOfGstSc: tax.inclusiveOfGstSc,
  }).totalBtn;
}

/**
 * Package stay total: room all-in × rooms × nights + meal package + extra beds.
 * Matches desk book / StayHub sheet preview structure.
 */
export function packageStayTotalBtn(opts: {
  roomNightAllInBtn: number;
  rooms: number;
  nights: number;
  mealStayBtn?: number | null;
  extraBedStayBtn?: number | null;
}): number {
  const rooms = Math.max(1, Math.floor(Number(opts.rooms) || 1));
  const nights = Math.max(0, Math.floor(Number(opts.nights) || 0));
  const roomStay = opts.roomNightAllInBtn * rooms * nights;
  return roundBtn(
    roomStay +
      Number(opts.mealStayBtn ?? 0) +
      Number(opts.extraBedStayBtn ?? 0),
  );
}

/** Package average per room-night (for rail “nightly” packaging). */
export function packageNightlyAverageBtn(
  stayTotalBtn: number,
  rooms: number,
  nights: number,
): number | null {
  const denom =
    Math.max(1, Math.floor(Number(rooms) || 1)) *
    Math.max(0, Math.floor(Number(nights) || 0));
  if (denom <= 0) return null;
  return roundBtn(stayTotalBtn / denom);
}
