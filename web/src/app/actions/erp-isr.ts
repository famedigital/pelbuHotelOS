"use server";

import { writeAuditEvent } from "@/lib/audit";
import { requireDeskRole } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import type { IsrStatus } from "@/lib/hr/isr-bhutan";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type IsrActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

const STATUSES = new Set<IsrStatus>([
  "draft",
  "submitted",
  "approved",
  "active",
  "superseded",
]);

/** Labour ISR is statutory — owner/GM only. */
async function requireIsrDesk(): Promise<{ admin: Admin; propertyId: string }> {
  await requireDeskRole(["owner", "gm"]);
  const admin = createSupabaseAdminClient();
  return { admin, propertyId: await requireDeskPropertyId() };
}

function refreshIsr(): void {
  revalidatePath("/erp/hr/isr");
  revalidatePath("/erp/hr");
  revalidatePath("/erp/settings");
}

async function loadOwnedIsr(
  admin: Admin,
  propertyId: string,
  id: string,
): Promise<{
  id: string;
  status: string;
  version_label: string;
  pdf_public_id: string | null;
}> {
  const { data, error } = await admin
    .from("hr_internal_service_rules")
    .select("id, status, version_label, pdf_public_id")
    .eq("id", id)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error || !data) throw new Error("ISR record not found.");
  return data as {
    id: string;
    status: string;
    version_label: string;
    pdf_public_id: string | null;
  };
}

/** Create a new ISR version in draft. */
export async function createIsrVersion(
  _prev: IsrActionState,
  formData: FormData,
): Promise<IsrActionState> {
  try {
    const { admin, propertyId } = await requireIsrDesk();
    const versionLabel = trimRequired(
      formData.get("version_label"),
      "Version",
    ).trim();
    const title =
      optionalTrim(formData.get("title")) ?? "Internal Service Rules";
    const scopeSummary = optionalTrim(formData.get("scope_summary"));
    const notes = optionalTrim(formData.get("notes"));

    const { data, error } = await admin
      .from("hr_internal_service_rules")
      .insert({
        property_id: propertyId,
        version_label: versionLabel,
        title,
        scope_summary: scopeSummary,
        notes,
        status: "draft",
        is_current: false,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) {
      if (error?.code === "23505") {
        throw new Error(`Version “${versionLabel}” already exists.`);
      }
      throw new Error(error?.message ?? "Could not create ISR version.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "isr.create",
      entityType: "hr_internal_service_rules",
      entityId: data.id as string,
      summary: `Created ISR draft ${versionLabel}`,
    });

    refreshIsr();
    return { ok: true, message: "ISR draft created." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not create ISR.",
    };
  }
}

/** Edit draft details (allowed while draft / submitted / approved, not active history freely). */
export async function updateIsrDetails(
  _prev: IsrActionState,
  formData: FormData,
): Promise<IsrActionState> {
  try {
    const { admin, propertyId } = await requireIsrDesk();
    const id = trimRequired(formData.get("isr_id"), "ISR");
    const existing = await loadOwnedIsr(admin, propertyId, id);
    if (existing.status === "superseded") {
      throw new Error("Superseded ISR cannot be edited.");
    }

    const update: Record<string, unknown> = {
      title: optionalTrim(formData.get("title")) ?? "Internal Service Rules",
      scope_summary: optionalTrim(formData.get("scope_summary")),
      notes: optionalTrim(formData.get("notes")),
      effective_from: optionalTrim(formData.get("effective_from")),
      effective_to: optionalTrim(formData.get("effective_to")),
      labour_office: optionalTrim(formData.get("labour_office")),
      signed_by_name: optionalTrim(formData.get("signed_by_name")),
      updated_at: new Date().toISOString(),
    };

    const { error } = await admin
      .from("hr_internal_service_rules")
      .update(update)
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message ?? "Could not update ISR.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "isr.update",
      entityType: "hr_internal_service_rules",
      entityId: id,
      summary: `Updated ISR ${existing.version_label}`,
    });

    refreshIsr();
    return { ok: true, message: "ISR details saved." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update ISR.",
    };
  }
}

