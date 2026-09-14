import { requireDeskFinanceApi, jsonError } from "@/lib/finance-import/api-auth";
import { writeAuditEvent } from "@/lib/audit";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await requireDeskFinanceApi();
  if (auth.error) return auth.error;
  const { admin, propertyId } = auth;
  const { id } = await ctx.params;

  let body: { action?: "approve" | "retire" | "set_default" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = { action: "approve" };
  }
  const action = body.action ?? "approve";

  const { data: version, error } = await admin
    .from("finance_parser_versions")
    .select("id, script_id, status, sha256, version_label, requires_gemini")
    .eq("id", id)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error || !version) return jsonError("Parser version not found.", 404);

  if (action === "retire") {
    const { error: upErr } = await admin
      .from("finance_parser_versions")
      .update({ status: "retired", retired_at: new Date().toISOString() })
      .eq("id", id);
    if (upErr) return jsonError("Could not retire parser.", 500);
    await writeAuditEvent(admin, {
      propertyId,
      entityType: "finance_parser_versions",
      entityId: id,
      action: "parser_retired",
      summary: `Retired parser version ${id}`,
    });
    return NextResponse.json({ ok: true, status: "retired" });
  }

  if (action === "set_default") {
    if (version.status !== "approved") {
      return jsonError("Only approved parsers can be set as default.");
    }
    const { data: script } = await admin
      .from("finance_parser_scripts")
      .select("kind, bank_code")
      .eq("id", version.script_id)
      .single();
    if (!script) return jsonError("Script missing.", 404);

    if (script.bank_code) {
      await admin
        .from("finance_parser_defaults")
        .delete()
        .eq("property_id", propertyId)
        .eq("kind", script.kind)
        .eq("bank_code", script.bank_code);
    } else {
      await admin
        .from("finance_parser_defaults")
        .delete()
        .eq("property_id", propertyId)
        .eq("kind", script.kind)
        .is("bank_code", null);
    }

    const { error: defErr } = await admin.from("finance_parser_defaults").insert({
      property_id: propertyId,
      kind: script.kind,
      bank_code: script.bank_code,
      script_id: version.script_id,
      version_id: version.id,
    });
    if (defErr) {
      console.error(defErr);
      return jsonError("Could not set default parser.", 500);
    }
    return NextResponse.json({ ok: true, default: true });
  }

  // approve
  if (!["draft", "tested"].includes(version.status as string)) {
    return jsonError("Only draft/tested versions can be approved.");
  }
  const { error: apErr } = await admin
    .from("finance_parser_versions")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: "desk",
    })
    .eq("id", id);
  if (apErr) return jsonError("Could not approve parser.", 500);

  await writeAuditEvent(admin, {
    propertyId,
    entityType: "finance_parser_versions",
    entityId: id,
    action: "parser_approved",
    summary: `Approved parser ${version.version_label}`,
    meta: { sha: version.sha256, label: version.version_label },
  });

  return NextResponse.json({ ok: true, status: "approved" });
}
