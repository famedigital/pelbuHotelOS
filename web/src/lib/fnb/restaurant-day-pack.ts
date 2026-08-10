/**
 * Restaurant day pack + outlet flash reporting (operational, not GL).
 * Full TB/BS stay on ledger in /erp/finance/reports.
 */

import { thimphuToday } from "@/lib/erp-lists";
import { tenderMethodLabel } from "@/lib/pos-tenders";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type RestaurantDayPack = {
  businessDate: string;
  covers: number;
  ticketCount: number;
  voidCount: number;
  voidTotalBtn: number;
  salesTotalBtn: number;
  avgCheckBtn: number;
  openKotCount: number;
  byOutlet: { outlet: string; salesBtn: number; tickets: number }[];
  byTender: { method: string; label: string; amountBtn: number }[];
};

export async function buildRestaurantDayPack(
  businessDate?: string,
  admin?: Admin,
): Promise<RestaurantDayPack> {
  const client = admin ?? createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(client);
  const day = businessDate || thimphuToday();
  const dayStart = `${day}T00:00:00+06:00`;
  const dayEnd = `${day}T23:59:59.999+06:00`;

  const [{ data: orders }, { data: voids }, { data: openKots }] =
    await Promise.all([
      client
        .from("orders")
        .select(
          "id, outlet, total_btn, covers, voided_at, settled_at, order_tenders(method, amount_btn)",
        )
        .eq("property_id", propertyId)
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd),
      client
        .from("pos_voids")
        .select("amount_btn, order_id, created_at")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd),
      client
        .from("orders")
        .select("id")
        .eq("property_id", propertyId)
        .is("voided_at", null)
        .in("kot_status", ["new", "preparing", "ready"]),
    ]);

  const live = (orders ?? []).filter((o) => !o.voided_at);
  const settled = live.filter((o) => o.settled_at);
  const covers = settled.reduce((s, o) => s + Number(o.covers ?? 0), 0);
  const salesTotalBtn = roundBtn(
    settled.reduce((s, o) => s + Number(o.total_btn ?? 0), 0),
  );
  const ticketCount = settled.length;
  const avgCheckBtn =
    ticketCount > 0 ? roundBtn(salesTotalBtn / ticketCount) : 0;

  const outletMap = new Map<string, { salesBtn: number; tickets: number }>();
  for (const o of settled) {
    const key = String(o.outlet ?? "other");
    const cur = outletMap.get(key) ?? { salesBtn: 0, tickets: 0 };
    cur.salesBtn = roundBtn(cur.salesBtn + Number(o.total_btn ?? 0));
    cur.tickets += 1;
    outletMap.set(key, cur);
  }

  const tenderMap = new Map<string, number>();
  for (const o of settled) {
    const tenders = Array.isArray(o.order_tenders)
      ? o.order_tenders
      : o.order_tenders
        ? [o.order_tenders]
        : [];
    for (const t of tenders as { method: string; amount_btn: number }[]) {
      const m = t.method ?? "other";
      tenderMap.set(m, roundBtn((tenderMap.get(m) ?? 0) + Number(t.amount_btn)));
    }
  }

  const voidTotalBtn = roundBtn(
    (voids ?? []).reduce((s, v) => s + Number(v.amount_btn ?? 0), 0),
  );

  return {
    businessDate: day,
    covers,
    ticketCount,
    voidCount: voids?.length ?? 0,
    voidTotalBtn,
    salesTotalBtn,
    avgCheckBtn,
    openKotCount: openKots?.length ?? 0,
    byOutlet: [...outletMap.entries()]
      .map(([outlet, v]) => ({ outlet, ...v }))
      .sort((a, b) => b.salesBtn - a.salesBtn),
    byTender: [...tenderMap.entries()]
      .map(([method, amountBtn]) => ({
        method,
        label: tenderMethodLabel(method),
        amountBtn,
      }))
      .sort((a, b) => b.amountBtn - a.amountBtn),
  };
}
