import "server-only";
import type { BitsGstPack } from "@/lib/gst/bits-pack-shared";
import { roundBtn } from "@/lib/pricing";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type { BitsGstPack } from "@/lib/gst/bits-pack-shared";

export function monthBounds(ym: string): { from: string; to: string; periodMonth: string } {
  const [y, m] = ym.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { from, to: next, periodMonth: from };
}

/** Compute BITS portal fields A–E for a calendar month. */
export async function buildBitsGstPack(
  admin: Admin,
  propertyId: string,
  ym: string,
): Promise<BitsGstPack> {
  const { from, to, periodMonth } = monthBounds(ym);

  const [{ data: folioLines }, { data: expenses }] = await Promise.all([
    admin
      .from("folio_lines")
      .select(
        "description, amount_btn, gst_btn, total_btn, gst_applicable, created_at, folios!inner(property_id)",
      )
      .eq("folios.property_id", propertyId)
      .eq("status", "posted")
      .gte("created_at", `${from}T00:00:00`)
      .lt("created_at", `${to}T00:00:00`)
      .limit(5000),
    admin
      .from("expenses")
      .select(
        "expense_date, vendor, tpn, description, amount_btn, gst_btn, status, vendor_id, accounting_vendors(tax_id)",
      )
      .eq("property_id", propertyId)
      .neq("status", "void")
      .gte("expense_date", from)
      .lt("expense_date", to)
      .limit(2000),
  ]);

  let fieldA = 0;
  let fieldB = 0;
  const incomeSchedule: BitsGstPack["incomeSchedule"] = [];

  for (const l of folioLines ?? []) {
    const gst = Number(l.gst_btn ?? 0);
    const total = Number(l.total_btn ?? 0);
    const base = l.gst_applicable ? Number(l.amount_btn ?? 0) : 0;
    fieldA = roundBtn(fieldA + base);
    fieldB = roundBtn(fieldB + gst);
    if (gst > 0 || base > 0) {
      incomeSchedule.push({
        date: String(l.created_at).slice(0, 10),
        description: String(l.description ?? "Sale"),
        taxableBase: base,
        gst,
        total,
      });
    }
  }

  let fieldC = 0;
  let fieldD = 0;
  const expenseSchedule: BitsGstPack["expenseSchedule"] = [];

  for (const e of expenses ?? []) {
    const total = Number(e.amount_btn);
    const gst = Number(e.gst_btn ?? 0);
    const base = Math.max(0, total - gst);
    fieldC = roundBtn(fieldC + base);
    fieldD = roundBtn(fieldD + gst);
    const vendorRow = e.accounting_vendors as { tax_id?: string } | null;
    expenseSchedule.push({
      date: String(e.expense_date),
      vendor: String(e.vendor ?? ""),
      tpn: String(e.tpn ?? vendorRow?.tax_id ?? ""),
      description: String(e.description),
      taxableBase: base,
      gst,
      total,
    });
  }

  const fieldE = roundBtn(fieldB - fieldD);

  return {
    periodMonth,
    fieldA,
    fieldB,
    fieldC,
    fieldD,
    fieldE,
    incomeSchedule,
    expenseSchedule,
  };
}
