import { requireDeskFinanceApi, jsonError } from "@/lib/finance-import/api-auth";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, ctx: Ctx) {
  const auth = await requireDeskFinanceApi();
  if (auth.error) return auth.error;
  const { admin, propertyId } = auth;
  const { id } = await ctx.params;

  const { data: batch } = await admin
    .from("finance_import_batches")
    .select("id, status, attempt_count, max_attempts")
    .eq("id", id)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!batch) return jsonError("Batch not found.", 404);
  if (!["error", "uploaded", "processing"].includes(batch.status as string)) {
    return jsonError("Only error/uploaded/stuck processing batches can be retried.");
  }
  if (Number(batch.attempt_count) >= Number(batch.max_attempts)) {
    return jsonError("Max attempts reached. Create a new batch.");
  }

  const { data: updated, error } = await admin
    .from("finance_import_batches")
    .update({
      status: "queued",
      error_message: null,
      worker_id: null,
      claimed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return jsonError("Could not requeue batch.", 500);
  return NextResponse.json({ ok: true, batch: updated });
}
