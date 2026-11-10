"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function submitSalesLead(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const segment = String(formData.get("segment") ?? "independent").trim();
  const roomsRaw = String(formData.get("rooms") ?? "").trim();
  const dzongkhag = String(formData.get("dzongkhag") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name || !phone) {
    return { ok: false, error: "Name and phone are required." };
  }
  if (!["independent", "chain", "leased"].includes(segment)) {
    return { ok: false, error: "Invalid segment." };
  }

  const rooms = roomsRaw ? Number(roomsRaw) : null;
  if (roomsRaw && (!Number.isFinite(rooms) || (rooms ?? 0) < 1)) {
    return { ok: false, error: "Rooms must be a positive number." };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("sales_leads").insert({
      name,
      phone,
      email,
      segment,
      rooms,
      dzongkhag,
      notes,
      status: "new",
    });
    if (error) {
      // Table may not exist yet locally — still accept for UX offline
      console.error("[sales_leads]", error.message);
      return {
        ok: false,
        error:
          "Could not save lead. Ensure hotelos migrations are applied, then retry.",
      };
    }
    revalidatePath("/admin/leads");
    revalidatePath("/partner/leads");
    return { ok: true };
  } catch (err) {
    console.error(err);
    return {
      ok: false,
      error: "Server misconfigured (Supabase). Try again later.",
    };
  }
}
