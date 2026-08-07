/** Client-safe types for room-charge POS detail on folio / stay money. */

export type RoomChargePosItem = {
  id: string;
  orderId: string;
  name: string;
  qty: number;
  unitPriceBtn: number;
  lineTotalBtn: number;
  voidedAt: string | null;
  voidReason: string | null;
  kotStatus: string;
  kotLabel: string;
  servedAt: string | null;
  servedBy: string | null;
  readyAt: string | null;
  readyBy: string | null;
  lineNotes: string | null;
};

export type RoomChargePosOrder = {
  orderId: string;
  outlet: string;
  customerName: string;
  createdAt: string;
  kotStatus: string;
  kotLabel: string;
  totalBtn: number;
  postedToFolioAt: string | null;
  settledAt: string | null;
  servedAt: string | null;
  servedBy: string | null;
  readyAt: string | null;
  readyBy: string | null;
  voidedAt: string | null;
  items: RoomChargePosItem[];
  /** Live lines not voided — guest still billed for these. */
  activeItemCount: number;
  /** True when any live line is not yet marked served. */
  hasUnservedLive: boolean;
};
