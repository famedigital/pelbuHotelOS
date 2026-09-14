/**
 * Short human reference for an order. Guests read it off the WhatsApp slip and
 * the desk searches by it, so it must be stable and easy to say out loud.
 */
export function orderRef(orderId: string): string {
  return `PB-${orderId.slice(0, 6).toUpperCase()}`;
}
