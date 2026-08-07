import { DEFAULT_GST_RATE } from "@/lib/property-settings";

/** Default Bhutan GST rate used when a property override is not loaded. */
export const BHUTAN_GST_RATE = DEFAULT_GST_RATE;

export type LineModifierForGst = {
  /** Unit price of this modifier option (before qty). */
  priceBtn: number;
  qty?: number;
  gstApplicable?: boolean;
};

export type LineForGst = {
  qty: number;
  unitPriceBtn: number;
  gstApplicable: boolean;
  /**
   * Per-unit modifier surcharge. Prefer `modifiers` when GST flags differ
   * per option; otherwise a single number is fine.
   */
  modifierUnitBtn?: number;
  /** Detailed modifiers — when present, overrides `modifierUnitBtn` for totals. */
  modifiers?: LineModifierForGst[];
  /** Non-chargeable lines: exclude from subtotal/SC/GST; still report list value. */
  isNc?: boolean;
};

export type PricingOptions = {
  gstRate?: number;
  serviceChargeRate?: number;
  applyServiceCharge?: boolean;
};

export function roundBtn(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Guest-facing whole Nu total after GST/SC.
 * Uses nearest Nu, but never above the accurate tax total (guest does not pay up).
 */
export function roundGuestWholeBtn(amount: number): number {
  const a = roundBtn(amount);
  if (!Number.isFinite(a)) return 0;
  const nearest = Math.round(a);
  if (nearest > a + 1e-9) return Math.floor(a + 1e-9);
  return nearest;
}

/**
 * Hotel-absorbed credit (≤ 0) so guest-facing sum is whole Nu.
 * Zero when already a whole figure.
 */
export function guestRateAbsorbBtn(accurateTotal: number): number {
  const accurate = roundBtn(accurateTotal);
  return roundBtn(roundGuestWholeBtn(accurate) - accurate);
}

/** Folio/invoice label for the absorb line (hotel rates, not guest discount marketing). */
export const GUEST_RATE_ADJ_DESCRIPTION =
  "Adj · deducted from our rates (round figure)";

/** Sum of modifier unit prices for one cart line (qty of line applied outside). */
export function modifierUnitTotal(modifiers: LineModifierForGst[] | undefined): number {
  if (!modifiers?.length) return 0;
  return modifiers.reduce(
    (sum, m) => sum + Number(m.priceBtn ?? 0) * Math.max(1, Number(m.qty ?? 1)),
    0,
  );
}

export function calculateOrderTotals(
  lines: LineForGst[],
  options: PricingOptions = {},
): {
  subtotalBtn: number;
  serviceChargeBtn: number;
  gstBtn: number;
  totalBtn: number;
  /** List-price total of NC lines (excluded from payable total). */
  ncValueBtn: number;
  /** Chargeable subtotal before NC exclusion adjustment (same as subtotal). */
  listSubtotalBtn: number;
} {
  let subtotal = 0;
  let listSubtotal = 0;
  let ncValue = 0;
  let gstBase = 0;

  for (const line of lines) {
    const isNc = Boolean(line.isNc);
    const modUnit =
      line.modifiers && line.modifiers.length > 0
        ? modifierUnitTotal(line.modifiers)
        : Number(line.modifierUnitBtn ?? 0);
    const unit = line.unitPriceBtn + modUnit;
    const lineTotal = line.qty * unit;
    listSubtotal += lineTotal;
    if (isNc) {
      ncValue += lineTotal;
      continue;
    }
    subtotal += lineTotal;

    if (line.modifiers && line.modifiers.length > 0) {
      // Base item GST + each modifier's own GST flag
      if (line.gstApplicable) {
        gstBase += line.qty * line.unitPriceBtn;
      }
      for (const m of line.modifiers) {
        const mQty = Math.max(1, Number(m.qty ?? 1));
        const mGst = m.gstApplicable !== false;
        if (mGst) {
          gstBase += line.qty * Number(m.priceBtn ?? 0) * mQty;
        }
      }
    } else if (line.gstApplicable) {
      gstBase += lineTotal;
    }
  }

  const subtotalBtn = roundBtn(subtotal);
  const listSubtotalBtn = roundBtn(listSubtotal);
  const ncValueBtn = roundBtn(ncValue);
  const serviceChargeRate =
    options.applyServiceCharge === false
      ? 0
      : Math.max(0, Number(options.serviceChargeRate ?? 0));
  const serviceChargeBtn = roundBtn(subtotalBtn * serviceChargeRate);
  const taxableShare = subtotalBtn > 0 ? gstBase / subtotalBtn : 0;
  const taxableServiceCharge = roundBtn(serviceChargeBtn * taxableShare);
  const gstRate = Math.max(0, Number(options.gstRate ?? BHUTAN_GST_RATE));
  const gstBtn = roundBtn((gstBase + taxableServiceCharge) * gstRate);
  const totalBtn = roundBtn(subtotalBtn + serviceChargeBtn + gstBtn);

  return {
    subtotalBtn,
    serviceChargeBtn,
    gstBtn,
    totalBtn,
    ncValueBtn,
    listSubtotalBtn,
  };
}

export function formatBtn(amount: number): string {
  return `Nu ${amount.toLocaleString("en-BT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Options for room-night GST + service charge (property-level rates). */
export type RoomNightTaxOptions = {
  gstRate: number;
  serviceChargeRate: number;
  applyServiceCharge: boolean;
  /**
   * When true, `listedAmountBtn` from `room_rates` is all-in (GST + SC when SC applies).
   * When false (default), listed amount is exclusive net and SC + GST are added.
   */
  inclusiveOfGstSc?: boolean;
};

export type RoomNightTaxBreakdown = {
  /** Net room amount posted on the folio line (pre SC + GST). */
  amountBtn: number;
  serviceChargeBtn: number;
  serviceChargeRate: number;
  serviceChargeApplied: boolean;
  gstBtn: number;
  /** Guest-facing all-in night total. */
  totalBtn: number;
  inclusiveOfGstSc: boolean;
};

/**
 * Split a stored room rate into net / SC / GST for folio posting and guest display.
 *
 * Exclusive (default): total = net × (1 + sc) × (1 + gst) with roundBtn at each step.
 * Inclusive: listed amount is total; reverse-out net = total / ((1+sc)×(1+gst)), then SC; GST absorbs rounding residual so net + SC + GST = total.
 */
export function calculateRoomNightTax(
  listedAmountBtn: number,
  options: RoomNightTaxOptions,
): RoomNightTaxBreakdown {
  const gstRate = Math.max(0, Number(options.gstRate ?? 0));
  const scRateRaw = Math.max(0, Number(options.serviceChargeRate ?? 0));
  const applySc = Boolean(options.applyServiceCharge) && scRateRaw > 0;
  const scRate = applySc ? scRateRaw : 0;
  const inclusive = Boolean(options.inclusiveOfGstSc);
  const listed = roundBtn(Math.max(0, Number(listedAmountBtn) || 0));

  if (!inclusive) {
    const amountBtn = listed;
    const serviceChargeBtn = roundBtn(amountBtn * scRate);
    const gstBtn = roundBtn((amountBtn + serviceChargeBtn) * gstRate);
    const totalBtn = roundBtn(amountBtn + serviceChargeBtn + gstBtn);
    return {
      amountBtn,
      serviceChargeBtn,
      serviceChargeRate: scRate,
      serviceChargeApplied: applySc,
      gstBtn,
      totalBtn,
      inclusiveOfGstSc: false,
    };
  }

  // Inclusive: listed is all-in. total = net * (1+sc) * (1+gst)
  const totalBtn = listed;
  const divisor = (1 + scRate) * (1 + gstRate);
  let amountBtn = divisor > 0 ? roundBtn(totalBtn / divisor) : totalBtn;
  const serviceChargeBtn = roundBtn(amountBtn * scRate);
  let gstBtn = roundBtn(totalBtn - amountBtn - serviceChargeBtn);
  // Absorb rare negative residual into net so components sum cleanly
  if (gstBtn < 0) {
    amountBtn = roundBtn(amountBtn + gstBtn);
    gstBtn = 0;
  }
  return {
    amountBtn,
    serviceChargeBtn,
    serviceChargeRate: scRate,
    serviceChargeApplied: applySc,
    gstBtn,
    totalBtn,
    inclusiveOfGstSc: true,
  };
}
