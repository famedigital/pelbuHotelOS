import "server-only";
import type {
  RoomChargePosItem,
  RoomChargePosOrder,
} from "@/lib/folio/room-pos-orders-types";
import { KOT_LABEL } from "@/lib/kot";
import { roundBtn } from "@/lib/pricing";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type { RoomChargePosItem, RoomChargePosOrder };

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Room-charge POS tickets for a stay — item-level so front desk money can
 * verify served lines and void “not ordered / not eaten” with audit.
 */
export async function loadRoomChargePosOrders(
  admin: Admin,
  propertyId: string,
  bookingId: string,
): Promise<RoomChargePosOrder[]> {
  const { data: orders, error } = await admin
    .from("orders")
    .select(
      `id, outlet, customer_name, created_at, kot_status, total_btn,
       posted_to_folio_at, settled_at, served_at, served_by, ready_at, ready_by,
       voided_at, order_source, folio_id, booking_id,
       order_items(
         id, name_snapshot, qty, unit_price_btn, voided_at, void_reason,
         kot_status, served_at, served_by, ready_at, ready_by, line_notes, modifiers
       )`,
    )
    .eq("property_id", propertyId)
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (orders ?? []).filter((o) => {
    const source = (o.order_source as string | null) ?? "";
    const posted = Boolean(o.posted_to_folio_at);
    const roomish =
      source === "room_charge" || posted || Boolean(o.folio_id);
    return roomish;
  });

  return rows.map((o) => {
    const itemsRaw = (o.order_items as Array<Record<string, unknown>> | null) ?? [];
    const items: RoomChargePosItem[] = itemsRaw
      .map((item) => {
        const mods =
          (item.modifiers as Array<{ priceBtn?: number; qty?: number }> | null) ??
          [];
        const modUnit = mods.reduce(
          (s, m) =>
            s + Number(m.priceBtn ?? 0) * Math.max(1, Number(m.qty ?? 1)),
          0,
        );
        const qty = Math.max(1, Number(item.qty ?? 1));
        const unit = Number(item.unit_price_btn ?? 0) + modUnit;
        const voided = item.voided_at != null;
        const kot = voided
          ? "cancelled"
          : String(item.kot_status ?? o.kot_status ?? "new");
        return {
          id: item.id as string,
          orderId: o.id as string,
          name: String(item.name_snapshot ?? "Item"),
          qty,
          unitPriceBtn: roundBtn(unit),
          lineTotalBtn: voided ? 0 : roundBtn(unit * qty),
          voidedAt: (item.voided_at as string | null) ?? null,
          voidReason: (item.void_reason as string | null) ?? null,
          kotStatus: kot,
          kotLabel: KOT_LABEL[kot] ?? kot,
          servedAt: (item.served_at as string | null) ?? null,
          servedBy: (item.served_by as string | null) ?? null,
          readyAt: (item.ready_at as string | null) ?? null,
          readyBy: (item.ready_by as string | null) ?? null,
          lineNotes: (item.line_notes as string | null) ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const kot = String(o.kot_status ?? "new");
    const activeItemCount = items.filter((i) => !i.voidedAt).length;
    const hasUnservedLive = items.some(
      (i) => !i.voidedAt && i.kotStatus !== "served",
    );
    return {
      orderId: o.id as string,
      outlet: String(o.outlet ?? "cafe"),
      customerName: String(o.customer_name ?? ""),
      createdAt: String(o.created_at),
      kotStatus: kot,
      kotLabel: KOT_LABEL[kot] ?? kot,
      totalBtn: Number(o.total_btn ?? 0),
      postedToFolioAt: (o.posted_to_folio_at as string | null) ?? null,
      settledAt: (o.settled_at as string | null) ?? null,
      servedAt: (o.served_at as string | null) ?? null,
      servedBy: (o.served_by as string | null) ?? null,
      readyAt: (o.ready_at as string | null) ?? null,
      readyBy: (o.ready_by as string | null) ?? null,
      voidedAt: (o.voided_at as string | null) ?? null,
      items,
      activeItemCount,
      hasUnservedLive,
    };
  });
}
