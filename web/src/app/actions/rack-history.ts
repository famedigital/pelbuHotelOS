"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  snapshotStayBeforeEdit,
  type RackAssignmentSnap,
  type RackStaySnap,
} from "@/lib/erp/rack-history";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type RackHistoryRow = {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  summary: string;
  bookingId: string | null;
  guest: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

export async function listRackHistory(): Promise<RackHistoryRow[]> {
  await requireDesk();
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const { data, error } = await admin
    .from("audit_events")
    .select("id, created_at, actor, action, summary, entity_id, meta")
    .eq("property_id", propertyId)
    .in("action", ["rack.snapshot", "rack.restore"])
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const meta = (row.meta ?? {}) as { before?: RackStaySnap };
    const guest =
      (meta.before?.booking?.contact_name as string | undefined) ?? null;
    return {
      id: row.id as string,
      createdAt: row.created_at as string,
      actor: (row.actor as string) || "desk",
      action: row.action as string,
      summary: row.summary as string,
      bookingId: (row.entity_id as string | null) ?? null,
      guest,
    };
  });
}

const RESTORE_FIELDS = [
  "contact_name",
  "contact_phone",
  "status",
  "check_in",
  "check_out",
  "notes",
  "adults",
  "children",
  "rooms",
  "meal_plan_code",
  "guide_number",
  "payment_mode",
  "external_ref",
] as const;

/** Puts one saved stay back, and writes a new snapshot of what it replaced. */
export async function restoreRackRevision(
  eventId: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    await requireDesk();
    if (!UUID_RE.test(eventId)) throw new Error("Invalid history row.");
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: event, error } = await admin
      .from("audit_events")
      .select("id, entity_id, meta, summary")
      .eq("id", eventId)
      .eq("property_id", propertyId)
      .in("action", ["rack.snapshot", "rack.restore"])
      .maybeSingle();
    if (error || !event) throw new Error("History row not found.");

    const before = (
      (event.meta ?? {}) as { before?: RackStaySnap }
    ).before;
    const booking = before?.booking;
    const bookingId = (booking?.id as string | undefined) ?? (event.entity_id as string);
    if (!booking || !bookingId) throw new Error("That row has nothing to restore.");

    await snapshotStayBeforeEdit(admin, propertyId, {
      bookingId,
      summary: `Before restore · ${event.summary as string}`,
    });

    const patch: Record<string, unknown> = {};
    for (const key of RESTORE_FIELDS) {
      if (key in booking) patch[key] = booking[key];
    }
    const { error: upErr } = await admin
      .from("bookings")
      .update(patch)
      .eq("id", bookingId)
      .eq("property_id", propertyId);
    if (upErr) throw new Error(upErr.message);

    const assignments = (before.assignments ?? []) as RackAssignmentSnap[];
    for (const row of assignments) {
      if (!row.id || !row.room_unit_id) continue;
      const { error: aErr } = await admin
        .from("room_assignments")
        .update({
          room_unit_id: row.room_unit_id,
          from_date: row.from_date,
          to_date: row.to_date,
        })
        .eq("id", row.id)
        .eq("property_id", propertyId)
        .eq("booking_id", bookingId);
      if (aErr) {
        throw new Error(
          `Stay text restored. Door ${row.room_unit_id} could not move back: ${aErr.message}`,
        );
      }
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "rack.restore",
      entityType: "booking",
      entityId: bookingId,
      summary: `Restored · ${event.summary as string}`,
      meta: { before, restoredFrom: eventId },
    });

    revalidatePath("/erp/calendar");
    revalidatePath("/erp/stayview");
    revalidatePath("/erp");
    const guest = (booking.contact_name as string | null) || "Stay";
    return { ok: true, message: `${guest} restored.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restore failed." };
  }
}
