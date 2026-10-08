import { jsonError, requireDeskFinanceApi } from "@/lib/finance-import/api-auth";
import {
  assertPropertyScopedPath,
  uploadFinanceObject,
} from "@/lib/finance-import/storage";
import { MAX_FINANCE_UPLOAD_BYTES } from "@/lib/finance-import/types";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Accept a finance file on the desk origin and store it with the service role.
 * Browsers cannot PUT straight to the droplet storage URL (HTTP behind HTTPS).
 */
export async function PUT(request: NextRequest) {
  const auth = await requireDeskFinanceApi();
  if (auth.error) return auth.error;

  const path = request.nextUrl.searchParams.get("path")?.trim() ?? "";
  if (!path) return jsonError("Missing storage path.");

  try {
    assertPropertyScopedPath(auth.propertyId, path);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Bad storage path.");
  }

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_FINANCE_UPLOAD_BYTES) {
    return jsonError("File must be between 1 byte and 25 MB.");
  }

  const contentType =
    request.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream";

  try {
    await uploadFinanceObject(auth.admin, path, bytes, contentType);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Storage upload failed.";
    return jsonError(message, 502);
  }

  return NextResponse.json({ ok: true, path });
}
