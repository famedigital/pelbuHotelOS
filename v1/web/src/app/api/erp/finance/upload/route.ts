import { requireDeskFinanceApi, jsonError } from "@/lib/finance-import/api-auth";
import { createFinanceSignedUpload, financeStoragePath } from "@/lib/finance-import/storage";
import {
  ALLOWED_PARSER_MIMES,
  ALLOWED_RECEIPT_MIMES,
  MAX_FINANCE_UPLOAD_BYTES,
  normalizeDeskUploadMime,
} from "@/lib/finance-import/types";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mint a signed upload URL for private finance-private storage.
 * Large PDFs/images upload directly to Storage (bypass Server Action body limit).
 */
export async function POST(request: NextRequest) {
  const auth = await requireDeskFinanceApi();
  if (auth.error) return auth.error;
  const { admin, propertyId } = auth;

  let body: {
    kind?:
      | "receipt"
      | "statement"
      | "parser"
      | "attachment"
      | "compliance"
      | "dot_assessment";
    fileName?: string;
    mimeType?: string;
    byteSize?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const kind = body.kind ?? "receipt";
  const fileName =
    String(body.fileName ?? "").trim() || `upload-${Date.now()}.jpg`;
  const mimeType = normalizeDeskUploadMime(fileName, body.mimeType);
  const byteSize = Number(body.byteSize ?? 0);

  if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_FINANCE_UPLOAD_BYTES) {
    return jsonError("File must be between 1 byte and 25 MB.");
  }

  if (kind === "parser") {
    if (!ALLOWED_PARSER_MIMES.has(mimeType) && !fileName.toLowerCase().endsWith(".py")) {
      return jsonError("Parser uploads must be .py files.");
    }
  } else if (!ALLOWED_RECEIPT_MIMES.has(mimeType)) {
    return jsonError("Use a photo (JPG, PNG, HEIC, WebP) or a PDF.");
  }

  const folder =
    kind === "parser"
      ? "parsers"
      : kind === "statement"
        ? "statements"
        : kind === "attachment"
          ? "attachments"
          : kind === "compliance"
            ? "compliance"
            : kind === "dot_assessment"
              ? "dot_assessment"
              : "receipts";

  const path = financeStoragePath(propertyId, folder, fileName);
  try {
    const signed = await createFinanceSignedUpload(admin, path);
    return NextResponse.json({
      bucket: "finance-private",
      path: signed.path,
      signedUrl: signed.signedUrl,
      token: signed.token,
      maxBytes: MAX_FINANCE_UPLOAD_BYTES,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not create signed upload URL.";
    return jsonError(message, 500);
  }
}
