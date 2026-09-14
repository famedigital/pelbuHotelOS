import { requireDeskFinanceApi, geminiIntegrationStatus, jsonError } from "@/lib/finance-import/api-auth";
import { assertPropertyScopedPath } from "@/lib/finance-import/storage";
import { sha256Hex } from "@/lib/finance-import/validation";
import { downloadFinanceObject } from "@/lib/finance-import/storage";
import { writeAuditEvent } from "@/lib/audit";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireDeskFinanceApi();
  if (auth.error) return auth.error;
  const { admin, propertyId } = auth;

  const [{ data: scripts }, { data: defaults }, { data: versions }] = await Promise.all([
    admin
      .from("finance_parser_scripts")
      .select("id, kind, bank_code, name, description, is_builtin, default_for_kind, created_at")
      .eq("property_id", propertyId)
      .order("kind")
      .order("name"),
    admin
      .from("finance_parser_defaults")
      .select("kind, bank_code, script_id, version_id")
      .eq("property_id", propertyId),
    admin
      .from("finance_parser_versions")
      .select(
        "id, script_id, version_label, version_no, sha256, status, requires_gemini, gemini_model, tested_at, approved_at, created_at, file_name, byte_size",
      )
      .eq("property_id", propertyId)
      .order("version_no", { ascending: false }),
  ]);

  const versionsByScript = new Map<string, typeof versions>();
  for (const v of versions ?? []) {
    const list = versionsByScript.get(v.script_id as string) ?? [];
    list.push(v);
    versionsByScript.set(v.script_id as string, list);
  }

  const items = (scripts ?? []).map((s) => {
    const vers = versionsByScript.get(s.id as string) ?? [];
    const latest = vers[0] ?? null;
    return {
      ...s,
      latest_version: latest
        ? {
            id: latest.id,
            version_label: latest.version_label,
            version_no: latest.version_no,
            sha256: latest.sha256,
            status: latest.status,
            requires_gemini: latest.requires_gemini,
            gemini_model: latest.gemini_model,
            tested_at: latest.tested_at,
            approved_at: latest.approved_at,
            created_at: latest.created_at,
            file_name: latest.file_name,
            byte_size: latest.byte_size,
          }
        : null,
      versions: vers,
    };
  });

  return NextResponse.json({
    scripts: items,
    defaults: defaults ?? [],
    integration: {
      gemini: geminiIntegrationStatus(),
      worker: {
        secretConfigured: Boolean(process.env.FINANCE_WORKER_SECRET?.trim()),
      },
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireDeskFinanceApi();
  if (auth.error) return auth.error;
  const { admin, propertyId } = auth;

  let body: {
    kind?: "receipt" | "bank";
    bankCode?: string | null;
    name?: string;
    description?: string;
    storagePath?: string;
    fileName?: string;
    versionLabel?: string;
    requiresGemini?: boolean;
    geminiModel?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const kind = body.kind;
  const name = String(body.name ?? "").trim();
  const storagePath = String(body.storagePath ?? "").trim();
  const fileName = String(body.fileName ?? "").trim() || "parser.py";
  const versionLabel = String(body.versionLabel ?? "1.0.0").trim() || "1.0.0";

  if (kind !== "receipt" && kind !== "bank") return jsonError("kind must be receipt or bank.");
  if (!name) return jsonError("name is required.");
  if (!storagePath) return jsonError("storagePath is required.");
  if (kind === "bank" && !body.bankCode) return jsonError("bankCode is required for bank parsers.");

  try {
    assertPropertyScopedPath(propertyId, storagePath);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Invalid path.", 403);
  }

  const bytes = await downloadFinanceObject(admin, storagePath);
  const sha = sha256Hex(bytes);
  const requiresGemini = Boolean(body.requiresGemini) || kind === "receipt";

  let scriptId: string;
  const { data: existing } = await admin
    .from("finance_parser_scripts")
    .select("id")
    .eq("property_id", propertyId)
    .eq("kind", kind)
    .eq("name", name)
    .maybeSingle();

  if (existing?.id) {
    scriptId = existing.id as string;
  } else {
    const { data: created, error } = await admin
      .from("finance_parser_scripts")
      .insert({
        property_id: propertyId,
        kind,
        bank_code: kind === "bank" ? String(body.bankCode).toLowerCase() : null,
        name,
        description: body.description?.trim() || null,
        is_builtin: false,
        created_by: "desk",
      })
      .select("id")
      .single();
    if (error || !created) {
      console.error("parser script insert", error);
      return jsonError("Could not create parser script.", 500);
    }
    scriptId = created.id as string;
  }

  const { data: lastVer } = await admin
    .from("finance_parser_versions")
    .select("version_no")
    .eq("script_id", scriptId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  const versionNo = Number(lastVer?.version_no ?? 0) + 1;

  const { data: version, error: verErr } = await admin
    .from("finance_parser_versions")
    .insert({
      property_id: propertyId,
      script_id: scriptId,
      version_label: versionLabel,
      version_no: versionNo,
      sha256: sha,
      storage_path: storagePath,
      file_name: fileName,
      byte_size: bytes.byteLength,
      requires_gemini: requiresGemini,
      gemini_model: requiresGemini
        ? body.geminiModel?.trim() || geminiIntegrationStatus().model
        : null,
      status: "draft",
      created_by: "desk",
    })
    .select("id, version_no, sha256, status")
    .single();

  if (verErr || !version) {
    console.error("parser version insert", verErr);
    return jsonError(
      verErr?.message?.includes("duplicate")
        ? "This exact script SHA was already uploaded for this parser."
        : "Could not save parser version.",
      400,
    );
  }

  await writeAuditEvent(admin, {
    propertyId,
    entityType: "finance_parser_versions",
    entityId: version.id as string,
    action: "parser_version_uploaded",
    summary: `Uploaded parser version ${versionNo} (${sha.slice(0, 12)})`,
    meta: { scriptId, sha, versionNo },
  });

  return NextResponse.json({ ok: true, scriptId, version });
}
