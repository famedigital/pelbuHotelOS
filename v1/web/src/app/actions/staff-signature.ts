"use server";

import { saveAuthorizedSignatoryName, saveSignatureFile } from "@/lib/print/bill-signature";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

function imageFile(formData: FormData): File | null {
  const file = formData.get("signature");
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith("image/")) return null;
  if (file.size > 1_500_000) return null;
  return file;
}

export async function uploadStaffSignature(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const staffId = String(formData.get("staff_id") ?? "").trim();
  const file = imageFile(formData);
  if (!staffId || !file) return { ok: false, error: "Choose a PNG or JPG signature." };
  const session = await getStaffSession();
  const admin = createSupabaseAdminClient();
  if (session && session.staffId !== staffId && session.deskRole !== "owner" && session.deskRole !== "gm") {
    return { ok: false, error: "Only that user, or an admin, can save this signature." };
  }
  const error = await saveSignatureFile(admin, `signatures/${staffId}.png`, file);
  if (error) return { ok: false, error };
  revalidatePath("/erp/settings");
  revalidatePath("/erp/folios", "layout");
  return { ok: true };
}

export async function uploadAuthorizedSignature(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getStaffSession();
  if (!session) {
    return { ok: false, error: "Sign in with your user account to save the signatory." };
  }
  const name = String(formData.get("name") ?? "").trim() || "Choki";
  const admin = createSupabaseAdminClient();
  const nameError = await saveAuthorizedSignatoryName(admin, name);
  if (nameError) return { ok: false, error: nameError };
  const file = imageFile(formData);
  if (file) {
    const error = await saveSignatureFile(admin, "signatures/authorized-signatory.png", file);
    if (error) return { ok: false, error };
  }
  revalidatePath("/erp/settings");
  revalidatePath("/erp/folios", "layout");
  return { ok: true };
}
