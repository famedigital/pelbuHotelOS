import { requireWorkerAuth, jsonError } from "@/lib/finance-import/api-auth";
import {
  createFinanceSignedPreview,
  downloadFinanceObject,
} from "@/lib/finance-import/storage";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Worker claims the next queued import batch.
 * Returns signed download URLs for source + parser script (if any).
 * Field names are snake_case for the Python worker contract.
 */
export async function POST(request: NextRequest) {
  const auth = requireWorkerAuth(request);
  if (auth.error) return auth.error;
  const { admin } = auth;

  let body: { workerId?: string; worker_id?: string; kinds?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const workerId = String(body.workerId ?? body.worker_id ?? "worker").slice(0, 120);
  const kinds =
    Array.isArray(body.kinds) && body.kinds.length ? body.kinds : ["receipt", "bank"];

  const { data: claimed, error } = await admin.rpc("finance_claim_import_batch", {
    p_worker_id: workerId,
    p_kinds: kinds,
  });

  if (error) {
    console.error("claim failed", error);
    return jsonError(error.message || "Claim failed.", 500);
  }
  if (!claimed || !(claimed as { id?: string }).id) {
    return NextResponse.json({ batch: null });
  }

  const batch = claimed as {
    id: string;
    property_id: string;
    kind: string;
    bank_code: string | null;
    account_label: string | null;
    source_storage_path: string;
    source_filename: string;
    source_mime: string;
    source_sha256: string;
    parser_version_id: string | null;
    parser_sha256: string | null;
    parser_label: string | null;
    gemini_model: string | null;
    attempt_count: number;
  };

  const sourceUrl = await createFinanceSignedPreview(
    admin,
    batch.source_storage_path,
    60 * 30,
  );

  let parser: Record<string, unknown> | null = null;

  if (batch.parser_version_id) {
    const { data: ver } = await admin
      .from("finance_parser_versions")
      .select("id, sha256, storage_path, requires_gemini, gemini_model, status")
      .eq("id", batch.parser_version_id)
      .maybeSingle();
    if (ver && ver.status === "approved") {
      if (batch.parser_sha256 && ver.sha256 !== batch.parser_sha256) {
        await admin
          .from("finance_import_batches")
          .update({
            status: "error",
            error_message: "Parser SHA mismatch — refusing stale claim.",
            finished_at: new Date().toISOString(),
          })
          .eq("id", batch.id);
        return jsonError("Parser SHA mismatch.", 409);
      }
      const downloadUrl = await createFinanceSignedPreview(
        admin,
        ver.storage_path as string,
        60 * 30,
      );
      parser = {
        version_id: ver.id,
        sha256: ver.sha256,
        storage_path: ver.storage_path,
        requires_gemini: Boolean(ver.requires_gemini),
        gemini_model: (ver.gemini_model as string) || batch.gemini_model,
        script_download_url: downloadUrl,
        downloadUrl,
        is_builtin: false,
        source: "uploaded",
      };
    }
  }

  const builtinMarker =
    batch.parser_sha256?.startsWith("builtin:")
      ? batch.parser_sha256
      : !parser && batch.kind === "receipt"
        ? "builtin:gemini_receipt"
        : !parser && batch.bank_code
          ? `builtin:${batch.bank_code}`
          : null;

  if (builtinMarker && !parser) {
    const key =
      builtinMarker === "builtin:gemini_receipt" ||
      builtinMarker.endsWith("receipt")
        ? "gemini_receipt"
        : `bank_${batch.bank_code ?? "bob"}`;
    parser = {
      is_builtin: true,
      builtin_key: key,
      sha256: builtinMarker,
      requires_gemini: batch.kind === "receipt",
      gemini_model: batch.gemini_model,
    };
  }

  return NextResponse.json({
    batch: {
      id: batch.id,
      property_id: batch.property_id,
      kind: batch.kind,
      bank_code: batch.bank_code,
      account_label: batch.account_label,
      source_filename: batch.source_filename,
      source_mime: batch.source_mime,
      source_sha256: batch.source_sha256,
      source_storage_path: batch.source_storage_path,
      gemini_model:
        batch.gemini_model || process.env.GEMINI_MODEL || "gemini-2.0-flash",
      attempt_count: batch.attempt_count,
      parser_label: batch.parser_label,
      parser_sha256: batch.parser_sha256,
      // camelCase aliases for TS clients
      propertyId: batch.property_id,
      bankCode: batch.bank_code,
      sourceUrl,
    },
    parser,
    source_download_url: sourceUrl,
    // Gemini key is NEVER returned — worker reads GEMINI_API_KEY from its own env
  });
}

export async function GET(request: NextRequest) {
  const auth = requireWorkerAuth(request);
  if (auth.error) return auth.error;
  const path = new URL(request.url).searchParams.get("path");
  if (!path) return jsonError("path required");
  const buf = await downloadFinanceObject(auth.admin, path);
  return new NextResponse(new Uint8Array(buf), {
    headers: { "content-type": "application/octet-stream" },
  });
}
