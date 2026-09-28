import { insertAttendanceEvent } from "@/lib/attendance";
import type { AttendanceKind, AttendanceSource } from "@/lib/attendance-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  normalizeDeviceSn,
  parseAttlog,
  resolveZkKind,
  wallTimeToIso,
  withinZkDebounce,
  zkCrossedDay,
  zkHandshake,
  zkStatusToIntent,
  type ZkPunchIntent,
} from "@/lib/zk-adms";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

type ClockDevice = {
  id: string;
  propertyId: string;
  deviceType: string;
  stamp: string;
  metadata: Record<string, unknown>;
};

type PunchOutcome = "saved" | "duplicate" | "skipped";

const BLOCKED_TABLES = new Set([
  "OPERLOG",
  "ATTPHOTO",
  "BIODATA",
  "FINGERTMP",
  "USERPIC",
  "ERRORLOG",
  "USERINFO",
]);

function plain(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isSoftPunchError(message: string): boolean {
  return (
    message.includes("not valid") ||
    message.includes("conflicts") ||
    message.includes("cannot be in the future") ||
    message.includes("Invalid attendance time")
  );
}

function stampsFor(punchIso: string, count: number): string[] {
  const punchMs = new Date(punchIso).getTime();
  return Array.from({ length: count }, (_, index) => {
    if (index === count - 1) return new Date(punchMs).toISOString();
    const fromEnd = count - 1 - index;
    return new Date(punchMs - fromEnd * 1000).toISOString();
  });
}

function punchEventId(
  deviceId: string,
  pin: string,
  wall: string,
  status: string,
): string {
  return `${deviceId}:${pin}:${wall}:${status || "auto"}`.slice(0, 180);
}

async function loadActiveDevice(admin: Admin, sn: string): Promise<ClockDevice | null> {
  const { data, error } = await admin
    .from("attendance_devices")
    .select("id, property_id, device_type, metadata")
    .eq("is_active", true)
    .ilike("external_ref", sn)
    .limit(2);
  if (error) throw new Error(error.message);
  if (!data || data.length !== 1) return null;
  const row = data[0];
  const metadata = asRecord(row.metadata);
  const stampRaw = metadata.attlog_stamp;
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    deviceType: row.device_type as string,
    stamp: typeof stampRaw === "string" && /^[0-9]+$/.test(stampRaw) ? stampRaw : "0",
    metadata,
  };
}

