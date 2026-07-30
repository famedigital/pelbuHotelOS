import { requireDeskFinanceApi, jsonError } from "@/lib/finance-import/api-auth";
import { postExpense } from "@/lib/accounting/posting";
import { writeAuditEvent } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await requireDeskFinanceApi();
  if (auth.error) return auth.error;
  const { admin, propertyId } = auth;
  const { id: batchId } = await ctx.params;

  let body: { asDraft?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const asDraft = Boolean(body.asDraft);

  const { data: batch } = await admin
    .from("finance_import_batches")
    .select("id, kind, status")
    .eq("id", batchId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!batch) return jsonError("Batch not found.", 404);
  if (batch.status !== "review") {
    return jsonError("Batch must be in review before commit.");
  }

  if (batch.kind === "receipt") {
    const { data, error } = await admin.rpc("finance_commit_receipt_batch", {
      p_batch_id: batchId,
      p_property_id: propertyId,
      p_as_draft: asDraft,
      p_actor: "desk",
    });
    if (error) {
      console.error(error);
      return jsonError(error.message || "Receipt commit failed.", 500);
    }

    const result = data as {
      ok?: boolean;
      expense_ids?: string[];
      committed_count?: number;
      as_draft?: boolean;
      idempotent?: boolean;
    };

    if (!asDraft && Array.isArray(result.expense_ids)) {
      for (const expenseId of result.expense_ids) {
        const { data: exp } = await admin
          .from("expenses")
          .select("id, category, description, amount_btn, gst_btn, expense_date, payment_method")
          .eq("id", expenseId)
          .maybeSingle();
        if (!exp) continue;
        const posting = await postExpense(admin, propertyId, {
          id: exp.id as string,
          category: exp.category as string,
          description: exp.description as string,
          amount_btn: Number(exp.amount_btn),
          gst_btn: Number(exp.gst_btn ?? 0),
          expense_date: String(exp.expense_date),
          payment_method: String(exp.payment_method ?? "bank"),
        });
        if (posting.ok && posting.journalId) {
          await admin
            .from("expenses")
            .update({ journal_id: posting.journalId, status: "posted" })
            .eq("id", expenseId);
        }
      }
    }

    await writeAuditEvent(admin, {
      propertyId,
      entityType: "finance_import_batches",
      entityId: batchId,
      action: "receipt_batch_committed",
      summary: `Committed ${result.committed_count ?? 0} receipt expenses`,
      meta: result as Record<string, unknown>,
    });

    revalidatePath("/erp/finance/expenses");
    revalidatePath("/erp/finance");
    return NextResponse.json({ ok: true, result });
  }

  const { data, error } = await admin.rpc("finance_commit_bank_batch", {
    p_batch_id: batchId,
    p_property_id: propertyId,
    p_actor: "desk",
  });
  if (error) {
    console.error(error);
    return jsonError(error.message || "Bank commit failed.", 500);
  }

  await writeAuditEvent(admin, {
    propertyId,
    entityType: "finance_import_batches",
    entityId: batchId,
    action: "bank_batch_committed",
    summary: `Committed bank statement import batch`,
    meta: (data ?? {}) as Record<string, unknown>,
  });

  revalidatePath("/erp/finance/banking");
  revalidatePath("/erp/finance");
  return NextResponse.json({ ok: true, result: data });
}
