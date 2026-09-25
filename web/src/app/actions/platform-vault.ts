"use server";

import { requirePlatformAdmin } from "@/lib/platform-auth";
import {
  enqueuePlatformVerification,
  resolveOpenVerificationItems,
} from "@/lib/platform-verification";
import { upsertAgentPropertyLink } from "@/lib/erp/agent-property-links";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

function revalidateVault() {
  revalidatePath("/admin/vault/agents");
  revalidatePath("/admin/vault/guides");
  revalidatePath("/admin");
  revalidatePath("/erp/agents");
  revalidatePath("/erp/partners");
}

export async function verifyVaultAgent(formData: FormData): Promise<void> {
  const session = await requirePlatformAdmin();
  const admin = createSupabaseAdminClient();
  const agentId = trimRequired(formData.get("agent_id"), "Agent");
  const nextStatus = (optionalTrim(formData.get("status")) ?? "directory").toLowerCase();
  if (!["directory", "approved", "rejected"].includes(nextStatus)) {
    throw new Error("Invalid status.");
  }

  const patch: Record<string, unknown> = {
    status: nextStatus,
  };
  if (nextStatus === "approved") {
    patch.approved_at = new Date().toISOString();
  }
  if (nextStatus === "rejected") {
    patch.rejected_at = new Date().toISOString();
  }

  const { error } = await admin.from("agents").update(patch).eq("id", agentId);
  if (error) throw new Error(error.message);

  await resolveOpenVerificationItems(admin, {
    entityType: "agent",
    entityId: agentId,
    status: nextStatus === "rejected" ? "rejected" : "verified",
    resolvedByEmail: session.email,
  });

  // Verified directory/approved agents stay bookable nationally; MoU still gates portal rates.
  if (nextStatus === "directory" || nextStatus === "approved") {
    const { data: props } = await admin.from("properties").select("id").limit(500);
    for (const p of props ?? []) {
      await upsertAgentPropertyLink(admin, {
        agentId,
        propertyId: p.id as string,
        status: "approved",
      });
    }
  }

  revalidateVault();
}

export async function markAgentMouSigned(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const admin = createSupabaseAdminClient();
  const agentId = trimRequired(formData.get("agent_id"), "Agent");
  const propertyId = trimRequired(formData.get("property_id"), "Property");

  await upsertAgentPropertyLink(admin, {
    agentId,
    propertyId,
    status: "approved",
    mouSignedAt: new Date().toISOString(),
    rateTier: "mou_agents",
  });

  revalidateVault();
}

export async function verifyVaultGuide(formData: FormData): Promise<void> {
  const session = await requirePlatformAdmin();
  const admin = createSupabaseAdminClient();
  const guideId = trimRequired(formData.get("guide_id"), "Guide");
  const nextStatus = (optionalTrim(formData.get("status")) ?? "verified").toLowerCase();
  if (!["verified", "rejected", "suspended"].includes(nextStatus)) {
    throw new Error("Invalid status.");
  }

  const { error } = await admin
    .from("national_guides")
    .update({
      status: nextStatus,
      verified_at: nextStatus === "verified" ? new Date().toISOString() : null,
      verified_by_email: session.email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", guideId);
  if (error) throw new Error(error.message);

  await resolveOpenVerificationItems(admin, {
    entityType: "guide",
    entityId: guideId,
    status: nextStatus === "verified" ? "verified" : "rejected",
    resolvedByEmail: session.email,
  });

  revalidateVault();
}

export async function upsertVaultGuide(formData: FormData): Promise<void> {
  const session = await requirePlatformAdmin();
  const admin = createSupabaseAdminClient();
  const licenseNo = trimRequired(formData.get("license_no"), "License no");
  const fullName = trimRequired(formData.get("full_name"), "Full name");
  const phone = optionalTrim(formData.get("phone"));
  const city = optionalTrim(formData.get("city"));
  const guideType = optionalTrim(formData.get("guide_type"));
  const languagesRaw = optionalTrim(formData.get("languages")) ?? "English";
  const languages = languagesRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const { data, error } = await admin
    .from("national_guides")
    .upsert(
      {
        license_no: licenseNo,
        full_name: fullName,
        phone,
        city,
        guide_type: guideType,
        languages,
        status: "verified",
        source: "innora_vault",
        verified_at: new Date().toISOString(),
        verified_by_email: session.email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "license_no" },
    )
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save guide.");

  revalidateVault();
}

export async function submitDeskNationalGuide(
  formData: FormData,
): Promise<void> {
  const { isDeskAuthenticated } = await import("@/lib/desk-auth");
  const { resolveActivePropertyId } = await import("@/lib/property-context");
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired.");
  }
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const licenseNo = trimRequired(formData.get("license_no"), "License no");
  const fullName = trimRequired(formData.get("full_name"), "Full name");
  const phone = optionalTrim(formData.get("phone"));
  const city = optionalTrim(formData.get("city"));

  const { data: existing } = await admin
    .from("national_guides")
    .select("id, status")
    .eq("license_no", licenseNo)
    .maybeSingle();

  let guideId = existing?.id as string | undefined;
  if (!guideId) {
    const { data, error } = await admin
      .from("national_guides")
      .insert({
        license_no: licenseNo,
        full_name: fullName,
        phone,
        city,
        status: "pending_verification",
        source: "hotel_desk",
        submitted_by_property_id: propertyId,
        languages: ["English"],
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not create guide.");
    guideId = data.id as string;
  }

  await enqueuePlatformVerification(admin, {
    entityType: "guide",
    entityId: guideId,
    propertyId,
    submittedBy: "desk",
    payload: { licenseNo, fullName, phone, city },
  });

  const { error: localErr } = await admin.from("guides").upsert(
    {
      property_id: propertyId,
      guide_number: licenseNo,
      full_name: fullName,
      phone,
      national_guide_id: guideId,
    },
    { onConflict: "property_id,guide_number" },
  );
  if (localErr) {
    console.error("local guides upsert failed", localErr);
  }

  revalidatePath("/erp/partners");
}
