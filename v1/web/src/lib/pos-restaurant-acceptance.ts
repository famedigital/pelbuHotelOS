/**
 * Restaurant POS production acceptance notes (manual / future e2e).
 *
 * Stories from plan Phase 5 — run against a desk session on demo-hotel:
 *
 * 1. Fire/send with KOT-on → print dialog after persist; stock fail → no dialog
 * 2. Settle receipt-only → receipt; kot_and_receipt + separate → two dialogs
 * 3. Reprint KOT from tickets does not re-deduct stock
 * 4. Type party name → same string on ticket, KOT, receipt; blank → Walk-in
 * 5. Training mode (Settings → Identity) → sell leaves qty_on_hand unchanged
 * 6. Scan sell_barcode on finished-good → line added; unknown code → toast
 * 7. Receive inventory requires unit cost
 *
 * Automated Playwright specs: deferred until staging secrets (FEATURES).
 */
export const POS_RESTAURANT_ACCEPTANCE = [
  "pos-kot-print-after-ok",
  "pos-settle-print-prefs",
  "pos-party-name-hero",
  "pos-training-skips-stock",
  "pos-barcode-resolve",
  "inventory-receive-requires-cost",
] as const;
