import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  allowedAttendanceEvents,
  type AttendanceKind,
  type AttendanceSource,
} from "@/lib/attendance-types";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export async function insertAttendanceEvent(
  admin: Admin,
  input: {
    propertyId: string;
    staffId: string;
    kind: AttendanceKind;
    source: AttendanceSource;
    occurredAt: string;
    clientEventId?: string | null;
    shiftId?: string | null;
    deviceId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    accuracyMeters?: number | null;
    notes?: string | null;
    recordedBy: string;
  },
): Promise<{ id: string; occurredAt: string; duplicate: boolean }> {
  const occurred = new Date(input.occurredAt);
  if (Number.isNaN(occurred.getTime())) throw new Error("Invalid attendance time.");

  const now = Date.now();
  if (occurred.getTime() > now + 5 * 60_000) {
    throw new Error("Attendance time cannot be in the future.");
  }
  if (
    ["staff_mobile", "offline_sync", "kiosk"].includes(input.source) &&
    occurred.getTime() < now - 24 * 60 * 60_000
  ) {
    throw new Error("Offline punches older than 24 hours need HR review.");
  }

  if (input.clientEventId) {
    const { data: existing } = await admin
      .from("staff_attendance_events")
      .select("id, occurred_at")
      .eq("property_id", input.propertyId)
      .eq("staff_id", input.staffId)
      .eq("client_event_id", input.clientEventId)
      .maybeSingle();
    if (existing) {
      return {
        id: existing.id as string,
        occurredAt: existing.occurred_at as string,
        duplicate: true,
      };
    }
  }

  const [{ data: latest }, { data: next }] = await Promise.all([
    admin
      .from("staff_attendance_events")
      .select("event_kind, occurred_at")
      .eq("property_id", input.propertyId)
      .eq("staff_id", input.staffId)
      .is("voided_at", null)
      .lte("occurred_at", input.occurredAt)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("staff_attendance_events")
      .select("event_kind, occurred_at")
      .eq("property_id", input.propertyId)
      .eq("staff_id", input.staffId)
      .is("voided_at", null)
      .gt("occurred_at", input.occurredAt)
      .order("occurred_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const previous = (latest?.event_kind as AttendanceKind | undefined) ?? null;
  if (!allowedAttendanceEvents(previous).includes(input.kind)) {
    const previousLabel = previous?.replaceAll("_", " ") ?? "no prior punch";
    throw new Error(
      `${input.kind.replaceAll("_", " ")} is not valid after ${previousLabel}.`,
    );
  }
  const nextKind = (next?.event_kind as AttendanceKind | undefined) ?? null;
  if (nextKind && !allowedAttendanceEvents(input.kind).includes(nextKind)) {
    throw new Error(
      `${input.kind.replaceAll("_", " ")} conflicts with the later ${nextKind.replaceAll("_", " ")} punch.`,
    );
  }

  const { data, error } = await admin
    .from("staff_attendance_events")
    .insert({
      property_id: input.propertyId,
      staff_id: input.staffId,
      shift_id: input.shiftId ?? null,
      device_id: input.deviceId ?? null,
      event_kind: input.kind,
      source: input.source,
      occurred_at: input.occurredAt,
      client_event_id: input.clientEventId ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      accuracy_meters: input.accuracyMeters ?? null,
      notes: input.notes?.trim().slice(0, 500) || null,
      recorded_by: input.recordedBy,
    })
    .select("id, occurred_at")
    .single();

  if (error || !data) {
    if (error?.code === "23505" && input.clientEventId) {
      const { data: existing } = await admin
        .from("staff_attendance_events")
        .select("id, occurred_at")
        .eq("property_id", input.propertyId)
        .eq("staff_id", input.staffId)
        .eq("client_event_id", input.clientEventId)
        .single();
      if (existing) {
        return {
          id: existing.id as string,
          occurredAt: existing.occurred_at as string,
          duplicate: true,
        };
      }
    }
    throw new Error("Could not record attendance.");
  }

  return {
    id: data.id as string,
    occurredAt: data.occurred_at as string,
    duplicate: false,
  };
}
