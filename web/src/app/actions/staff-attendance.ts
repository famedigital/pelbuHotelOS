"use server";

import { insertAttendanceEvent } from "@/lib/attendance";
import { normalizeBiometricUserId, normalizeDeviceSn } from "@/lib/zk-adms";
import { replayUnmatchedPunches } from "@/lib/zk-adms-server";
import {
  ATTENDANCE_KINDS,
  type AttendanceKind,
} from "@/lib/attendance-types";
import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { requireStaffSession, staffAuthEmail, validateStaffPin } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

export type AttendanceActionResult = {
  ok: boolean;
  error?: string;
  message?: string;
  event?: {
    id: string;
    kind: AttendanceKind;
    occurredAt: string;
    duplicate: boolean;
  };
};

type AttendanceInput = {
  kind: AttendanceKind;
  occurredAt: string;
  clientEventId: string;
  offline?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
};

function assertKind(value: string): AttendanceKind {
  if (!ATTENDANCE_KINDS.includes(value as AttendanceKind)) {
    throw new Error("Invalid attendance event.");
  }
  return value as AttendanceKind;
}

function refreshAttendance(): void {
  revalidatePath("/staff");
  revalidatePath("/erp/hr/attendance");
  revalidatePath("/erp/hr");
}

/** Mobile PWA punch. Offline clients may replay with the original timestamp. */
export async function recordStaffAttendance(
  input: AttendanceInput,
): Promise<AttendanceActionResult> {
  try {
    const session = await requireStaffSession();
    const kind = assertKind(input.kind);
    if (!input.clientEventId?.trim()) throw new Error("Missing event ID.");

    const admin = createSupabaseAdminClient();
    const saved = await insertAttendanceEvent(admin, {
      propertyId: session.propertyId,
      staffId: session.staffId,
      kind,
      source: input.offline ? "offline_sync" : "staff_mobile",
      occurredAt: input.occurredAt,
      clientEventId: input.clientEventId.trim().slice(0, 100),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      accuracyMeters: input.accuracyMeters ?? null,
      recordedBy: session.employeeCode,
    });

    if (!saved.duplicate) {
      await writeAuditEvent(admin, {
        propertyId: session.propertyId,
        action: `attendance.${kind}`,
        entityType: "staff_attendance_events",
        entityId: saved.id,
        summary: `${session.fullName} ${kind.replaceAll("_", " ")}`,
        actor: session.employeeCode,
        meta: { source: input.offline ? "offline_sync" : "staff_mobile" },
      });
    }

    refreshAttendance();
    return {
      ok: true,
      message: saved.duplicate ? "Punch already synced." : "Attendance recorded.",
      event: { ...saved, kind },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not record attendance.",
    };
  }
}

export type KioskAttendanceState = AttendanceActionResult;

export type AttendanceDeviceState = {
  ok: boolean;
  error?: string;
  message?: string;
  deviceId?: string;
  secret?: string;
};

/** Register a biometric clock or attendance integration; reveals its secret once. */
export async function createAttendanceDevice(
  _previous: AttendanceDeviceState,
  formData: FormData,
): Promise<AttendanceDeviceState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }
    const name = String(formData.get("name") ?? "").trim();
    const deviceType = String(formData.get("device_type") ?? "").trim();
    const rawRef = String(formData.get("external_ref") ?? "").trim();
    let externalRef: string | null = null;
    if (rawRef) {
      externalRef = normalizeDeviceSn(rawRef);
      if (!externalRef) {
        throw new Error(
          "Serial number should be the letters and numbers printed on the clock (at least 4 characters).",
        );
      }
    }
    if (name.length < 2 || name.length > 80) {
      throw new Error("Device name must be 2–80 characters.");
    }
    if (!["biometric", "integration"].includes(deviceType)) {
      throw new Error("Invalid device type.");
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const secret = randomBytes(32).toString("base64url");
    const secretHash = createHash("sha256").update(secret).digest("hex");
    const { data, error } = await admin
      .from("attendance_devices")
      .insert({
        property_id: propertyId,
        name,
        device_type: deviceType,
        external_ref: externalRef,
        secret_hash: secretHash,
      })
      .select("id")
      .single();
    if (error || !data) {
      if (error?.code === "23505") {
        throw new Error("That serial number is already registered.");
      }
      throw new Error("Could not register attendance device.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "attendance.device_create",
      entityType: "attendance_devices",
      entityId: data.id as string,
      summary: `Registered ${deviceType} attendance device: ${name}`,
      meta: { externalRef },
    });

    revalidatePath("/erp/hr/attendance");
    return {
      ok: true,
      message: "Device registered. Copy this secret now; it will not be shown again.",
      deviceId: data.id as string,
      secret,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not register device.",
    };
  }
}

