import "server-only";

import type { PosPaidReceiptData } from "@/components/erp/pos/PosPaidReceipt";
import { normalizePartyName } from "@/lib/pos-training";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export async function loadPosOrderReceiptData(
  admin: Admin,
  orderId: string,
): Promise<{
  order: PosPaidReceiptData;
  propertyId: string;
} | null> {
  const { data: row } = await admin
    .from("orders")
    .select(
      `id, property_id, outlet, customer_name, phone, notes, subtotal_btn, service_charge_btn, gst_btn, total_btn,
       created_at, settled_at, voided_at, folio_id, table_id, covers,
       order_items(name_snapshot, qty, unit_price_btn, line_notes, voided_at),
       order_tenders(method, amount_btn, reference),
       dining_tables(name)`,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!row || row.voided_at) return null;

  const tableJoin = row.dining_tables as
    | { name?: string }
    | { name?: string }[]
    | null;
  const tableName = Array.isArray(tableJoin)
    ? (tableJoin[0]?.name ?? null)
    : (tableJoin?.name ?? null);

  const lines = (
    (row.order_items as
      | {
          name_snapshot: string;
          qty: number;
          unit_price_btn: number;
          line_notes: string | null;
          voided_at: string | null;
        }[]
      | null) ?? []
  )
    .filter((line) => !line.voided_at)
    .map((line) => {
      const qty = Number(line.qty);
      const unit = Number(line.unit_price_btn);
      return {
        name: line.name_snapshot,
        qty,
        unitPriceBtn: unit,
        lineTotalBtn: Math.round(qty * unit * 100) / 100,
        notes: line.line_notes ?? null,
      };
    });

  const tenders = (
    (row.order_tenders as
      | { method: string; amount_btn: number; reference: string | null }[]
      | null) ?? []
  ).map((t) => ({
    method: t.method,
    amountBtn: Number(t.amount_btn),
    reference: t.reference ?? null,
  }));

  return {
    propertyId: row.property_id as string,
    order: {
      orderId: row.id as string,
      outlet: (row.outlet as string) ?? "outlet",
      customerName: normalizePartyName(row.customer_name as string | null),
      phone: (row.phone as string | null) ?? null,
      tableName,
      covers: row.covers == null ? null : Number(row.covers),
      createdAt: row.created_at as string,
      settledAt: (row.settled_at as string | null) ?? null,
      subtotalBtn: Number(row.subtotal_btn ?? 0),
      serviceChargeBtn: Number(row.service_charge_btn ?? 0),
      gstBtn: Number(row.gst_btn ?? 0),
      totalBtn: Number(row.total_btn ?? 0),
      notes: (row.notes as string | null) ?? null,
      lines,
      tenders,
      folioId: (row.folio_id as string | null) ?? null,
      voidedAt: (row.voided_at as string | null) ?? null,
    },
  };
}
