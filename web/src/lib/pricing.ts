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
