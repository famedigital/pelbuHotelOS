"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import {
  assertNoOverlap,
  templateAppliesOnDay,
  type ShiftInterval,
} from "@/lib/rota/overlap";
import { processStaffNotificationOutbox } from "@/lib/staff-notify";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  isShiftOutlet,
  shiftSaveErrorMessage,
} from "@/lib/shift-outlets";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type RotaActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  details?: string[];
};

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

function toShiftIntervals(
  rows: Array<{
    id?: string;
    staff_id: string;
    shift_date: string;
    starts_at: string;
    ends_at: string;
    status?: string;
  }>,
): ShiftInterval[] {
  return rows.map((row) => ({
    id: row.id,
    staffId: row.staff_id,
    shiftDate: row.shift_date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
  }));
}

async function loadDayPeers(
  admin: Admin,
  propertyId: string,
  staffId: string,
  shiftDate: string,
): Promise<ShiftInterval[]> {
  const { data: peers } = await admin
    .from("staff_shifts")
    .select("id, staff_id, shift_date, starts_at, ends_at, status")
    .eq("property_id", propertyId)
    .eq("staff_id", staffId)
    .eq("shift_date", shiftDate)
    .in("status", ["draft", "published"]);
  return toShiftIntervals(
    (peers ?? []) as Array<{
      id: string;
      staff_id: string;
      shift_date: string;
      starts_at: string;
      ends_at: string;
      status: string;
    }>,
  );
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
    if (outlet && !isShiftOutlet(outlet)) throw new Error("Invalid outlet.");
    if (endsAt <= startsAt) throw new Error("End time must be after start time.");

    const { data: staff } = await admin
      .from("staff_members")
      .select("id")
      .eq("id", staffId)
      .eq("property_id", propertyId)
      .in("status", ["active", "on_leave"])
      .maybeSingle();
    if (!staff) throw new Error("Staff member not found for this property.");

    const peers = await loadDayPeers(admin, propertyId, staffId, shiftDate);
    assertNoOverlap(
      {
        id: id ?? undefined,
        staffId,
        shiftDate,
        startsAt,
        endsAt,
      },
      peers,
      { ignoreId: id },
    );

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
      if (error) {
        throw new Error(shiftSaveErrorMessage(error, "Could not update shift."));
      }
    } else {
      const { error } = await admin
        .from("staff_shifts")
        .insert({ ...record, status: "draft" });
      if (error) {
        throw new Error(shiftSaveErrorMessage(error, "Could not add shift."));
      }
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

/** Copy an entire week of shifts forward as fresh drafts; skip conflicts. */
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
    const targetEnd = addDays(targetWeek, 7);
    const { data: shifts, error } = await admin
      .from("staff_shifts")
      .select("staff_id, shift_date, starts_at, ends_at, outlet, notes, status")
      .eq("property_id", propertyId)
      .gte("shift_date", sourceWeek)
      .lt("shift_date", sourceEnd)
      .in("status", ["draft", "published"]);
    if (error) throw new Error("Could not read the source week.");
    if (!shifts?.length) throw new Error("The source week has no shifts to copy.");

    const { data: existing } = await admin
      .from("staff_shifts")
      .select("id, staff_id, shift_date, starts_at, ends_at, status")
      .eq("property_id", propertyId)
      .gte("shift_date", targetWeek)
      .lt("shift_date", targetEnd)
      .in("status", ["draft", "published"]);

    const targetPeers = toShiftIntervals(
      (existing ?? []) as Array<{
        id: string;
        staff_id: string;
        shift_date: string;
        starts_at: string;
        ends_at: string;
        status: string;
      }>,
    );

    const offsetDays =
      (new Date(`${targetWeek}T00:00:00Z`).getTime() -
        new Date(`${sourceWeek}T00:00:00Z`).getTime()) /
      86_400_000;

    const rows: Array<Record<string, unknown>> = [];
    const skipped: string[] = [];
    const planned: ShiftInterval[] = [...targetPeers];

    for (const shift of shifts) {
      const staffId = shift.staff_id as string;
      const shiftDate = addDays(shift.shift_date as string, offsetDays);
      const startsAt = shift.starts_at as string;
      const endsAt = shift.ends_at as string;
      const candidate: ShiftInterval = {
        staffId,
        shiftDate,
        startsAt,
        endsAt,
        status: "draft",
      };
      try {
        assertNoOverlap(candidate, planned);
      } catch (overlapError) {
        skipped.push(
          `${shiftDate} staff ${staffId.slice(0, 8)}…: ${
            overlapError instanceof Error ? overlapError.message : "conflict"
          }`,
        );
        continue;
      }
      planned.push(candidate);
      rows.push({
        property_id: propertyId,
        staff_id: staffId,
        shift_date: shiftDate,
        starts_at: startsAt,
        ends_at: endsAt,
        outlet: shift.outlet as string | null,
        notes: shift.notes as string | null,
        status: "draft",
      });
    }

    if (!rows.length) {
      return {
        ok: false,
        error: "No shifts could be copied — every slot conflicted on the target week.",
        details: skipped.slice(0, 20),
      };
    }

    const { error: insertError } = await admin.from("staff_shifts").insert(rows);
    if (insertError) {
      throw new Error(shiftSaveErrorMessage(insertError, "Could not copy the week."));
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "rota.copy_week",
      entityType: "staff_shifts",
      summary: `Copied ${rows.length} shifts from ${sourceWeek} to ${targetWeek} (skipped ${skipped.length})`,
      meta: { sourceWeek, targetWeek, count: rows.length, skipped: skipped.length },
    });

    refreshRota();
    return {
      ok: true,
      message:
        skipped.length > 0
          ? `${rows.length} shifts copied as drafts; ${skipped.length} skipped (conflicts).`
          : `${rows.length} shifts copied as drafts.`,
      details: skipped.length ? skipped.slice(0, 20) : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not copy week.",
    };
  }
}

