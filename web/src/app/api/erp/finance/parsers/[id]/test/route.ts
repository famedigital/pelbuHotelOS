import { requireDeskFinanceApi, jsonError } from "@/lib/finance-import/api-auth";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Mark a parser version as tested (desk-side bookkeeping).
 * Full sandbox execution happens in the finance-parser-worker;
 * this endpoint records a manual/sample test result from the desk.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await requireDeskFinanceApi();
  if (auth.error) return auth.error;
  const { admin, propertyId } = auth;
  const { id } = await ctx.params;

  let body: { ok?: boolean; message?: string; sampleRowCount?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = { ok: true };
  }

  const { data: version } = await admin
    .from("finance_parser_versions")
    .select("id, status")
    .eq("id", id)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!version) return jsonError("Parser version not found.", 404);
  if (version.status === "retired") return jsonError("Cannot test a retired parser.");

  const testResult = {
    ok: body.ok !== false,
    message: body.message ?? "Marked tested from Settings (run worker sample for full sandbox).",
    sampleRowCount: body.sampleRowCount ?? 0,
    at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("finance_parser_versions")
    .update({
      status: testResult.ok ? "tested" : "draft",
      test_result: testResult,
      tested_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return jsonError("Could not save test result.", 500);
  return NextResponse.json({ ok: true, testResult });
}
