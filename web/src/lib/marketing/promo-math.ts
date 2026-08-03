/** Pure promo math — safe for client and unit tests (no server-only). */

export function applyPromoBenefit(
  amountBtn: number,
  benefitType: "pct" | "fixed_btn",
  benefitValue: number,
  maxDiscountBtn?: number | null,
): number {
  const amount = Math.max(0, Number(amountBtn) || 0);
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