/** Generate draft shifts for a week from active cover templates. */
export async function autoGenerateRotaWeek(
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
    const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

    const [{ data: templates }, { data: staffRows }, { data: existing }, { data: leave }] =
      await Promise.all([
        admin
          .from("rota_cover_templates")
          .select(
            "id, name, outlet, days_of_week, starts_at, ends_at, slots_needed, preferred_role_labels, preferred_position_ilike, priority",
          )
          .eq("property_id", propertyId)
          .eq("is_active", true)
          .order("priority"),
        admin
          .from("staff_members")
          .select("id, full_name, role_label, position_title, status")
          .eq("property_id", propertyId)
          .eq("status", "active")
          .order("full_name"),
        admin
          .from("staff_shifts")
          .select("id, staff_id, shift_date, starts_at, ends_at, status")
          .eq("property_id", propertyId)
          .gte("shift_date", weekStart)
          .lt("shift_date", weekEnd)
          .in("status", ["draft", "published"]),
        admin
          .from("staff_leave")
          .select("staff_id, starts_on, ends_on, status")
          .eq("property_id", propertyId)
          .eq("status", "approved")
          .lte("starts_on", addDays(weekStart, 6))
          .gte("ends_on", weekStart),
      ]);

    if (!templates?.length) {
      throw new Error("No active cover templates. Add templates first.");
    }
    if (!staffRows?.length) {
      throw new Error("No active staff available for auto-rota.");
    }

    const planned = toShiftIntervals(
      (existing ?? []) as Array<{
        id: string;
        staff_id: string;
        shift_date: string;
        starts_at: string;
        ends_at: string;
        status: string;
      }>,
    );

    const onLeave = (staffId: string, date: string): boolean =>
      (leave ?? []).some(
        (row) =>
          row.staff_id === staffId &&
          (row.starts_on as string) <= date &&
          (row.ends_on as string) >= date,
      );

    type StaffPick = {
      id: string;
      full_name: string;
      role_label: string;
      position_title: string | null;
    };
    const staff = (staffRows ?? []) as StaffPick[];
    const rows: Array<Record<string, unknown>> = [];
    const unfilled: string[] = [];

    const roleMatch = (member: StaffPick, roles: string[]): boolean => {
      if (!roles.length) return true;
      return roles.some((role) => role.toLowerCase() === member.role_label.toLowerCase());
    };

    const positionMatch = (member: StaffPick, pattern: string | null): boolean => {
      if (!pattern) return true;
      const hay = (member.position_title ?? "").toLowerCase();
      // preferred_position_ilike uses SQL ILIKE wildcards (%).
      const regex = new RegExp(
        `^${pattern
          .toLowerCase()
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          .replace(/%/g, ".*")}$`,
      );
      return regex.test(hay);
    };

    for (const template of templates) {
      const startsAt = String(template.starts_at).slice(0, 8);
      const endsAt = String(template.ends_at).slice(0, 8);
      const startNorm = startsAt.length === 5 ? `${startsAt}:00` : startsAt;
      const endNorm = endsAt.length === 5 ? `${endsAt}:00` : endsAt;
      if (endNorm <= startNorm) continue;

      const daysOfWeek = (template.days_of_week as number[] | null) ?? [];
      const roles = (template.preferred_role_labels as string[] | null) ?? [];
      const posPattern = (template.preferred_position_ilike as string | null) ?? null;
      const slots = Number(template.slots_needed ?? 1);

      for (const date of days) {
        if (!templateAppliesOnDay(daysOfWeek, date)) continue;

        let filled = 0;
        const candidates = staff
          .filter((member) => roleMatch(member, roles))
          .filter((member) => positionMatch(member, posPattern))
          .filter((member) => !onLeave(member.id, date))
          .sort((a, b) => a.full_name.localeCompare(b.full_name));

        // Prefer role-matched; fall back to any free active staff if filters empty of free people.
        const tryPools = [candidates, staff.filter((m) => !onLeave(m.id, date))];

        for (const pool of tryPools) {
          for (const member of pool) {
            if (filled >= slots) break;
            const candidate: ShiftInterval = {
              staffId: member.id,
              shiftDate: date,
              startsAt: startNorm,
              endsAt: endNorm,
              status: "draft",
            };
            try {
              assertNoOverlap(candidate, planned);
            } catch {
              continue;
            }
            planned.push(candidate);
            rows.push({
              property_id: propertyId,
              staff_id: member.id,
              shift_date: date,
              starts_at: startNorm,
              ends_at: endNorm,
              outlet: template.outlet as string,
              notes: `Auto: ${template.name as string}`,
              status: "draft",
            });
            filled += 1;
          }
          if (filled >= slots) break;
        }

        if (filled < slots) {
          unfilled.push(
            `${date} ${template.name as string}: need ${slots}, filled ${filled}`,
          );
        }
      }
    }

    if (!rows.length) {
      return {
        ok: false,
        error: "Could not place any cover slots (all staff leave/busy or no matches).",
        details: unfilled.slice(0, 20),
      };
    }

    const { error: insertError } = await admin.from("staff_shifts").insert(rows);
    if (insertError) {
      throw new Error(
        shiftSaveErrorMessage(insertError, "Could not generate draft rota."),
      );
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "rota.auto_generate",
      entityType: "staff_shifts",
      summary: `Auto-generated ${rows.length} draft shifts for week ${weekStart}`,
      meta: {
        weekStart,
        created: rows.length,
        unfilled: unfilled.length,
        templates: templates.length,
      },
    });

    refreshRota();
    return {
      ok: true,
      message:
        unfilled.length > 0
          ? `Generated ${rows.length} draft shifts; ${unfilled.length} slots underfilled.`
          : `Generated ${rows.length} draft shifts from cover templates.`,
      details: unfilled.length ? unfilled.slice(0, 20) : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not auto-generate rota.",
    };
  }
}