/** Mark submitted to Labour (step 2). */
export async function markIsrSubmitted(
  _prev: IsrActionState,
  formData: FormData,
): Promise<IsrActionState> {
  try {
    const { admin, propertyId } = await requireIsrDesk();
    const id = trimRequired(formData.get("isr_id"), "ISR");
    const existing = await loadOwnedIsr(admin, propertyId, id);
    if (existing.status !== "draft" && existing.status !== "submitted") {
      throw new Error("Only draft ISR can be marked submitted (or re-edit submission).");
    }

    const submittedOn =
      optionalTrim(formData.get("submitted_on")) ??
      new Date().toISOString().slice(0, 10);
    const labourOffice = trimRequired(
      formData.get("labour_office"),
      "Labour office",
    );
    const labourReference = optionalTrim(formData.get("labour_reference"));

    const { error } = await admin
      .from("hr_internal_service_rules")
      .update({
        status: "submitted",
        submitted_on: submittedOn,
        labour_office: labourOffice,
        labour_reference: labourReference,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message ?? "Could not mark submitted.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "isr.submit",
      entityType: "hr_internal_service_rules",
      entityId: id,
      summary: `ISR ${existing.version_label} submitted to Labour`,
      meta: { labourOffice, labourReference, submittedOn },
    });

    refreshIsr();
    return { ok: true, message: "Marked as submitted to Labour." };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not mark submitted.",
    };
  }
}

/** Labour approved (step 3). */
export async function markIsrApproved(
  _prev: IsrActionState,
  formData: FormData,
): Promise<IsrActionState> {
  try {
    const { admin, propertyId } = await requireIsrDesk();
    const id = trimRequired(formData.get("isr_id"), "ISR");
    const existing = await loadOwnedIsr(admin, propertyId, id);
    if (existing.status !== "submitted" && existing.status !== "approved") {
      throw new Error("Mark as submitted to Labour before recording approval.");
    }

    const approvedOn =
      optionalTrim(formData.get("approved_on")) ??
      new Date().toISOString().slice(0, 10);
    const approvalReference = optionalTrim(formData.get("approval_reference"));

    const { error } = await admin
      .from("hr_internal_service_rules")
      .update({
        status: "approved",
        approved_on: approvedOn,
        approval_reference: approvalReference,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message ?? "Could not record approval.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "isr.approve",
      entityType: "hr_internal_service_rules",
      entityId: id,
      summary: `ISR ${existing.version_label} Labour-approved`,
      meta: { approvedOn, approvalReference },
    });

    refreshIsr();
    return { ok: true, message: "Labour approval recorded." };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not record approval.",
    };
  }
}

/**
 * Upload signed PDF (step 4). Optionally activate as current in-force ISR.
 * Does not require prior approval if you already have the wet-signed pack —
 * but status must be at least approved to mark active.
 */
