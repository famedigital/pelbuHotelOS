"use server";

import { writeAuditEvent } from "@/lib/audit";
import { requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type GuestFlagState = { ok: boolean; error?: string; message?: string };

export async function setGuestBlacklist(
  _prev: GuestFlagState,
  formData: FormData,
): Promise<GuestFlagState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const pid = await resolveActivePropertyId(admin);
    const guestId = trimRequired(formData.get("guest_id"), "Guest");
    const blacklisted = formData.get("blacklisted") === "1";
    const reason = optionalTrim(formData.get("blacklist_reason"));
    const notes = optionalTrim(formData.get("desk_notes"));

    const { data: guest } = await admin
      .from("booking_guests")
      .select("id, booking_id, full_name, bookings!inner(property_id)")
      .eq("id", guestId)
      .single();
    if (!guest) throw new Error("Guest not found.");
    const bookingProperty = (
      guest.bookings as { property_id?: string } | null
    )?.property_id;
    assertDeskProperty(pid, bookingProperty, "Guest");

    const { error } = await admin
      .from("booking_guests")
      .update({
        blacklisted,
        blacklist_reason: blacklisted ? reason : null,
        desk_notes: notes,
      })
      .eq("id", guestId);
    if (error) throw new Error("Could not update guest.");

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: blacklisted ? "guest.blacklist" : "guest.unblacklist",
      entityType: "booking_guests",
      entityId: guestId,
      summary: `${guest.full_name as string} · blacklist=${blacklisted}`,
      meta: { reason, notes },
    });

    revalidatePath("/erp/guests");
    return {
      ok: true,
      message: blacklisted ? "Guest blacklisted." : "Blacklist cleared.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
