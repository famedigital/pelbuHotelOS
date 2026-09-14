/**
 * Stay confirmation vs tax invoice refs.
 * - Confirmation: bookings.confirmation_code → PS-YYYY-#####
 * - Tax invoice: fiscal_documents.doc_no → INV-YYYY-#### (issued from folio)
 */

/** Prefer gapless confirmation code; fall back to short internal id. */
export function bookingConfirmationLabel(input: {
  confirmationCode?: string | null;
  bookingId?: string | null;
}): string {
  const code = input.confirmationCode?.trim();
  if (code) return code;
  const id = input.bookingId?.trim();
  if (id) return id.slice(0, 8).toUpperCase();
  return "—";
}

/** True when query looks like a stay confirmation (PS-… / numberish). */
export function looksLikeConfirmationQuery(q: string): boolean {
  const t = q.trim().toUpperCase();
  if (!t) return false;
  if (t.startsWith("PS-") || t.startsWith("INV-") || t.startsWith("RCP-")) {
    return true;
  }
  return /^PS[\s-]?\d{4}[\s-]?\d{1,6}$/i.test(t.replace(/\s+/g, ""));
}
