import { requireDeskFinanceApi, jsonError } from "@/lib/finance-import/api-auth";
import {
  normalizeCategory,
  normalizePayMethod,
  parseMoneyField,
} from "@/lib/finance-import/validation";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await requireDeskFinanceApi();
  if (auth.error) return auth.error;
  const { admin, propertyId } = auth;
  const { id: batchId } = await ctx.params;

  const { data: batch } = await admin
    .from("finance_import_batches")
    .select("id, kind, status")
    .eq("id", batchId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!batch) return jsonError("Batch not found.", 404);
  if (!["review", "error"].includes(batch.status as string)) {
    return jsonError("Rows can only be edited while the batch is in review.");
  }

  let body: { rows?: Array<Record<string, unknown>> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid JSON body.");
  }
  const rows = body.rows ?? [];
  if (!Array.isArray(rows) || rows.length === 0) return jsonError("rows required.");

  if (batch.kind === "receipt") {
    for (const row of rows) {
      const rowId = String(row.id ?? "");
      if (!rowId) continue;
      const patch: Record<string, unknown> = {
        edited_at: new Date().toISOString(),
        edited_by: "desk",
      };
      if ("selected" in row) patch.selected = Boolean(row.selected);
      if ("bill_no" in row) patch.bill_no = row.bill_no ?? null;
      if ("vendor" in row) patch.vendor = row.vendor ?? null;
      if ("tpn" in row) patch.tpn = row.tpn ?? null;
      if ("expense_date" in row) patch.expense_date = row.expense_date ?? null;
      if ("category" in row) patch.category = normalizeCategory(String(row.category ?? "other"));
      if ("description" in row) patch.description = row.description ?? null;
      if ("payment_method" in row) {
        patch.payment_method = normalizePayMethod(String(row.payment_method ?? "bank"));
      }
      if ("amount_btn" in row) patch.amount_btn = parseMoneyField(row.amount_btn, "Amount");
      if ("gst_btn" in row) patch.gst_btn = parseMoneyField(row.gst_btn, "GST", true);
      if ("net_btn" in row) patch.net_btn = parseMoneyField(row.net_btn, "Net", true);

      const { error } = await admin
        .from("finance_staged_receipt_rows")
        .update(patch)
        .eq("id", rowId)
        .eq("batch_id", batchId)
        .eq("property_id", propertyId);
      if (error) {
        console.error(error);
        return jsonError(`Failed updating receipt row ${rowId}.`, 500);
      }
    }
  } else {
    for (const row of rows) {
      const rowId = String(row.id ?? "");
      if (!rowId) continue;
      const patch: Record<string, unknown> = {
        edited_at: new Date().toISOString(),
        edited_by: "desk",
      };
      if ("selected" in row) patch.selected = Boolean(row.selected);
      if ("txn_date" in row) patch.txn_date = row.txn_date ?? null;
      if ("value_date" in row) patch.value_date = row.value_date ?? null;
      if ("description" in row) patch.description = row.description ?? null;
      if ("debit_btn" in row) patch.debit_btn = parseMoneyField(row.debit_btn, "Debit", true);
      if ("credit_btn" in row) patch.credit_btn = parseMoneyField(row.credit_btn, "Credit", true);
      if ("balance_btn" in row) {
        patch.balance_btn =
          row.balance_btn === null || row.balance_btn === ""
            ? null
            : parseMoneyField(row.balance_btn, "Balance", true);
      }
      if ("reference" in row) patch.reference = row.reference ?? null;
      if ("category" in row) patch.category = row.category ?? null;
      if ("merchant" in row) patch.merchant = row.merchant ?? null;

      const { error } = await admin
        .from("finance_staged_bank_rows")
        .update(patch)
        .eq("id", rowId)
        .eq("batch_id", batchId)
        .eq("property_id", propertyId);
      if (error) {
        console.error(error);
        return jsonError(`Failed updating bank row ${rowId}.`, 500);
      }
    }
  }

  return NextResponse.json({ ok: true, updated: rows.length });
}
