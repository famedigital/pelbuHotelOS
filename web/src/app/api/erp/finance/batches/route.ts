import { requireDeskFinanceApi, geminiIntegrationStatus, jsonError } from "@/lib/finance-import/api-auth";
import { assertPropertyScopedPath } from "@/lib/finance-import/storage";
import { writeAuditEvent } from "@/lib/audit";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireDeskFinanceApi();
  if (auth.error) return auth.error;
  const { admin, propertyId } = auth;
  const kind = request.nextUrl.searchParams.get("kind");
  const status = request.nextUrl.searchParams.get("status");
  const id = request.nextUrl.searchParams.get("id");

  if (id) {
    const { data: batch, error } = await admin
      .from("finance_import_batches")
      .select("*")
      .eq("id", id)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (error || !batch) return jsonError("Batch not found.", 404);

    if (batch.kind === "receipt") {
      const { data: rows } = await admin
        .from("finance_staged_receipt_rows")
        .select("*")
        .eq("batch_id", id)
        .order("row_no");
      return NextResponse.json({ batch, rows: rows ?? [] });
    }
    const { data: rows } = await admin
      .from("finance_staged_bank_rows")
      .select("*")
      .eq("batch_id", id)
      .order("row_no");
    return NextResponse.json({ batch, rows: rows ?? [] });
  }

  let q = admin
    .from("finance_import_batches")
    .select(
      "id, kind, bank_code, account_label, source_filename, status, parser_label, row_count, committed_count, error_message, created_at, updated_at",
    )
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (kind === "receipt" || kind === "bank") q = q.eq("kind", kind);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return jsonError("Could not list batches.", 500);
  return NextResponse.json({ batches: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireDeskFinanceApi();
  if (auth.error) return auth.error;
  const { admin, propertyId } = auth;

  let body: {
    kind?: "receipt" | "bank";
    bankCode?: string | null;
    accountLabel?: string | null;
    storagePath?: string;
    fileName?: string;
    mimeType?: string;
    sha256?: string;
    byteSize?: number;
    parserVersionId?: string | null;
    queue?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const kind = body.kind;
  const storagePath = String(body.storagePath ?? "").trim();
  const fileName = String(body.fileName ?? "").trim();
  const mimeType = String(body.mimeType ?? "").trim();
  const sha256 = String(body.sha256 ?? "").trim().toLowerCase();
  const byteSize = Number(body.byteSize ?? 0);

  if (kind !== "receipt" && kind !== "bank") return jsonError("kind required.");
  if (!storagePath || !fileName || !mimeType || !sha256 || byteSize <= 0) {
    return jsonError("storagePath, fileName, mimeType, sha256, byteSize required.");
  }
  if (kind === "bank" && !body.bankCode) return jsonError("bankCode required for bank imports.");

  try {
    assertPropertyScopedPath(propertyId, storagePath);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Invalid path.", 403);
  }

  const { data: dup } = await admin
    .from("finance_import_batches")
    .select("id, status")
    .eq("property_id", propertyId)
    .eq("kind", kind)
    .eq("source_sha256", sha256)
    .neq("status", "cancelled")
    .maybeSingle();
  if (dup?.id) {
    return jsonError(`This file was already imported (batch ${dup.id}, status ${dup.status}).`, 409);
  }

  let parserScriptId: string | null = null;
  let parserVersionId: string | null = body.parserVersionId ?? null;
  let parserSha: string | null = null;
  let parserLabel: string | null = null;
  let requiresGemini = kind === "receipt";
  let geminiModel: string | null = null;

  if (parserVersionId) {
    const { data: ver } = await admin
      .from("finance_parser_versions")
      .select("id, script_id, sha256, status, version_label, requires_gemini, gemini_model, finance_parser_scripts(name, kind, bank_code, is_builtin)")
      .eq("id", parserVersionId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!ver || ver.status !== "approved") {
      // Allow builtin placeholder versions that may not exist yet — resolve default
      const builtinOk = await resolveDefaultParser(admin, propertyId, kind, body.bankCode ?? null);
      if (!builtinOk) return jsonError("Select an approved parser version.");
      parserScriptId = builtinOk.scriptId;
      parserVersionId = builtinOk.versionId;
      parserSha = builtinOk.sha;
      parserLabel = builtinOk.label;
      requiresGemini = builtinOk.requiresGemini;
      geminiModel = builtinOk.geminiModel;
    } else {
      const script = ver.finance_parser_scripts as unknown as {
        name: string;
        kind: string;
        is_builtin: boolean;
      } | null;
      parserScriptId = ver.script_id as string;
      parserSha = ver.sha256 as string;
      parserLabel = `${script?.name ?? "parser"}@${ver.version_label}`;
      requiresGemini = Boolean(ver.requires_gemini);
      geminiModel = (ver.gemini_model as string) || geminiIntegrationStatus().model;
    }
  } else {
    const def = await resolveDefaultParser(admin, propertyId, kind, body.bankCode ?? null);
    if (def) {
      parserScriptId = def.scriptId;
      parserVersionId = def.versionId;
      parserSha = def.sha;
      parserLabel = def.label;
      requiresGemini = def.requiresGemini;
      geminiModel = def.geminiModel;
    } else if (kind === "receipt") {
      parserLabel = "builtin:gemini_receipt";
      parserSha = "builtin:gemini_receipt";
      requiresGemini = true;
      geminiModel = geminiIntegrationStatus().model;
    } else {
      parserLabel = `builtin:${String(body.bankCode).toLowerCase()}`;
      parserSha = parserLabel;
      requiresGemini = false;
    }
  }

  if (requiresGemini && !geminiIntegrationStatus().configured) {
    return jsonError(
      "GEMINI_API_KEY is not configured on the server. Add it to the worker/Vercel env before queuing receipt extraction.",
      503,
    );
  }

  const queue = body.queue !== false;
  const { data: batch, error } = await admin
    .from("finance_import_batches")
    .insert({
      property_id: propertyId,
      kind,
      bank_code: kind === "bank" ? String(body.bankCode).toLowerCase() : null,
      account_label: body.accountLabel?.trim() || null,
      source_filename: fileName,
      source_mime: mimeType,
      source_sha256: sha256,
      source_storage_path: storagePath,
      source_byte_size: byteSize,
      parser_script_id: parserScriptId,
      parser_version_id: parserVersionId,
      parser_sha256: parserSha,
      parser_label: parserLabel,
      status: queue ? "queued" : "uploaded",
      gemini_model: geminiModel,
      created_by: "desk",
    })
    .select("*")
    .single();

  if (error || !batch) {
    console.error("batch insert", error);
    return jsonError(error?.message ?? "Could not create import batch.", 500);
  }

  await writeAuditEvent(admin, {
    propertyId,
    entityType: "finance_import_batches",
    entityId: batch.id as string,
    action: "import_batch_created",
    summary: `Created ${kind} import batch for ${fileName}`,
    meta: { kind, sha256, queue },
  });

  return NextResponse.json({ ok: true, batch });
}

async function resolveDefaultParser(
  admin: ReturnType<typeof import("@/lib/supabase/admin").createSupabaseAdminClient>,
  propertyId: string,
  kind: "receipt" | "bank",
  bankCode: string | null,
): Promise<{
  scriptId: string;
  versionId: string | null;
  sha: string;
  label: string;
  requiresGemini: boolean;
  geminiModel: string | null;
} | null> {
  let defQ = admin
    .from("finance_parser_defaults")
    .select("script_id, version_id")
    .eq("property_id", propertyId)
    .eq("kind", kind);
  defQ = bankCode ? defQ.eq("bank_code", bankCode) : defQ.is("bank_code", null);
  const { data: def } = await defQ.maybeSingle();
  if (def?.version_id) {
    const { data: ver } = await admin
      .from("finance_parser_versions")
      .select("id, script_id, sha256, version_label, requires_gemini, gemini_model, status")
      .eq("id", def.version_id)
      .maybeSingle();
    if (ver?.status === "approved") {
      return {
        scriptId: ver.script_id as string,
        versionId: ver.id as string,
        sha: ver.sha256 as string,
        label: ver.version_label as string,
        requiresGemini: Boolean(ver.requires_gemini),
        geminiModel: (ver.gemini_model as string) || geminiIntegrationStatus().model,
      };
    }
  }

  // Fall back to builtin script row without version (worker uses built-in adapters)
  let scriptQ = admin
    .from("finance_parser_scripts")
    .select("id, name")
    .eq("property_id", propertyId)
    .eq("kind", kind)
    .eq("is_builtin", true);
  scriptQ = bankCode ? scriptQ.eq("bank_code", bankCode) : scriptQ.is("bank_code", null);
  const { data: script } = await scriptQ.maybeSingle();
  if (!script) return null;
  return {
    scriptId: script.id as string,
    versionId: null,
    sha: `builtin:${kind}:${bankCode ?? "receipt"}`,
    label: script.name as string,
    requiresGemini: kind === "receipt",
    geminiModel: kind === "receipt" ? geminiIntegrationStatus().model : null,
  };
}
