/**
 * Client-safe POS ticket helpers. Do not import `@/lib/pos` from client
 * components — that module loads desk-auth / next/headers.
 */

/** Settled / charged / paid-online tickets cannot take extra courses. */
export function canAddItemsToOpenTicket(ticket: {
  settled_at: string | null;
  posted_to_folio_at: string | null;
  order_source: string;
  payment_recorded_at: string | null;
}): boolean {
  if (ticket.settled_at) return false;
  if (ticket.posted_to_folio_at) return false;
  if (ticket.order_source === "public" && ticket.payment_recorded_at) {
    return false;
  }
  return true;
}

export function nextCourseNoForTicket(ticket: {
  order_items: { course_no: number }[];
}): number {
  const courses = ticket.order_items.map((i) => i.course_no || 1);
  const max = courses.length > 0 ? Math.max(1, ...courses) : 1;
  return Math.min(12, max + 1);
}
