import { requireDeskFinanceApi, jsonError } from "@/lib/finance-import/api-auth";
import {
  assertPropertyScopedPath,
  createFinanceSignedPreview,
} from "@/lib/finance-import/storage";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireDeskFinanceApi();
  if (auth.error) return auth.error;
  const { admin, propertyId } = auth;

  const path = request.nextUrl.searchParams.get("path")?.trim() ?? "";
  if (!path) return jsonError("path is required.");

  try {
    assertPropertyScopedPath(propertyId, path);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Invalid path.", 403);
  }

  const url = await createFinanceSignedPreview(admin, path);
  return NextResponse.json({ url, expiresIn: 600 });
}
