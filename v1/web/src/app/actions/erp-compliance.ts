"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  assertPropertyScopedPath,
  createFinanceSignedPreview,
} from "@/lib/finance-import/storage";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

type State = { ok: boolean; message?: string; error?: string };

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

export async function createComplianceCategory(
  _prev: State,
  formData: FormData,
): Promise<State> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const name = trimRequired(formData.get("name"), "Category name");
    const code = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40);

    const { error } = await admin.from("property_compliance_categories").insert({
      property_id: propertyId,
      code: code || `custom_${Date.now()}`,
      name,
      description: optionalTrim(formData.get("description")),
      sort_order: 50,
      is_seeded: false,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/erp/settings");
    return { ok: true, message: "Category added." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function registerComplianceDocument(
  _prev: State,
  formData: FormData,
): Promise<State> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const categoryId = trimRequired(formData.get("category_id"), "Category");
    const title = trimRequired(formData.get("title"), "Title");
    const storagePath = trimRequired(formData.get("storage_path"), "File");
    assertPropertyScopedPath(propertyId, storagePath);

    const { data: cat } = await admin
      .from("property_compliance_categories")
      .select("id, code")
      .eq("id", categoryId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!cat) throw new Error("Category not found.");

    const isLease = (cat.code as string) === "lease";

    const { error } = await admin.from("property_compliance_documents").insert({
      property_id: propertyId,
      category_id: categoryId,
      title,
      storage_path: storagePath,
      file_name:
        optionalTrim(formData.get("file_name")) ??
        storagePath.split("/").pop() ??
        "document",
      mime_type: optionalTrim(formData.get("mime_type")),
      byte_size: Number(formData.get("byte_size") ?? 0) || null,
      notes: optionalTrim(formData.get("notes")),
      valid_from: optionalTrim(formData.get("valid_from")),
      valid_until: optionalTrim(formData.get("valid_until")),
      lease_agreement_ref: isLease
        ? optionalTrim(formData.get("lease_agreement_ref"))
        : null,
      deposit_slip_ref: isLease
        ? optionalTrim(formData.get("deposit_slip_ref"))
        : null,
      handover_inventory_ref: isLease
        ? optionalTrim(formData.get("handover_inventory_ref"))
        : null,
    });
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      entityType: "property_compliance_documents",
      entityId: categoryId,
      action: "compliance.upload",
      summary: `Compliance document uploaded: ${title}`,
    });

    revalidatePath("/erp/settings");
    return { ok: true, message: "Document saved to vault." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function deleteComplianceDocument(
  _prev: State,
  formData: FormData,
): Promise<State> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const docId = trimRequired(formData.get("document_id"), "Document");

    const { error } = await admin
      .from("property_compliance_documents")
      .delete()
      .eq("id", docId)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);

    revalidatePath("/erp/settings");
    return { ok: true, message: "Document removed." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function getCompliancePreviewUrl(
  storagePath: string,
): Promise<{ url?: string; error?: string }> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    assertPropertyScopedPath(propertyId, storagePath);
    const url = await createFinanceSignedPreview(admin, storagePath);
    return { url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Preview failed." };
  }
}