export async function upsertRotaCoverTemplate(
  _previous: RotaActionState,
  formData: FormData,
): Promise<RotaActionState> {
  try {
    const { admin, propertyId } = await requireRotaDesk();
    const id = optionalTrim(formData.get("id"));
    const name = trimRequired(formData.get("name"), "Name");
    const outlet = trimRequired(formData.get("outlet"), "Outlet").toLowerCase();
    if (!isShiftOutlet(outlet)) throw new Error("Invalid outlet.");
    const startsAt = assertTime(trimRequired(formData.get("starts_at"), "Start"), "Start");
    const endsAt = assertTime(trimRequired(formData.get("ends_at"), "End"), "End");
    if (endsAt <= startsAt) throw new Error("End time must be after start time.");

    const slotsNeeded = Math.min(
      20,
      Math.max(1, Number(formData.get("slots_needed") ?? 1) || 1),
    );
    const priority = Number(formData.get("priority") ?? 100) || 100;
    const daysRaw = formData.getAll("days_of_week").map(String);
    const daysOfWeek = daysRaw
      .map((d) => Number(d))
      .filter((d) => d >= 1 && d <= 7);
    const rolesRaw = optionalTrim(formData.get("preferred_role_labels"));
    const preferredRoles = rolesRaw
      ? rolesRaw
          .split(/[,|]/)
          .map((r) => r.trim().toLowerCase())
          .filter(Boolean)
      : [];

    const record = {
      property_id: propertyId,
      name,
      outlet,
      days_of_week: daysOfWeek,
      starts_at: startsAt,
      ends_at: endsAt,
      slots_needed: slotsNeeded,
      preferred_role_labels: preferredRoles,
      preferred_position_ilike: optionalTrim(formData.get("preferred_position_ilike")),
      priority,
      is_active: formData.get("is_active") !== "off",
      notes: optionalTrim(formData.get("notes")),
      updated_at: new Date().toISOString(),
    };

    if (id) {
      const { error } = await admin
        .from("rota_cover_templates")
        .update(record)
        .eq("id", id)
        .eq("property_id", propertyId);
      if (error) throw new Error("Could not update cover template.");
    } else {
      const { error } = await admin.from("rota_cover_templates").insert(record);
      if (error) throw new Error("Could not create cover template.");
    }

    refreshRota();
    return { ok: true, message: id ? "Cover template updated." : "Cover template added." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save template.",
    };
  }
}

export async function deleteRotaCoverTemplate(
  _previous: RotaActionState,
  formData: FormData,
): Promise<RotaActionState> {
  try {
    const { admin, propertyId } = await requireRotaDesk();
    const id = trimRequired(formData.get("id"), "Template");
    const { error } = await admin
      .from("rota_cover_templates")
      .delete()
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) throw new Error("Could not delete template.");
    refreshRota();
    return { ok: true, message: "Cover template deleted." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not delete template.",
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
