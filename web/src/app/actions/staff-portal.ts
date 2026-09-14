"use server";

import { requireStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type StaffPortalState = {
  ok: boolean;
  error?: string;
  message?: string;
};

/** Staff marks a notice as read from their inbox. */
export async function markNoticeRead(
  _previous: StaffPortalState,
  formData: FormData,
): Promise<StaffPortalState> {
  try {
    const session = await requireStaffSession();
    const announcementId = String(formData.get("announcement_id") ?? "").trim();
    if (!announcementId) throw new Error("Missing notice.");

    const admin = createSupabaseAdminClient();
    await admin
      .from("hr_announcement_recipients")
      .update({ read_at: new Date().toISOString() })
      .eq("announcement_id", announcementId)
      .eq("staff_id", session.staffId)
      .is("read_at", null);

    revalidatePath("/staff");
    revalidatePath(`/staff/notices/${announcementId}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update notice.",
    };
  }
}

/** Staff acknowledges a notice that requires confirmation. */
export async function acknowledgeNotice(
  _previous: StaffPortalState,
  formData: FormData,
): Promise<StaffPortalState> {
  try {
    const session = await requireStaffSession();
    const announcementId = String(formData.get("announcement_id") ?? "").trim();
    if (!announcementId) throw new Error("Missing notice.");

    const now = new Date().toISOString();
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("hr_announcement_recipients")
      .update({ acknowledged_at: now, read_at: now })
      .eq("announcement_id", announcementId)
      .eq("staff_id", session.staffId);
    if (error) throw new Error("Could not record acknowledgement.");

    revalidatePath("/staff");
    revalidatePath(`/staff/notices/${announcementId}`);
    return { ok: true, message: "Acknowledged. Thank you." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not acknowledge.",
    };
  }
}

type PushSubscriptionInput = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};

/** Store a Web Push subscription for the signed-in staff device. */
export async function savePushSubscription(
  subscriptionJson: string,
  userAgent?: string,
): Promise<StaffPortalState> {
  try {
    const session = await requireStaffSession();
    let parsed: PushSubscriptionInput;
    try {
      parsed = JSON.parse(subscriptionJson) as PushSubscriptionInput;
    } catch {
      throw new Error("Invalid subscription.");
    }
    if (!parsed.endpoint || !parsed.keys?.p256dh || !parsed.keys?.auth) {
      throw new Error("Subscription is missing keys.");
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("hr_push_subscriptions").upsert(
      {
        property_id: session.propertyId,
        staff_id: session.staffId,
        endpoint: parsed.endpoint,
        p256dh: parsed.keys.p256dh,
        auth_secret: parsed.keys.auth,
        user_agent: userAgent?.slice(0, 300) ?? null,
        is_active: true,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "staff_id,endpoint" },
    );
    if (error) throw new Error("Could not save subscription.");

    return { ok: true, message: "Notifications on." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not enable notifications.",
    };
  }
}

/** Deactivate a Web Push subscription (e.g. staff turns off alerts). */
export async function removePushSubscription(
  endpoint: string,
): Promise<StaffPortalState> {
  try {
    const session = await requireStaffSession();
    if (!endpoint) throw new Error("Missing endpoint.");
    const admin = createSupabaseAdminClient();
    await admin
      .from("hr_push_subscriptions")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("staff_id", session.staffId)
      .eq("endpoint", endpoint);
    return { ok: true, message: "Notifications off." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not disable notifications.",
    };
  }
}
