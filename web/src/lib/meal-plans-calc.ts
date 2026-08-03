import { roundBtn } from "@/lib/pricing";

export const MAX_CHILDREN = 12;
export const MAX_EXTRA_BEDS = 2;

/**
 * Meal stay total: adult_rate × adults × nights + child_rate × children × nights.
 * - null adult rate → null (label-only; no folio money)
 * - null child rate → 0 for children (free kids when plan is priced for adults)
 * 0 adult rate (EP) → 0
 */
export function computeMealStayTotalBtn(
  amountPerAdultNight: number | null | undefined,
  adults: number,
  nights: number,
  amountPerChildNight?: number | null | undefined,
  children: number = 0,
): number | null {
  if (amountPerAdultNight == null) return null;
  const safeAdults = Math.max(1, adults);
  const safeNights = Math.max(1, nights);
  const safeChildren = Math.max(0, children);
  const adultPart = Number(amountPerAdultNight) * safeAdults * safeNights;
  const childRate =
    amountPerChildNight == null ? 0 : Number(amountPerChildNight);
  const childPart = childRate * safeChildren * safeNights;
  return roundBtn(adultPart + childPart);
}

export function mealPlanHasMoney(
  amountPerAdultNight: number | null | undefined,
  amountPerChildNight?: number | null | undefined,
): boolean {
  if (amountPerAdultNight != null && Number(amountPerAdultNight) > 0) {
    return true;
  }
  if (amountPerChildNight != null && Number(amountPerChildNight) > 0) {
    return true;
  }
  return false;
}

/** Extra bed stay total: rate × qty × nights. Null rate or qty 0 → 0. */
export function computeExtraBedStayTotalBtn(
  ratePerNight: number | null | undefined,
  qty: number,
  nights: number,
): number {
  if (ratePerNight == null || !(Number(ratePerNight) > 0)) return 0;
  const safeQty = Math.max(0, Math.min(MAX_EXTRA_BEDS, Math.floor(qty)));
  if (safeQty === 0) return 0;
  const safeNights = Math.max(1, nights);
  return roundBtn(Number(ratePerNight) * safeQty * safeNights);
}

/** True when property sells extra beds and a positive rate is configured. */
export function extraBedIsSellable(
  active: boolean | null | undefined,
  ratePerNight: number | null | undefined,
): boolean {
  return Boolean(active) && ratePerNight != null && Number(ratePerNight) > 0;
}
