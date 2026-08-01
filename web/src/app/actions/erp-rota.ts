"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { processStaffNotificationOutbox } from "@/lib/staff-notify";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type RotaActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

const SHIFT_OUTLETS = new Set([
  "front_desk",
  "cafe",
  "pastry",
  "restaurant",
  "bar",
  "spa",
  "housekeeping",
  "maintenance",
  "security",
  "admin",
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{2}:\d{2}(:\d{2})?$/;

async function requireRotaDesk(): Promise<{ admin: Admin; propertyId: string }> {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
  const admin = createSupabaseAdminClient();
  return { admin, propertyId: await resolveActivePropertyId(admin) };
}

function refreshRota(): void {
  revalidatePath("/erp/hr/rota");
  revalidatePath("/erp/hr");
  revalidatePath("/staff");
}

function assertDate(value: string, label: string): string {
  if (!ISO_DATE.test(value)) throw new Error(`${label} must be a valid date.`);
  return value;
}

function assertTime(value: string, label: string): string {
  if (!ISO_TIME.test(value)) throw new Error(`${label} must be HH:MM.`);
  return value.length === 5 ? `${value}:00` : value;
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Add or edit a single draft shift from the rota grid. */
export async function saveRotaShift(
  _previous: RotaActionState,
  formData: FormData,
): Promise<RotaActionState> {
  try {
    const { admin, propertyId } = await requireRotaDesk();
    const id = optionalTrim(formData.get("id"));
    const staffId = trimRequired(formData.get("staff_id"), "Staff");
    const shiftDate = assertDate(
      trimRequired(formData.get("shift_date"), "Date"),
      "Date",
    );
    const startsAt = assertTime(trimRequired(formData.get("starts_at"), "Start"), "Start");
    const endsAt = assertTime(trimRequired(formData.get("ends_at"), "End"), "End");
    const outlet = optionalTrim(formData.get("outlet"))?.toLowerCase() ?? null;
    if (outlet && !SHIFT_OUTLETS.has(outlet)) throw new Error("Invalid outlet.");
    if (endsAt <= startsAt) throw new Error("End time must be after start time.");

    const { data: staff } = await admin
      .from("staff_members")
      .select("id")
      .eq("id", staffId)
      .eq("property_id", propertyId)
      .in("status", ["active", "on_leave"])
      .maybeSingle();
    if (!staff) throw new Error("Staff member not found for this property.");

    // Overlap conflict: same staff, same date, overlapping times (draft/published).
    const { data: peers } = await admin
      .from("staff_shifts")
      .select("id, starts_at, ends_at, status")
      .eq("property_id", propertyId)
      .eq("staff_id", staffId)
      .eq("shift_date", shiftDate)
      .in("status", ["draft", "published"]);
    for (const peer of peers ?? []) {
      if (id && peer.id === id) continue;
      const peerStart = peer.starts_at as string;
      const peerEnd = peer.ends_at as string;
      if (startsAt < peerEnd && endsAt > peerStart) {
        throw new Error(
          `Shift overlaps existing ${peer.status} shift ${peerStart}–${peerEnd}.`,
        );
      }
    }

    const record = {
      property_id: propertyId,
      staff_id: staffId,
      shift_date: shiftDate,
      starts_at: startsAt,
      ends_at: endsAt,
      outlet,
      notes: optionalTrim(formData.get("notes")),
      updated_at: new Date().toISOString(),
    };

    if (id) {
      const { error } = await admin
        .from("staff_shifts")
        .update(record)
        .eq("id", id)
        .eq("property_id", propertyId)
        .in("status", ["draft", "published"]);
      if (error) throw new Error("Could not update shift.");
    } else {
      const { error } = await admin
        .from("staff_shifts")
        .insert({ ...record, status: "draft" });
      if (error) throw new Error("Could not add shift.");
    }

    refreshRota();
    return { ok: true, message: id ? "Shift updated." : "Shift added to draft rota." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save shift.",
    };
  }
}

/** Remove a shift (draft or published) from the rota. */
export async function deleteRotaShift(
  _previous: RotaActionState,
  formData: FormData,
): Promise<RotaActionState> {
  try {
    const { admin, propertyId } = await requireRotaDesk();
    const id = trimRequired(formData.get("id"), "Shift");
    const { error } = await admin
      .from("staff_shifts")
      .delete()
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not remove shift.");

    refreshRota();
    return { ok: true, message: "Shift removed." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not remove shift.",
    };
  }
}

/** Copy an entire week of shifts forward as fresh drafts. */
export async function copyRotaWeek(
  _previous: RotaActionState,
  formData: FormData,
): Promise<RotaActionState> {
  try {
    const { admin, propertyId } = await requireRotaDesk();
    const sourceWeek = assertDate(
      trimRequired(formData.get("source_week_start"), "Source week"),
      "Source week",
    );
    const targetWeek = assertDate(
      trimRequired(formData.get("target_week_start"), "Target week"),
      "Target week",
    );
    if (sourceWeek === targetWeek) {
      throw new Error("Choose a different target week.");
    }

    const sourceEnd = addDays(sourceWeek, 7);
    const { data: shifts, error } = await admin
      .from("staff_shifts")
      .select("staff_id, shift_date, starts_at, ends_at, outlet, notes")
      .eq("property_id", propertyId)
      .gte("shift_date", sourceWeek)
      .lt("shift_date", sourceEnd);
    if (error) throw new Error("Could not read the source week.");
    if (!shifts?.length) throw new Error("The source week has no shifts to copy.");

    const offsetDays =
      (new Date(`${targetWeek}T00:00:00Z`).getTime() -
        new Date(`${sourceWeek}T00:00:00Z`).getTime()) /
      86_400_000;

    const rows = shifts.map((shift) => ({
      property_id: propertyId,
      staff_id: shift.staff_id as string,
      shift_date: addDays(shift.shift_date as string, offsetDays),
      starts_at: shift.starts_at as string,
      ends_at: shift.ends_at as string,
      outlet: shift.outlet as string | null,
      notes: shift.notes as string | null,
      status: "draft",
    }));

    const { error: insertError } = await admin.from("staff_shifts").insert(rows);
    if (insertError) throw new Error("Could not copy the week.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "rota.copy_week",
      entityType: "staff_shifts",
      summary: `Copied ${rows.length} shifts from ${sourceWeek} to ${targetWeek}`,
      meta: { sourceWeek, targetWeek, count: rows.length },
    });

    refreshRota();
    return { ok: true, message: `${rows.length} shifts copied as drafts.` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not copy week.",
    };
  }
}

/** Publish every draft shift in a week and notify affected staff for free. */
export async function publishRotaWeek(
  _previous: RotaActionState,
  formData: FormData,
): Promise<RotaActionState> {
  try {
    const { admin, propertyId } = await requireRotaDesk();
    const weekStart = assertDate(
      trimRequired(formData.get("week_start"), "Week"),
      "Week",
    );
    const weekEnd = addDays(weekStart, 7);
    const now = new Date().toISOString();

    const { data: published, error } = await admin
      .from("staff_shifts")
      .update({ status: "published", published_at: now, updated_at: now })
      .eq("property_id", propertyId)
      .eq("status", "draft")
      .gte("shift_date", weekStart)
      .lt("shift_date", weekEnd)
      .select("id, staff_id");
    if (error) throw new Error("Could not publish the rota.");
    if (!published?.length) {
      return { ok: false, error: "No draft shifts to publish in this week." };
    }

    const staffIds = [...new Set(published.map((row) => row.staff_id as string))];
    const { data: staff } = await admin
      .from("staff_members")
      .select("id, email, full_name")
      .in("id", staffIds);

    const batch = Date.now();
    const outboxRows = (staff ?? []).flatMap((member) => {
      const base = {
        property_id: propertyId,
        staff_id: member.id as string,
        announcement_id: null,
        event_type: "shift.published",
        payload: {
          title: `Rota published — week of ${weekStart}`,
          category: "shift",
          url: "/staff",
        } as Record<string, unknown>,
      };
      return [
        {
          ...base,
          channel: "in_app",
          idempotency_key: `rota:${weekStart}:${member.id}:in_app:${batch}`,
        },
        {
          ...base,
          channel: "web_push",
          idempotency_key: `rota:${weekStart}:${member.id}:web_push:${batch}`,
        },
        ...(member.email
          ? [
              {
                ...base,
                channel: "email",
                idempotency_key: `rota:${weekStart}:${member.id}:email:${batch}`,
                payload: { ...base.payload, email: member.email as string },
              },
            ]
          : []),
      ];
    });

    if (outboxRows.length) {
      await admin.from("hr_notification_outbox").insert(outboxRows);
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "rota.publish_week",
      entityType: "staff_shifts",
      summary: `Published ${published.length} shifts for ${staffIds.length} staff (week ${weekStart})`,
      meta: { weekStart, shiftCount: published.length, staffCount: staffIds.length },
    });

    await processStaffNotificationOutbox();

    refreshRota();
    return {
      ok: true,
      message: `Published ${published.length} shifts and alerted ${staffIds.length} staff.`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not publish rota.",
    };
  }
}

/** Re-alert staff who have not yet read a published notice. */
export async function remindUnreadNotice(
  _previous: RotaActionState,
  formData: FormData,
): Promise<RotaActionState> {
  try {
    const { admin, propertyId } = await requireRotaDesk();
    const announcementId = trimRequired(formData.get("announcement_id"), "Notice");

    const { data: notice } = await admin
      .from("hr_announcements")
      .select("id, title, category, priority")
      .eq("id", announcementId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!notice) throw new Error("Notice not found.");

    const { data: unread } = await admin
      .from("hr_announcement_recipients")
      .select("staff_id, staff_members(email)")
      .eq("announcement_id", announcementId)
      .eq("property_id", propertyId)
      .is("read_at", null);

    if (!unread?.length) {
      return { ok: true, message: "Everyone has already read this notice." };
    }

    const batch = Date.now();
    const outboxRows = unread.flatMap((row) => {
      const staffId = row.staff_id as string;
      const related = row.staff_members as
        | { email: string | null }
        | { email: string | null }[]
        | null;
      const email = Array.isArray(related)
        ? (related[0]?.email ?? null)
        : (related?.email ?? null);
      const base = {
        property_id: propertyId,
        staff_id: staffId,
        announcement_id: announcementId,
        event_type: "announcement.reminder",
        payload: {
          title: notice.title as string,
          category: notice.category as string,
          priority: notice.priority as string,
          url: `/staff/notices/${announcementId}`,
        } as Record<string, unknown>,
      };
      return [
        {
          ...base,
          channel: "web_push",
          idempotency_key: `remind:${announcementId}:${staffId}:web_push:${batch}`,
        },
        ...(email
          ? [
              {
                ...base,
                channel: "email",
                idempotency_key: `remind:${announcementId}:${staffId}:email:${batch}`,
                payload: { ...base.payload, email },
              },
            ]
          : []),
      ];
    });

    if (outboxRows.length) {
      await admin.from("hr_notification_outbox").insert(outboxRows);
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "announcement.remind",
      entityType: "hr_announcements",
      entityId: announcementId,
      summary: `Reminded ${unread.length} staff about "${notice.title}"`,
      meta: { unread: unread.length },
    });

    await processStaffNotificationOutbox();

    refreshRota();
    return { ok: true, message: `Reminded ${unread.length} staff.` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not send reminder.",
    };
  }
}
