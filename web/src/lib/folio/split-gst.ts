import { roundBtn } from "@/lib/pricing";

/** Proportional GST share of a split tender (uses BTN rounding). */
export function allocateSplitGst(
  tenderAmountBtn: number,
  orderTotalBtn: number,
  orderGstBtn: number,
): number {
  if (orderTotalBtn <= 0 || orderGstBtn <= 0 || tenderAmountBtn <= 0) return 0;
  return roundBtn((tenderAmountBtn / orderTotalBtn) * orderGstBtn);
}