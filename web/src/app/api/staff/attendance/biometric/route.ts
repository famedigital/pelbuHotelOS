import { insertAttendanceEvent } from "@/lib/attendance";
import {
  ATTENDANCE_KINDS,
  type AttendanceKind,
} from "@/lib/attendance-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DevicePunch = {
  employee_code?: string;
  event_kind?: string;
  occurred_at?: string;
  external_event_id?: string;
  notes?: string;
};

function validSecret(provided: string, storedHash: string): boolean {
  const actual = Buffer.from(createHash("sha256").update(provided).digest("hex"));
  const expected = Buffer.from(storedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Vendor-neutral biometric clock endpoint.
 *
 * Headers:
 *   X-Pelbu-Device-Id: <attendance_devices.id>
 *   Authorization: Bearer <one-time device secret>
 *
 * Pelbu accepts attendance facts only; fingerprint/face templates remain on
 * the vendor device and are never transmitted or stored here.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const deviceId = request.headers.get("x-pelbu-device-id")?.trim();
    const auth = request.headers.get("authorization") ?? "";
    const secret = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!deviceId || !secret) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data: device } = await admin
      .from("attendance_devices")
      .select("id, property_id, device_type, secret_hash, is_active")
      .eq("id", deviceId)
      .maybeSingle();
    if (
      !device?.is_active ||
      !device.secret_hash ||
      !validSecret(secret, device.secret_hash as string)
    ) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as DevicePunch;
    const employeeCode = body.employee_code?.trim().toUpperCase();
    const kind = body.event_kind as AttendanceKind | undefined;
    const occurredAt = body.occurred_at?.trim();
    const externalEventId = body.external_event_id?.trim();
    if (!employeeCode || !kind || !ATTENDANCE_KINDS.includes(kind)) {
      return NextResponse.json(
        { ok: false, error: "employee_code and valid event_kind are required" },
        { status: 400 },
      );
    }
    if (!occurredAt || !externalEventId) {
      return NextResponse.json(
        { ok: false, error: "occurred_at and external_event_id are required" },
        { status: 400 },
      );
    }

    const { data: staff } = await admin
      .from("staff_members")
      .select("id, employee_code")
      .eq("property_id", device.property_id)
      .eq("employee_code", employeeCode)
      .in("status", ["active", "on_leave"])
      .maybeSingle();
    if (!staff) {
      return NextResponse.json(
        { ok: false, error: "employee not found" },
        { status: 404 },
      );
    }

    const source =
      device.device_type === "biometric" ? "biometric" : "integration";
    const saved = await insertAttendanceEvent(admin, {
      propertyId: device.property_id as string,
      staffId: staff.id as string,
      kind,
      source,
      occurredAt,
      clientEventId: `${deviceId}:${externalEventId}`.slice(0, 200),
      deviceId,
      notes: body.notes,
      recordedBy: `device:${deviceId}`,
    });

    await admin
      .from("attendance_devices")
      .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", deviceId);

    return NextResponse.json({
      ok: true,
      event_id: saved.id,
      duplicate: saved.duplicate,
      occurred_at: saved.occurredAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "attendance import failed",
      },
      { status: 400 },
    );
  }
}