export async function uploadIsrSignedPdf(
  _prev: IsrActionState,
  formData: FormData,
): Promise<IsrActionState> {
  try {
    const { admin, propertyId } = await requireIsrDesk();
    const id = trimRequired(formData.get("isr_id"), "ISR");
    const existing = await loadOwnedIsr(admin, propertyId, id);
    if (existing.status === "superseded") {
      throw new Error("Cannot upload PDF onto a superseded ISR.");
    }

    const publicId = trimRequired(
      formData.get("cloudinary_public_id"),
      "Signed PDF",
    );
    const resourceType =
      optionalTrim(formData.get("resource_type")) ?? "raw";
    const fileName =
      optionalTrim(formData.get("pdf_file_name")) ??
      publicId.split("/").pop() ??
      "isr-signed.pdf";
    const signedOn =
      optionalTrim(formData.get("signed_on")) ??
      new Date().toISOString().slice(0, 10);
    const signedBy = optionalTrim(formData.get("signed_by_name"));
    const makeActive = formData.get("make_active") === "on";

    if (makeActive && existing.status === "draft") {
      throw new Error(
        "Record Labour submission and approval before activating. You can still upload a draft scan without activating.",
      );
    }
    if (
      makeActive &&
      existing.status !== "approved" &&
      existing.status !== "active"
    ) {
      throw new Error(
        "Activate only after Labour approval (or re-upload onto an active ISR).",
      );
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      pdf_public_id: publicId,
      pdf_resource_type: resourceType,
      pdf_file_name: fileName,
      pdf_uploaded_at: now,
      signed_on: signedOn,
      signed_by_name: signedBy,
      updated_at: now,
    };

    if (makeActive) {
      await admin
        .from("hr_internal_service_rules")
        .update({
          is_current: false,
          status: "superseded",
          updated_at: now,
        })
        .eq("property_id", propertyId)
        .eq("is_current", true)
        .neq("id", id);

      update.status = "active";
      update.is_current = true;
      if (!optionalTrim(formData.get("effective_from"))) {
        // keep existing if set via details form; otherwise default today
      }
    }

    const { error } = await admin
      .from("hr_internal_service_rules")
      .update(update)
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message ?? "Could not save PDF.");

    // Mirror into compliance vault category “isr” when present.
    if (makeActive) {
      const { data: cat } = await admin
        .from("property_compliance_categories")
        .select("id")
        .eq("property_id", propertyId)
        .eq("code", "isr")
        .maybeSingle();
      if (cat?.id) {
        await admin.from("property_compliance_documents").insert({
          property_id: propertyId,
          category_id: cat.id as string,
          title: `ISR ${existing.version_label} (signed)`,
          storage_path: publicId,
          file_name: fileName,
          mime_type: "application/pdf",
          notes: `Linked from HR ISR · signed ${signedOn}`,
          valid_from: signedOn,
        });
      }
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: makeActive ? "isr.activate_pdf" : "isr.upload_pdf",
      entityType: "hr_internal_service_rules",
      entityId: id,
      summary: makeActive
        ? `ISR ${existing.version_label} signed PDF activated`
        : `ISR ${existing.version_label} PDF uploaded`,
      meta: { publicId, signedOn, makeActive },
    });

    refreshIsr();
    return {
      ok: true,
      message: makeActive
        ? "Signed PDF saved and set as the active ISR on file."
        : "PDF saved. Mark Active when Labour-approved and ready as the in-force copy.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not upload PDF.",
    };
  }
}

/** Explicitly activate an approved ISR that already has a PDF. */
export async function activateIsr(
  _prev: IsrActionState,
  formData: FormData,
): Promise<IsrActionState> {
  try {
    const { admin, propertyId } = await requireIsrDesk();
    const id = trimRequired(formData.get("isr_id"), "ISR");
    const existing = await loadOwnedIsr(admin, propertyId, id);
    if (!existing.pdf_public_id) {
      throw new Error("Upload the signed PDF before activating.");
    }
    if (existing.status !== "approved" && existing.status !== "active") {
      throw new Error("ISR must be Labour-approved before activation.");
    }

    const now = new Date().toISOString();
    await admin
      .from("hr_internal_service_rules")
      .update({
        is_current: false,
        status: "superseded",
        updated_at: now,
      })
      .eq("property_id", propertyId)
      .eq("is_current", true)
      .neq("id", id);

    const { error } = await admin
      .from("hr_internal_service_rules")
      .update({
        status: "active",
        is_current: true,
        effective_from:
          optionalTrim(formData.get("effective_from")) ??
          new Date().toISOString().slice(0, 10),
        updated_at: now,
      })
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message ?? "Could not activate ISR.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "isr.activate",
      entityType: "hr_internal_service_rules",
      entityId: id,
      summary: `ISR ${existing.version_label} set current`,
    });

    refreshIsr();
    return { ok: true, message: "This version is now the active ISR on file." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not activate ISR.",
    };
  }
}

// silence unused
void STATUSES;
