"use server";

import { revalidatePath } from "next/cache";
import { requireDeskRole } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  API_PURPOSES,
  API_SCOPES,
  type ApiKeyPurpose,
  type ApiScope,
  defaultScopesForPurpose,
  insertPropertyApiKey,
  listPropertyApiKeys,
  normalizeCorsOrigins,
  normalizeIpAllowlist,
  revokePropertyApiKey,
} from "@/lib/website-api-keys";

export type ApiKeyActionState = {
  ok: boolean;
  error?: string;
  fullKey?: string;
  keyId?: string;
  prefix?: string;
};

async function requireOwnerGmProperty(): Promise<{
  propertyId: string;
  staffId: string | null;
}> {
  await requireDeskRole(["owner", "gm"]);
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  if (!propertyId) throw new Error("No active property.");
  const staff = await getStaffSession();
  return { propertyId, staffId: staff?.staffId ?? null };
}

export async function listIntegrationApiKeysAction(): Promise<
  Awaited<ReturnType<typeof listPropertyApiKeys>>
> {
  const { propertyId } = await requireOwnerGmProperty();
  return listPropertyApiKeys(propertyId);
}

export async function createIntegrationApiKeyAction(
  _prev: ApiKeyActionState,
  formData: FormData,
): Promise<ApiKeyActionState> {
  try {
    const { propertyId, staffId } = await requireOwnerGmProperty();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, error: "Name is required." };

    const purposeRaw = String(formData.get("purpose") ?? "both").trim();
    if (!(API_PURPOSES as readonly string[]).includes(purposeRaw)) {
      return { ok: false, error: "Invalid purpose." };
    }
    const purpose = purposeRaw as ApiKeyPurpose;

    const scopeFields = API_SCOPES.filter(
      (s) => formData.get(`scope_${s}`) === "on" || formData.get(`scope_${s}`) === "true",
    );
    const scopes: ApiScope[] =
      scopeFields.length > 0 ? scopeFields : defaultScopesForPurpose(purpose);

    const corsRaw = String(formData.get("cors_origins") ?? "")
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const corsOrigins = normalizeCorsOrigins(corsRaw);

    const ipRaw = String(formData.get("ip_allowlist") ?? "")
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const ipAllowlist = normalizeIpAllowlist(ipRaw);

    const expiresRaw = String(formData.get("expires_at") ?? "").trim();
    const expiresAt = expiresRaw ? new Date(expiresRaw).toISOString() : null;

    const created = await insertPropertyApiKey({
      propertyId,
      name,
      purpose,
      scopes,
      corsOrigins,
      ipAllowlist,
      expiresAt,
      createdByStaffId: staffId,
    });

    revalidatePath("/erp/settings");
    return {
      ok: true,
      fullKey: created.fullKey,
      keyId: created.id,
      prefix: created.prefix,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not create key.",
    };
  }
}

export async function revokeIntegrationApiKeyAction(
  formData: FormData,
): Promise<ApiKeyActionState> {
  try {
    const { propertyId } = await requireOwnerGmProperty();
    const keyId = String(formData.get("key_id") ?? "").trim();
    if (!keyId) return { ok: false, error: "Missing key." };
    await revokePropertyApiKey(propertyId, keyId);
    revalidatePath("/erp/settings");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not revoke key.",
    };
  }
}

export async function rotateIntegrationApiKeyAction(
  formData: FormData,
): Promise<ApiKeyActionState> {
  try {
    const { propertyId, staffId } = await requireOwnerGmProperty();
    const keyId = String(formData.get("key_id") ?? "").trim();
    if (!keyId) return { ok: false, error: "Missing key." };

    const keys = await listPropertyApiKeys(propertyId);
    const old = keys.find((k) => k.id === keyId && !k.revokedAt);
    if (!old) return { ok: false, error: "Key not found." };

    await revokePropertyApiKey(propertyId, keyId);
    const created = await insertPropertyApiKey({
      propertyId,
      name: `${old.name} (rotated)`,
      purpose: old.purpose,
      scopes: old.scopes,
      corsOrigins: old.corsOrigins,
      ipAllowlist: old.ipAllowlist,
      expiresAt: old.expiresAt,
      createdByStaffId: staffId,
    });

    revalidatePath("/erp/settings");
    return {
      ok: true,
      fullKey: created.fullKey,
      keyId: created.id,
      prefix: created.prefix,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not rotate key.",
    };
  }
}
