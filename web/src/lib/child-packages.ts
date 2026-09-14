import { roundBtn } from "@/lib/pricing";

/**
 * Hotel child packages relative to adult rack / meal rates.
 * Adult amount is the source of truth — child 6–12 is derived unless overridden.
 */
export const CHILD_PACKAGE = {
  /** Ages strictly under this (years) stay free on child packages. */
  freeUnderYears: 6,
  /** Ages [freeUnderYears, halfUnderYears) pay half adult rate. */
  halfUnderYears: 12,
  /** Fraction of adult night rate for chargeable children. */
  ofAdultFraction: 0.5,
} as const;

/** Nu for a child (6–12) night from the adult night Nu. */
export function childRateFromAdult(adultBtn: number): number {
  if (!Number.isFinite(adultBtn) || adultBtn <= 0) return 0;
  return roundBtn(Number(adultBtn) * CHILD_PACKAGE.ofAdultFraction);
}

/**
 * Effective per-child / night charge.
 * - Explicit child amount wins (including 0).
 * - Null child amount → auto 50% of adult package (6–12).
 * - Null/zero adult → 0 (no adult package money).
 */
export function effectiveChildNightRate(
  amountPerAdultNight: number | null | undefined,
  amountPerChildNight: number | null | undefined,
): number {
  if (amountPerChildNight != null) {
    return Math.max(0, Number(amountPerChildNight));
  }
  if (amountPerAdultNight == null) return 0;
  return childRateFromAdult(Number(amountPerAdultNight));
}

export function childPackageSummary(adultBtn: number | null | undefined): {
  infantLabel: string;
  childLabel: string;
  childAmountBtn: number;
} {
  const childAmount =
    adultBtn != null && Number(adultBtn) > 0
      ? childRateFromAdult(Number(adultBtn))
      : 0;
  return {
    infantLabel: `0–${CHILD_PACKAGE.freeUnderYears - 1} free`,
    childLabel: `${CHILD_PACKAGE.freeUnderYears}–${CHILD_PACKAGE.halfUnderYears - 1} @ 50% adult`,
    childAmountBtn: childAmount,
  };
}
