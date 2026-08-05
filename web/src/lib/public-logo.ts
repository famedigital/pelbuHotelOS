import { resolveLogoSrc } from "@/lib/logo-src";
import { loadPublicPropertyProfile } from "@/lib/public-property";
import {
  DEFAULT_LOGO_NAV_GAP_REM,
  DEFAULT_LOGO_NAV_OFFSET_PCT,
  DEFAULT_LOGO_NAV_SHIFT_X_REM,
  DEFAULT_LOGO_NAV_SIZE_REM,
} from "@/lib/property-settings";

/**
 * Server-only logo loaders. For client-safe URL resolution use `@/lib/logo-src`.
 * Do not import this module from `"use client"` files — it pulls `next/headers`.
 */

export type PublicLogoLayout = {
  src: string;
  sizeRem: number;
  offsetPct: number;
  gapRem: number;
  shiftXRem: number;
};

/** Load logo + nav hang layout for public shells. */
export async function loadPublicLogoLayout(): Promise<PublicLogoLayout> {
  const property = await loadPublicPropertyProfile();
  return {
    src: resolveLogoSrc(property?.logoPublicId),
    sizeRem: property?.logoNavSizeRem ?? DEFAULT_LOGO_NAV_SIZE_REM,
    offsetPct: property?.logoNavOffsetPct ?? DEFAULT_LOGO_NAV_OFFSET_PCT,
    gapRem: property?.logoNavGapRem ?? DEFAULT_LOGO_NAV_GAP_REM,
    shiftXRem: property?.logoNavShiftXRem ?? DEFAULT_LOGO_NAV_SHIFT_X_REM,
  };
}

/** Load the property logo for public shells (header / footer fallbacks). */
export async function loadPublicLogoSrc(): Promise<string> {
  const layout = await loadPublicLogoLayout();
  return layout.src;
}
