import { requireDeskFinanceApi, jsonError } from "@/lib/finance-import/api-auth";
import { postExpense } from "@/lib/accounting/posting";
import { writeAuditEvent } from "@/lib/audit";
import {
  normalizeCategory,
  normalizePayMethod,
  parseMoneyField,
  validateExpenseDraft,
} from "@/lib/finance-import/validation";
import { roundBtn } from "@/lib/pricing";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type RowIn = {
  id?: string;
  clientId?: string;
  expense_date?: string;
  bill_no?: string | null;
  vendor?: string | null;
  tpn?: string | null;
  description?: string;
  category?: string;
  payment_method?: string;
  amount_btn?: number;
  gst_btn?: number;
  notes?: string | null;
  reference?: string | null;
  status?: "draft" | "posted";
  receipt_path?: string | null;
  vendor_id?: string | null;
  delete?: boolean;
};
export async function POST(request: NextRequest) {
  const auth = await requireDeskFinanceApi();
  if (auth.error) return auth.error;
  const { admin, propertyId } = auth;

  let body: { rows?: RowIn[]; post?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid JSON.");
  }
  const rows = body.rows ?? [];
  if (!Array.isArray(rows) || rows.length === 0) return jsonError("rows required.");

  const forcePost = body.post === true;
  const saved: Array<{ clientId?: string; id: string }> = [];
  const errors: Array<{ clientId?: string; id?: string; error: string }> = [];

  for (const row of rows) {
    try {
      if (row.delete && row.id) {
        const { data: existing } = await admin
          .from("expenses")
          .select("id, status, journal_id")
          .eq("id", row.id)
          .eq("property_id", propertyId)
          .maybeSingle();
        if (!existing) throw new Error("Expense not found.");
        if (existing.journal_id || existing.status === "posted") {
          throw new Error("Posted expenses cannot be deleted — void instead.");
        }
        await admin.from("expense_attachments").delete().eq("expense_id", row.id);
        await admin.from("expenses").delete().eq("id", row.id);
        saved.push({ clientId: row.clientId, id: row.id });
        continue;
      }

      const category = normalizeCategory(row.category);
      const paymentMethod = normalizePayMethod(row.payment_method);
      const amountBtn = parseMoneyField(row.amount_btn, "Amount", false);
      const gstBtn = parseMoneyField(row.gst_btn ?? 0, "GST", true);
      const description = String(row.description ?? "").trim();
      const expenseDate = String(row.expense_date ?? "").trim();
      const status = forcePost ? "posted" : (row.status ?? "draft");

      const validation = validateExpenseDraft({
        expense_date: expenseDate,
        description,
        amount_btn: amountBtn,
        gst_btn: gstBtn,
        category,
      });
      if (validation.length) {
        throw new Error(`Validation: ${validation.join(", ")}`);
      }

      const payload = {
        property_id: propertyId,
        category,
        description,
        amount_btn: amountBtn,
        gst_btn: gstBtn,
        expense_date: expenseDate,
        vendor: row.vendor?.trim() || null,
        payment_method: paymentMethod,
        reference: row.reference?.trim() || row.bill_no?.trim() || null,
        notes: row.notes?.trim() || null,
        tpn: row.tpn?.trim() || null,
        bill_no: row.bill_no?.trim() || null,
        vendor_id: row.vendor_id?.trim() || null,
        gross_btn: roundBtn(amountBtn),
        status: status === "posted" ? "posted" : "draft",
      };

      let expenseId = row.id;
      if (expenseId) {
        const { data: existing } = await admin
          .from("expenses")
          .select("id, status, journal_id")
          .eq("id", expenseId)
          .eq("property_id", propertyId)
          .maybeSingle();
        if (!existing) throw new Error("Expense not found.");
        if (existing.journal_id) {
          throw new Error("Posted journaled expenses are immutable — create an adjusting entry.");
        }
        const { error } = await admin.from("expenses").update(payload).eq("id", expenseId);
        if (error) throw new Error(error.message);
      } else {
        const { data: created, error } = await admin
          .from("expenses")
          .insert(payload)
          .select("id")
          .single();
        if (error || !created) throw new Error(error?.message ?? "Insert failed.");
        expenseId = created.id as string;
      }

      if (row.receipt_path) {
        const { data: existingAtt } = await admin
          .from("expense_attachments")
          .select("id")
          .eq("expense_id", expenseId)
          .eq("storage_path", row.receipt_path)
          .maybeSingle();
        if (!existingAtt) {
          await admin.from("expense_attachments").insert({
            property_id: propertyId,
            expense_id: expenseId,
            storage_path: row.receipt_path,
            file_name: row.receipt_path.split("/").pop() ?? "receipt",
            mime_type: "application/octet-stream",
            byte_size: 1,
            sha256: "pending",
            sort_order: 0,
            created_by: "desk",
          });
        }
      }

      if (payload.status === "posted") {
        const posting = await postExpense(admin, propertyId, {
          id: expenseId!,
          category,
          description,
          amount_btn: amountBtn,
          gst_btn: gstBtn,
          expense_date: expenseDate,
          payment_method: paymentMethod,
        });
        if (posting.ok && posting.journalId) {
          await admin
            .from("expenses")
            .update({ journal_id: posting.journalId, status: "posted" })
            .eq("id", expenseId);
        } else if (!posting.ok) {
          await admin.from("expenses").update({ status: "draft" }).eq("id", expenseId);
          throw new Error(posting.error ?? "Ledger posting failed.");
        }
      }

      saved.push({ clientId: row.clientId, id: expenseId! });
    } catch (e) {
      errors.push({
        clientId: row.clientId,
        id: row.id,
        error: e instanceof Error ? e.message : "Failed",
      });
    }
  }

  await writeAuditEvent(admin, {
    propertyId,
    entityType: "expenses",
    entityId: propertyId,
    action: "expenses_bulk_save",
    summary: `Bulk saved ${saved.length} expenses (${errors.length} errors)`,
    meta: { saved: saved.length, errors: errors.length, post: forcePost },
  });

  revalidatePath("/erp/finance/expenses");
  revalidatePath("/erp/finance");

  return NextResponse.json({
    ok: errors.length === 0,
    saved,
    errors,
  });
}
