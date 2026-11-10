/**
 * Room-night tax — COPY from packages/core pricing + FIX per SOURCE-MAP:
 * - Default GST 5% (property override wins)
 * - Three entry modes: net | incl_sc | all_in
 * - Compound: SC on net, then GST on (net + SC)
 */

export const DEFAULT_GST_RATE = 0.05;
export const DEFAULT_SC_RATE = 0.1;

export function roundBtn(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** Entry mode for a typed night figure (REINVENT — replaces incoherent toggle pairs). */
export type RateEntryMode = "net" | "incl_sc" | "all_in";

export type TaxApplicability = {
  /** When false, SC rate is treated as 0 for this quote. */
  scApplicable: boolean;
  /** When false, GST rate is treated as 0 for this quote. */
  gstApplicable: boolean;
};

export type RoomNightTaxBreakdown = {
  amountBtn: number;
  serviceChargeBtn: number;
  serviceChargeRate: number;
  serviceChargeApplied: boolean;
  gstBtn: number;
  gstRate: number;
  totalBtn: number;
  entryMode: RateEntryMode;
};

export type QuoteRates = {
  gstRate?: number;
  serviceChargeRate?: number;
} & Partial<TaxApplicability>;

/**
 * Exclusive net → SC → GST on (net+SC).
 */
export function calculateFromNet(
  netBtn: number,
  rates: QuoteRates = {},
): RoomNightTaxBreakdown {
  const scApplicable = rates.scApplicable !== false;
  const gstApplicable = rates.gstApplicable !== false;
  const scRateRaw = Math.max(0, Number(rates.serviceChargeRate ?? DEFAULT_SC_RATE));
  const gstRateRaw = Math.max(0, Number(rates.gstRate ?? DEFAULT_GST_RATE));
  const scRate = scApplicable ? scRateRaw : 0;
  const gstRate = gstApplicable ? gstRateRaw : 0;
  const amountBtn = roundBtn(Math.max(0, Number(netBtn) || 0));
  const serviceChargeBtn = roundBtn(amountBtn * scRate);
  const gstBtn = roundBtn((amountBtn + serviceChargeBtn) * gstRate);
  const totalBtn = roundBtn(amountBtn + serviceChargeBtn + gstBtn);
  return {
    amountBtn,
    serviceChargeBtn,
    serviceChargeRate: scRate,
    serviceChargeApplied: scApplicable && scRate > 0,
    gstBtn,
    gstRate,
    totalBtn,
    entryMode: "net",
  };
}

/** Typed amount already includes SC; reverse net, then apply GST on (net+SC). */
export function calculateFromInclSc(
  typedBtn: number,
  rates: QuoteRates = {},
): RoomNightTaxBreakdown {
  const scApplicable = rates.scApplicable !== false;
  const gstApplicable = rates.gstApplicable !== false;
  const scRateRaw = Math.max(0, Number(rates.serviceChargeRate ?? DEFAULT_SC_RATE));
  const gstRateRaw = Math.max(0, Number(rates.gstRate ?? DEFAULT_GST_RATE));
  const scRate = scApplicable ? scRateRaw : 0;
  const gstRate = gstApplicable ? gstRateRaw : 0;
  const typed = roundBtn(Math.max(0, Number(typedBtn) || 0));
  const amountBtn = scRate > 0 ? roundBtn(typed / (1 + scRate)) : typed;
  const serviceChargeBtn = roundBtn(typed - amountBtn);
  const gstBtn = roundBtn((amountBtn + serviceChargeBtn) * gstRate);
  const totalBtn = roundBtn(amountBtn + serviceChargeBtn + gstBtn);
  return {
    amountBtn,
    serviceChargeBtn,
    serviceChargeRate: scRate,
    serviceChargeApplied: scApplicable && scRate > 0,
    gstBtn,
    gstRate,
    totalBtn,
    entryMode: "incl_sc",
  };
}

/** Typed amount is all-in; reverse net and SC; GST absorbs residual. */
export function calculateFromAllIn(
  allInBtn: number,
  rates: QuoteRates = {},
): RoomNightTaxBreakdown {
  const scApplicable = rates.scApplicable !== false;
  const gstApplicable = rates.gstApplicable !== false;
  const scRateRaw = Math.max(0, Number(rates.serviceChargeRate ?? DEFAULT_SC_RATE));
  const gstRateRaw = Math.max(0, Number(rates.gstRate ?? DEFAULT_GST_RATE));
  const scRate = scApplicable ? scRateRaw : 0;
  const gstRate = gstApplicable ? gstRateRaw : 0;
  const totalBtn = roundBtn(Math.max(0, Number(allInBtn) || 0));
  const divisor = (1 + scRate) * (1 + gstRate);
  let amountBtn = divisor > 0 ? roundBtn(totalBtn / divisor) : totalBtn;
  const serviceChargeBtn = roundBtn(amountBtn * scRate);
  let gstBtn = roundBtn(totalBtn - amountBtn - serviceChargeBtn);
  if (!(gstBtn > 0)) {
    amountBtn = roundBtn(amountBtn + gstBtn);
    gstBtn = 0;
  }
  return {
    amountBtn,
    serviceChargeBtn,
    serviceChargeRate: scRate,
    serviceChargeApplied: scApplicable && scRate > 0,
    gstBtn,
    gstRate,
    totalBtn,
    entryMode: "all_in",
  };
}

/** Single quote entry — prefer this over ad-hoc toggles. */
export function quoteNight(
  typedAmountBtn: number,
  mode: RateEntryMode,
  rates: QuoteRates = {},
): RoomNightTaxBreakdown {
  if (mode === "incl_sc") return calculateFromInclSc(typedAmountBtn, rates);
  if (mode === "all_in") return calculateFromAllIn(typedAmountBtn, rates);
  return calculateFromNet(typedAmountBtn, rates);
}

export function effectiveGstRate(
  source: { gst_enabled?: boolean | null; gst_rate?: number | null } | null | undefined,
  fallback = DEFAULT_GST_RATE,
): number {
  if (source?.gst_enabled === false) return 0;
  const rate = Number(source?.gst_rate);
  if (!Number.isFinite(rate)) return fallback;
  return Math.max(0, Math.min(rate, 1));
}
