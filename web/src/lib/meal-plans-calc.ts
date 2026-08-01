import { roundBtn } from "@/lib/pricing";

/** null amount = label-only (no folio money). 0 = EP room only. */
export function computeMealStayTotalBtn(
  amountPerAdultNight: number | null | undefined,
  adults: number,
  nights: number,
): number | null {
  if (amountPerAdultNight == null) return null;
  const safeAdults = Math.max(1, adults);
  const safeNights = Math.max(1, nights);
  return roundBtn(Number(amountPerAdultNight) * safeAdults * safeNights);
}

export function mealPlanHasMoney(
  amountPerAdultNight: number | null | undefined,
): boolean {
  return amountPerAdultNight != null && Number(amountPerAdultNight) > 0;
}