/**
 * Shared kiosk punch. Verifies the employee code + PIN without replacing the
 * desk/kiosk browser session.
 */
export async function recordKioskAttendance(
  _previous: KioskAttendanceState,
  formData: FormData,
): Promise<KioskAttendanceState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Kiosk session expired. Ask the desk to unlock it.");
    }

    const employeeCode = String(formData.get("employee_code") ?? "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "-");
    const pin = validateStaffPin(String(formData.get("pin") ?? ""));
    const kind = assertKind(String(formData.get("kind") ?? ""));
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);

    const { data: staff } = await admin
      .from("staff_members")
      .select(
        "id, property_id, employee_code, full_name, auth_user_id, can_login, status",
      )
      .eq("property_id", propertyId)
      .eq("employee_code", employeeCode)
      .in("status", ["active", "on_leave"])
      .maybeSingle();
    if (!staff?.can_login || !staff.auth_user_id) {
      throw new Error("Incorrect employee code or PIN.");
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!url || !key) throw new Error("Kiosk authentication is not configured.");
    const verifier = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: authError } = await verifier.auth.signInWithPassword({
      email: staffAuthEmail(propertyId, employeeCode),
      password: pin,
    });
    if (authError) throw new Error("Incorrect employee code or PIN.");

    const clientEventId =
      String(formData.get("client_event_id") ?? "").trim() ||
      `kiosk-${crypto.randomUUID()}`;
    const saved = await insertAttendanceEvent(admin, {
      propertyId,
      staffId: staff.id as string,
      kind,
      source: "kiosk",
      occurredAt: new Date().toISOString(),
      clientEventId,
      recordedBy: `kiosk:${employeeCode}`,
    });

    if (!saved.duplicate) {
      await writeAuditEvent(admin, {
        propertyId,
        action: `attendance.${kind}`,
        entityType: "staff_attendance_events",
        entityId: saved.id,
        summary: `${staff.full_name as string} ${kind.replaceAll("_", " ")} at kiosk`,
        actor: employeeCode,
        meta: { source: "kiosk" },
      });
    }

    refreshAttendance();
    return {
      ok: true,
      message: `${staff.full_name as string}: ${kind.replaceAll("_", " ")} recorded.`,
      event: { ...saved, kind },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not record kiosk punch.",
    };
  }
}

export type BiometricLinkState = {
  ok: boolean;
  error?: string;
  message?: string;
};

/** Map a network-clock user ID to a staff member and import any waiting punches. */
export async function setStaffBiometricId(
  _previous: BiometricLinkState,
  formData: FormData,
): Promise<BiometricLinkState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }
    const staffId = String(formData.get("staff_id") ?? "").trim();
    const rawPin = String(formData.get("biometric_user_id") ?? "").trim();
    const biometricUserId = rawPin ? normalizeBiometricUserId(rawPin) : null;
    if (rawPin && !biometricUserId) {
      throw new Error(
        "Clock user ID should be the number stored on the clock (letters and digits only).",
      );
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: staff } = await admin
      .from("staff_members")
      .select("id, full_name")
      .eq("property_id", propertyId)
      .eq("id", staffId)
      .in("status", ["active", "on_leave"])
      .maybeSingle();
    if (!staff) throw new Error("Choose a staff member.");

    const { error } = await admin
      .from("staff_members")
      .update({
        biometric_user_id: biometricUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", staffId)
      .eq("property_id", propertyId);
    if (error) {
      if (error.code === "23505") {
        throw new Error("That clock user ID is already linked to someone else.");
      }
      throw new Error("Could not save the clock user ID.");
    }

    const name = staff.full_name as string;
    let imported = 0;
    if (biometricUserId) {
      const { data: property } = await admin
        .from("properties")
        .select("timezone")
        .eq("id", propertyId)
        .maybeSingle();
      imported = await replayUnmatchedPunches(admin, {
        propertyId,
        staffId,
        biometricUserId,
        timeZone: (property?.timezone as string | null)?.trim() || "Asia/Thimphu",
      });
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "attendance.biometric_link",
      entityType: "staff_members",
      entityId: staffId,
      summary: biometricUserId
        ? `Linked clock user ${biometricUserId} to ${name}`
        : `Removed the clock user ID for ${name}`,
      meta: { biometricUserId, imported },
    });

    refreshAttendance();
    if (!biometricUserId) {
      return { ok: true, message: `Removed the clock user ID for ${name}.` };
    }
    return {
      ok: true,
      message:
        imported > 0
          ? `Linked clock user ${biometricUserId} to ${name}. Imported ${imported} earlier ${imported === 1 ? "punch" : "punches"}.`
          : `Linked clock user ${biometricUserId} to ${name}.`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save the clock user ID.",
    };
  }
}
