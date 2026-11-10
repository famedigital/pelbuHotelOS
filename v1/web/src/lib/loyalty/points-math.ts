/** Earn 1 point per 10 BTN of folio spend (floor), min 1 when spend > 0. */
export function pointsFromSpendBtn(spendBtn: number): number {
  const spend = Math.max(0, Number(spendBtn) || 0);
  if (spend <= 0) return 0;
  return Math.max(1, Math.floor(spend / 10));
}
