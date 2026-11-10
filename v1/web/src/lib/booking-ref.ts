/**
 * Stay confirmation vs tax invoice refs.
 * - Booking: bookings.confirmation_code → HotelBK# (older stays PS-YYYY-#####)
 * - Folio: folios.doc_no → HotelFN#
 * - Master bill: fiscal_documents.doc_no → HotelBN# (older bills INV-YYYY-####)
 */

import { looksLikeHotelDocQuery } from "@/lib/hotel-doc-no";

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

/** True when query looks like a booking, folio, or bill number. */
export function looksLikeConfirmationQuery(q: string): boolean {
  return looksLikeHotelDocQuery(q);
}
