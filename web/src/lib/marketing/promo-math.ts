/** Pure promo math — safe for client and unit tests (no server-only). */

export function applyPromoBenefit(
  amountBtn: number,
  benefitType: "pct" | "fixed_btn" | "nightly_rate_btn",
  benefitValue: number,
  maxDiscountBtn?: number | null,
): number {
  const amount = Math.max(0, Number(amountBtn) || 0);
  // nightly_rate_btn is a rate override, not a cash discount against a quote.
  if (benefitType === "nightly_rate_btn") return 0;
  let discount =
    benefitType === "pct"
      ? Math.round(
          amount * (Math.min(100, Math.max(0, benefitValue)) / 100) * 100,
        ) / 100
      : Math.min(amount, Math.max(0, benefitValue));
  if (maxDiscountBtn != null && Number.isFinite(maxDiscountBtn)) {
    discount = Math.min(discount, Number(maxDiscountBtn));
  }
  return Math.max(0, Math.round(discount * 100) / 100);
}

/**
 * Persist on bookings.promo_discount_pct so room-night + meal + laundry
 * posts apply the same stay-level discount after redeem.
 *
 * - pct: store benefit_value as-is
 * - fixed_btn: amortize as equivalent % of pre-discount stay quote so
 *   nightly posters (which only read %) still cascade the discount
 */
export function stayLevelPromoDiscountPct(args: {
  benefitType?: "pct" | "fixed_btn" | "nightly_rate_btn" | string | null;
  benefitValue?: number | null;
  discountBtn: number;
  preDiscountBtn: number;
}): number | null {
  // Agreed nightly rate is applied via bookings.agreed_nightly_rate_btn — not % off.
  if (args.benefitType === "nightly_rate_btn") return null;
  if (args.benefitType === "pct") {
    const v = Number(args.benefitValue ?? 0);
    if (!Number.isFinite(v) || v <= 0) return null;
    return Math.min(100, Math.round(v * 100) / 100);
  }
  const pre = Number(args.preDiscountBtn);
  const disc = Number(args.discountBtn);
  if (!(pre > 0) || !(disc > 0) || !Number.isFinite(pre) || !Number.isFinite(disc)) {
    return null;
  }
  return Math.min(100, Math.round((disc / pre) * 10000) / 100);
}
