/**
 * Kitchen vs payment lifecycle for POS tickets.
 * Settlement (paid / folio) does NOT end kitchen work — only kot_status does.
 */

export const KOT_COOK_STATUSES = ["new", "preparing", "ready"] as const;

export type KotCookStatus = (typeof KOT_COOK_STATUSES)[number];

export type KitchenVisibilityInput = {
  order_source: string;
  delivery_type: string | null;
  confirmed_at: string | null;
  payment_recorded_at: string | null;
  settled_at: string | null;
  posted_to_folio_at: string | null;
  kot_status: string;
  is_parked?: boolean | null;
  voided_at?: string | null;
};

/** Still on the cook line / pass board (not served or cancelled). */
export function isOpenCookStatus(kotStatus: string): boolean {
  return (KOT_COOK_STATUSES as readonly string[]).includes(kotStatus);
}

/**
 * Public pickup/taxi must be desk-confirmed and payment-journaled before cook.
 * Public room / folio-posted = economically settled, kitchen still fires.
 * Desk / room_charge always kitchen-eligible when cook status is open.
 */
export function isKitchenBoardVisible(t: KitchenVisibilityInput): boolean {
  if (t.voided_at) return false;
  if (t.is_parked) return false;
  if (!isOpenCookStatus(t.kot_status)) return false;

  if (t.order_source === "public") {
    const roomOrFolio =
      t.delivery_type === "room" || Boolean(t.posted_to_folio_at);
    if (roomOrFolio) return true;
    return Boolean(t.confirmed_at && t.payment_recorded_at);
  }

  return true;
}

/**
 * POS open drawer: unpaid tickets, or any ticket still cooking
 * (e.g. public room charge already settled_at but not served).
 */
export function isPosBoardVisible(t: KitchenVisibilityInput): boolean {
  if (t.voided_at) return false;
  if (t.kot_status === "cancelled") return false;

  const cookOpen = isOpenCookStatus(t.kot_status);
  const unpaid = !t.settled_at;
  // Served but unpaid still on cashier path
  const unpaidServed = unpaid && t.kot_status === "served";

  if (unpaid || unpaidServed) return true;
  // Money done, kitchen still open
  if (cookOpen && isKitchenBoardVisible(t)) return true;
  return false;
}

/** Outlets allowed on the public createOrder path. */
export const PUBLIC_ORDER_OUTLETS = ["cafe", "pastry", "restaurant"] as const;

export function isPublicOrderOutlet(outlet: string): boolean {
  return (PUBLIC_ORDER_OUTLETS as readonly string[]).includes(outlet);
}
