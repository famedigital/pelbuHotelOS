import {
  allowedAttendanceEvents,
  type AttendanceKind,
} from "@/lib/attendance-types";

/** Ignore a second scan this soon after the previous one. */
export const ZK_DEBOUNCE_MS = 90_000;

const DEVICE_SN = /^[A-Z0-9-]{4,40}$/;
const BIOMETRIC_ID = /^[A-Z0-9]{1,24}$/;
const WALL_TIME = /(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/;
const OFFSET_NAME = /GMT([+-])(\d{1,2})(?::(\d{2}))?/;

export type ZkPunchIntent = AttendanceKind | "auto";

export type AttlogRow = {
  pin: string;
  /** Clock-local `YYYY-MM-DD HH:mm:ss`. */
  wall: string;
  status: string;
};

export function normalizeDeviceSn(raw: string | null | undefined): string | null {
  const sn = raw?.trim().toUpperCase() ?? "";
  return DEVICE_SN.test(sn) ? sn : null;
}

export function normalizeBiometricUserId(raw: string | null | undefined): string | null {
  const id = raw?.trim().toUpperCase() ?? "";
  return BIOMETRIC_ID.test(id) ? id : null;
}

export function offsetForTimeZone(timeZone: string, date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
      hour: "2-digit",
    }).formatToParts(date);
    const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    const match = name.match(OFFSET_NAME);
    if (!match) return "+06:00";
    const hours = match[2] ?? "6";
    const minutes = match[3] ?? "00";
    return `${match[1]}${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
  } catch {
    return "+06:00";
  }
}

/** ZKTeco TimeZone field: hours offset from UTC. Bhutan is `6`. */
export function zkTimeZoneValue(timeZone: string, date = new Date()): string {
  const offset = offsetForTimeZone(timeZone, date);
  const sign = offset.startsWith("-") ? -1 : 1;
  const hours = Number(offset.slice(1, 3));
  const minutes = Number(offset.slice(4, 6));
  const value = sign * (hours + minutes / 60);
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

/**
 * Interpret a clock's wall time as property-local time.
 * Network clocks send `2026-09-28 09:15:22` with no offset.
 */
export function wallTimeToIso(wall: string, timeZone: string): string {
  const match = wall.trim().match(WALL_TIME);
  if (!match) throw new Error("Invalid clock time.");
  const normalized = `${match[1]}T${match[2]}`;
  const guess = new Date(`${normalized}Z`);
  if (Number.isNaN(guess.getTime())) throw new Error("Invalid clock time.");
  const first = offsetForTimeZone(timeZone, guess);
  const refined = offsetForTimeZone(timeZone, new Date(`${normalized}${first}`));
  return `${normalized}${refined}`;
}

export function localDateKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function zkCrossedDay(
  previousIso: string | null,
  punchIso: string,
  timeZone: string,
): boolean {
  if (!previousIso) return false;
  return localDateKey(previousIso, timeZone) < localDateKey(punchIso, timeZone);
}

export function withinZkDebounce(
  previousIso: string | null,
  punchIso: string,
  crossedDay: boolean,
): boolean {
  if (!previousIso || crossedDay) return false;
  const delta = new Date(punchIso).getTime() - new Date(previousIso).getTime();
  return delta >= 0 && delta < ZK_DEBOUNCE_MS;
}

/**
 * Attendance-only handshake. TransFlag bit 1 is attendance records.
 * Operation logs, photos, and fingerprint templates stay off the wire.
 */
export function zkHandshake(sn: string, stamp: string, timeZone: string): string {
  const safeStamp = /^[0-9]{1,20}$/.test(stamp) ? stamp : "0";
  return [
    `GET OPTION FROM: ${sn}`,
    `ATTLOGStamp=${safeStamp}`,
    "OPERLOGStamp=9999999999",
    "ATTPHOTOStamp=9999999999",
    "ErrorDelay=60",
    "Delay=10",
    "TransTimes=00:00;14:05",
    "TransInterval=1",
    "TransFlag=1000000000",
    `TimeZone=${zkTimeZoneValue(timeZone)}`,
    "Realtime=1",
    "Encrypt=None",
    "ServerVer=2.4.1",
    "",
  ].join("\r\n");
}

/**
 * ZK status: 0 in, 1 out, 2 break out, 3 break in, 4 overtime in, 5 overtime out.
 * Missing or 255 means the clock did not choose a direction.
 */
export function zkStatusToIntent(status: string): ZkPunchIntent {
  const trimmed = status.trim();
  if (!trimmed) return "auto";
  const value = Number(trimmed);
  if (!Number.isInteger(value)) return "auto";
  switch (value) {
    case 0:
    case 4:
      return "clock_in";
    case 1:
    case 5:
      return "clock_out";
    case 2:
      return "break_start";
    case 3:
      return "break_end";
    default:
      return "auto";
  }
}

/**
 * Clocks often send status 0 for every scan. Honor an explicit direction when
 * it fits; otherwise alternate in and out. A new day closes yesterday's open
 * shift and starts a fresh arrival.
 */
export function resolveZkKind(args: {
  intent: ZkPunchIntent;
  previous: AttendanceKind | null;
  crossedDay: boolean;
  withinDebounce: boolean;
}): { actions: AttendanceKind[] } | { skip: true } {
  if (args.withinDebounce && args.previous) return { skip: true };

  if (
    args.intent !== "auto" &&
    allowedAttendanceEvents(args.previous).includes(args.intent)
  ) {
    return { actions: [args.intent] };
  }

  const open =
    args.previous === "clock_in" ||
    args.previous === "break_end" ||
    args.previous === "break_start";

  if (args.crossedDay && open && args.intent !== "clock_out") {
    const actions: AttendanceKind[] = [];
    if (args.previous === "break_start") actions.push("break_end");
    actions.push("clock_out", "clock_in");
    return { actions };
  }

  if (args.intent === "clock_out") return { skip: true };
  if (args.intent === "clock_in" && open) return { actions: ["clock_out"] };
  if (args.previous === "clock_in" || args.previous === "break_end") {
    return { actions: ["clock_out"] };
  }
  if (args.previous === "break_start") return { actions: ["break_end"] };
  return { actions: ["clock_in"] };
}

export function parseAttlog(body: string): AttlogRow[] {
  const rows: AttlogRow[] = [];
  for (const rawLine of body.replace(/\0/g, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const row = line.includes("=") ? parseKeyLine(line) : parseTabLine(line);
    if (row) rows.push(row);
  }
  return rows;
}

function parseTabLine(line: string): AttlogRow | null {
  const parts = line.split("\t");
  if (parts.length > 1) {
    const pin = normalizeBiometricUserId(parts[0]);
    const wall = normalizeWall(parts[1] ?? "");
    if (!pin || !wall) return null;
    return { pin, wall, status: (parts[2] ?? "").trim() };
  }
  const match = line.match(
    /^(\S+)\s+(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\s+(\S+))?/,
  );
  if (!match) return null;
  const pin = normalizeBiometricUserId(match[1]);
  if (!pin) return null;
  return {
    pin,
    wall: `${match[2]} ${match[3]}`,
    status: (match[4] ?? "").trim(),
  };
}

function parseKeyLine(line: string): AttlogRow | null {
  const fields = new Map<string, string>();
  for (const piece of line.split("\t")) {
    const eq = piece.indexOf("=");
    if (eq <= 0) continue;
    fields.set(piece.slice(0, eq).trim().toLowerCase(), piece.slice(eq + 1).trim());
  }
  const pin = normalizeBiometricUserId(
    fields.get("pin") ?? fields.get("userid") ?? "",
  );
  const wall = normalizeWall(
    fields.get("datetime") ?? fields.get("time") ?? "",
  );
  if (!pin || !wall) return null;
  return {
    pin,
    wall,
    status: fields.get("status") ?? fields.get("attstate") ?? "",
  };
}

function normalizeWall(value: string): string | null {
  const match = value.trim().match(WALL_TIME);
  if (!match) return null;
  return `${match[1]} ${match[2]}`;
}
