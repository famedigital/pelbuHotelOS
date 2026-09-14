import "server-only";

import {
  FINANCE_PRIVATE_BUCKET,
  MAX_FINANCE_UPLOAD_BYTES,
} from "@/lib/finance-import/types";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export function financeStoragePath(
  propertyId: string,
  kind:
    | "receipts"
    | "statements"
    | "parsers"
    | "raw"
    | "attachments"
    | "compliance"
    | "dot_assessment",
  fileName: string,
): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180);
  return `${propertyId}/${kind}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safe}`;
}

export async function createFinanceSignedUpload(
  admin: Admin,
  path: string,
  upsert = false,
): Promise<{ signedUrl: string; token: string; path: string }> {
  const { data, error } = await admin.storage
    .from(FINANCE_PRIVATE_BUCKET)
    .createSignedUploadUrl(path, { upsert });
  if (error || !data) {
    console.error("finance signed upload failed", error);
    throw new Error("Could not create signed upload URL.");
  }
  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}

export async function createFinanceSignedPreview(
  admin: Admin,
  path: string,
  expiresIn = 60 * 10,
): Promise<string> {
  const { data, error } = await admin.storage
    .from(FINANCE_PRIVATE_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    console.error("finance signed preview failed", error);
    throw new Error("Could not create preview URL.");
  }
  return data.signedUrl;
}

export async function downloadFinanceObject(
  admin: Admin,
  path: string,
): Promise<Buffer> {
  const { data, error } = await admin.storage
    .from(FINANCE_PRIVATE_BUCKET)
    .download(path);
  if (error || !data) {
    throw new Error("Could not download finance object.");
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function uploadFinanceObject(
  admin: Admin,
  path: string,
  body: Buffer | ArrayBuffer,
  contentType: string,
): Promise<void> {
  const size = Buffer.isBuffer(body) ? body.byteLength : body.byteLength;
  if (size > MAX_FINANCE_UPLOAD_BYTES) {
    throw new Error("File exceeds 25 MB limit.");
  }
  const { error } = await admin.storage.from(FINANCE_PRIVATE_BUCKET).upload(path, body, {
    contentType,
    upsert: false,
  });
  if (error) {
    console.error("finance upload failed", error);
    throw new Error("Could not store finance file.");
  }
}

export function assertPropertyScopedPath(propertyId: string, path: string): void {
  if (!path.startsWith(`${propertyId}/`)) {
    throw new Error("Storage path must be property-scoped.");
  }
}