async function propertyTimeZone(admin: Admin, propertyId: string): Promise<string> {
  const { data, error } = await admin
    .from("properties")
    .select("timezone")
    .eq("id", propertyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const zone = (data?.timezone as string | null)?.trim();
  return zone || "Asia/Thimphu";
}

async function markDeviceSeen(
  admin: Admin,
  device: ClockDevice,
  stamp: string | null,
): Promise<void> {
  const patch: Record<string, unknown> = {
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (stamp) {
    patch.metadata = {
      ...device.metadata,
      attlog_stamp: stamp,
      protocol: "zkteco_adms",
    };
  }
  const { error } = await admin
    .from("attendance_devices")
    .update(patch)
    .eq("id", device.id);
  if (error) throw new Error(error.message);
}

async function loadStaffPins(
  admin: Admin,
  propertyId: string,
): Promise<Map<string, string>> {
  const { data, error } = await admin
    .from("staff_members")
    .select("id, employee_code, biometric_user_id")
    .eq("property_id", propertyId)
    .in("status", ["active", "on_leave"]);
  if (error) throw new Error(error.message);
  const byPin = new Map<string, string>();
  for (const row of data ?? []) {
    const code = String(row.employee_code ?? "").trim().toUpperCase();
    if (code && !byPin.has(code)) byPin.set(code, row.id as string);
  }
  for (const row of data ?? []) {
    const pin = String(row.biometric_user_id ?? "").trim().toUpperCase();
    if (pin) byPin.set(pin, row.id as string);
  }
  return byPin;
}

async function commitClockPunch(
  admin: Admin,
  input: {
    propertyId: string;
    staffId: string;
    deviceId: string | null;
    source: AttendanceSource;
    timeZone: string;
    punchIso: string;
    intent: ZkPunchIntent;
    clientEventId: string;
  },
): Promise<PunchOutcome> {
  const { data: latest, error } = await admin
    .from("staff_attendance_events")
    .select("event_kind, occurred_at")
    .eq("property_id", input.propertyId)
    .eq("staff_id", input.staffId)
    .is("voided_at", null)
    .lte("occurred_at", input.punchIso)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const previous = (latest?.event_kind as AttendanceKind | undefined) ?? null;
  const previousIso = (latest?.occurred_at as string | undefined) ?? null;
  const crossedDay = zkCrossedDay(previousIso, input.punchIso, input.timeZone);
  const decision = resolveZkKind({
    intent: input.intent,
    previous,
    crossedDay,
    withinDebounce: withinZkDebounce(previousIso, input.punchIso, crossedDay),
  });
  if ("skip" in decision) return "skipped";

  const times = stampsFor(input.punchIso, decision.actions.length);
  let saved = false;
  let duplicate = false;
  for (let index = 0; index < decision.actions.length; index += 1) {
    const kind = decision.actions[index] as AttendanceKind;
    const synthetic = index < decision.actions.length - 1;
    try {
      const result = await insertAttendanceEvent(admin, {
        propertyId: input.propertyId,
        staffId: input.staffId,
        kind,
        source: input.source,
        occurredAt: times[index] as string,
        clientEventId: synthetic
          ? `${input.clientEventId}:${index}:${kind}`.slice(0, 200)
          : input.clientEventId.slice(0, 200),
        deviceId: input.deviceId,
        notes: synthetic ? "Auto clock-out from an open shift." : null,
        recordedBy: input.deviceId ? `device:${input.deviceId}` : "device",
      });
      if (result.duplicate) duplicate = true;
      else saved = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (isSoftPunchError(message)) {
        if (saved) throw err;
        return "skipped";
      }
      throw err;
    }
  }
  if (saved) return "saved";
  if (duplicate) return "duplicate";
  return "skipped";
}

async function storeUnmatched(
  admin: Admin,
  input: {
    propertyId: string;
    deviceId: string;
    pin: string;
    punchIso: string;
    status: string;
    clientEventId: string;
  },
): Promise<void> {
  const { error } = await admin.from("attendance_unmatched_punches").insert({
    property_id: input.propertyId,
    device_id: input.deviceId,
    biometric_user_id: input.pin,
    occurred_at: input.punchIso,
    raw_status: input.status.slice(0, 16) || null,
    client_event_id: input.clientEventId,
  });
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function ingestZkAttlog(
  admin: Admin,
  input: {
    device: ClockDevice;
    body: string;
    timeZone: string;
    stamp: string | null;
  },
): Promise<{ accepted: number; skipped: number; unmatched: number }> {
  const rows = parseAttlog(input.body).sort(
    (a, b) => a.wall.localeCompare(b.wall) || a.pin.localeCompare(b.pin),
  );
  const staffByPin = await loadStaffPins(admin, input.device.propertyId);
  const source: AttendanceSource =
    input.device.deviceType === "integration" ? "integration" : "biometric";
  let accepted = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const row of rows) {
    let punchIso: string;
    try {
      punchIso = wallTimeToIso(row.wall, input.timeZone);
    } catch {
      skipped += 1;
      continue;
    }
    const eventId = punchEventId(input.device.id, row.pin, row.wall, row.status);
    const staffId = staffByPin.get(row.pin);
    if (!staffId) {
      await storeUnmatched(admin, {
        propertyId: input.device.propertyId,
        deviceId: input.device.id,
        pin: row.pin,
        punchIso,
        status: row.status,
        clientEventId: eventId,
      });
      unmatched += 1;
      continue;
    }
    const outcome = await commitClockPunch(admin, {
      propertyId: input.device.propertyId,
      staffId,
      deviceId: input.device.id,
      source,
      timeZone: input.timeZone,
      punchIso,
      intent: zkStatusToIntent(row.status),
      clientEventId: eventId,
    });
    if (outcome === "skipped") skipped += 1;
    else accepted += 1;
  }

  const stamp =
    input.stamp && /^[0-9]{1,20}$/.test(input.stamp) ? input.stamp : null;
  await markDeviceSeen(admin, input.device, stamp);
  console.info(
    "[iclock] accepted=%d skipped=%d unmatched=%d",
    accepted,
    skipped,
    unmatched,
  );
  return { accepted, skipped, unmatched };
}

/** Import punches that arrived before this clock user ID was linked. */
export async function replayUnmatchedPunches(
  admin: Admin,
  input: {
    propertyId: string;
    staffId: string;
    biometricUserId: string;
    timeZone: string;
  },
): Promise<number> {
  const { data, error } = await admin
    .from("attendance_unmatched_punches")
    .select("id, device_id, occurred_at, raw_status, client_event_id")
    .eq("property_id", input.propertyId)
    .eq("biometric_user_id", input.biometricUserId)
    .order("occurred_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);

  let imported = 0;
  for (const row of data ?? []) {
    try {
      const outcome = await commitClockPunch(admin, {
        propertyId: input.propertyId,
        staffId: input.staffId,
        deviceId: (row.device_id as string | null) ?? null,
        source: "biometric",
        timeZone: input.timeZone,
        punchIso: row.occurred_at as string,
        intent: zkStatusToIntent(String(row.raw_status ?? "")),
        clientEventId: String(row.client_event_id),
      });
      if (outcome === "saved") imported += 1;
      const { error: deleteError } = await admin
        .from("attendance_unmatched_punches")
        .delete()
        .eq("id", row.id as string);
      if (deleteError) throw new Error(deleteError.message);
    } catch (err) {
      console.error(
        "[iclock] replay failed",
        err instanceof Error ? err.message : err,
      );
      break;
    }
  }
  return imported;
}

/**
 * ZKTeco / eSSL ADMS push. The clock calls these paths itself.
 * Unknown serials are rejected so the clock keeps its log until it is registered.
 * Template and photo tables are acknowledged and discarded.
 */
export async function handleIclockRequest(
  request: Request,
  kind: "cdata" | "getrequest" | "devicecmd",
): Promise<Response> {
  const url = new URL(request.url);
  const sn = normalizeDeviceSn(url.searchParams.get("SN"));
  const limited = await rateLimit(`iclock:${clientIp(request.headers)}`, {
    limit: 180,
    windowMs: 60_000,
  });
  if (!limited.ok) return plain("busy", 429);
  if (!sn) return plain("unknown device", 404);

  try {
    const admin = createSupabaseAdminClient();
    const device = await loadActiveDevice(admin, sn);
    if (!device) return plain("unknown device", 404);

    if (kind !== "cdata") {
      if (request.method !== "GET") {
        await request.arrayBuffer().catch(() => undefined);
      }
      await markDeviceSeen(admin, device, null);
      return plain("OK\r\n");
    }

    const table = (url.searchParams.get("table") ?? "").trim().toUpperCase();
    if (BLOCKED_TABLES.has(table)) {
      await request.arrayBuffer().catch(() => undefined);
      await markDeviceSeen(admin, device, null);
      return plain("OK");
    }

    const timeZone = await propertyTimeZone(admin, device.propertyId);
    if (request.method === "GET" && table !== "ATTLOG") {
      await markDeviceSeen(admin, device, null);
      return plain(zkHandshake(sn, device.stamp, timeZone));
    }
    if (request.method !== "POST") {
      await markDeviceSeen(admin, device, null);
      return plain("OK");
    }

    const body = await request.text();
    if (body.length > 2_000_000) return plain("error", 413);
    await ingestZkAttlog(admin, {
      device,
      body,
      timeZone,
      stamp: url.searchParams.get("Stamp"),
    });
    return plain("OK");
  } catch (error) {
    console.error("[iclock]", error instanceof Error ? error.message : error);
    return plain("error", 500);
  }
}
