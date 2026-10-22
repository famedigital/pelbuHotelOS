import "server-only";

import { writeAuditEvent } from "@/lib/audit";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

const BOOKING_FIELDS =
  "id, contact_name, contact_phone, status, check_in, check_out, notes, adults, children, rooms, meal_plan_code, guide_number, payment_mode, external_ref";

export type RackAssignmentSnap = {
  id: string;
  room_unit_id: string;
  from_date: string;
  to_date: string;
};

export type RackStaySnap = {
  booking: Record<string, unknown>;
  assignments: RackAssignmentSnap[];
};

/**
 * Writes the stay as it is now, before a paint, move, note edit, or restore.
 * Stored on audit_events.meta.before so History can put that stay back.
 */
export async function snapshotStayBeforeEdit(
  admin: Admin,
  propertyId: string,
  input: {
    bookingId?: string | null;
    assignmentId?: string | null;
    summary: string;
  },
): Promise<void> {
  let bookingId = input.bookingId ?? null;
  if (!bookingId && input.assignmentId) {
    const { data } = await admin
      .from("room_assignments")
      .select("booking_id")
      .eq("id", input.assignmentId)
      .eq("property_id", propertyId)
      .maybeSingle();
    bookingId = (data?.booking_id as string | null) ?? null;
  }
  if (!bookingId) return;

  const { data: booking } = await admin
    .from("bookings")
    .select(BOOKING_FIELDS)
    .eq("id", bookingId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!booking) return;

  const { data: assignments } = await admin
    .from("room_assignments")
    .select("id, room_unit_id, from_date, to_date")
    .eq("booking_id", bookingId)
    .eq("property_id", propertyId);

  const before: RackStaySnap = {
    booking: booking as Record<string, unknown>,
    assignments: (assignments ?? []) as RackAssignmentSnap[],
  };

  await writeAuditEvent(admin, {
    propertyId,
    action: "rack.snapshot",
    entityType: "booking",
    entityId: bookingId,
    summary: input.summary,
    meta: { before },
  });
}
