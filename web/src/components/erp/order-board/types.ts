import type { KotStatus } from "@/lib/kot";

export type OrderTicketItem = {
  name: string;
  qty: number;
};

export type OrderTicket = {
  id: string;
  customerName: string;
  phone: string | null;
  outlet: string;
  deliveryType: string | null;
  deliveryArea: string | null;
  orderSource: string | null;
  totalBtn: number;
  kotStatus: KotStatus;
  bookingId: string | null;
  folioId: string | null;
  postedToFolioAt: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  paymentRecordedAt: string | null;
  paymentJournalNo: string | null;
  createdAt: string;
  items: OrderTicketItem[];
};

export type OrderBoardBooking = {
  id: string;
  contactName: string;
  checkIn: string;
};

export const ORDER_BOARD_COLUMNS = ["new", "preparing", "ready"] as const;
export type OrderBoardColumnId = (typeof ORDER_BOARD_COLUMNS)[number];

export function nextKotAdvance(status: KotStatus): {
  status: KotStatus;
  label: string;
} | null {
  if (status === "new") return { status: "preparing", label: "Start" };
  if (status === "preparing") return { status: "ready", label: "Ready" };
  if (status === "ready") return { status: "served", label: "Served" };
  return null;
}

export function summarizeItems(items: OrderTicketItem[]): string {
  if (!items.length) return "Items pending";
  const total = items.reduce((sum, item) => sum + item.qty, 0);
  const first = items[0]?.name ?? "Item";
  if (items.length === 1) return `${total}× ${first}`;
  return `${total} items · ${first} +${items.length - 1}`;
}

export function elapsedMinutes(createdAt: string, nowMs: number): number {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((nowMs - created) / 60_000));
}
