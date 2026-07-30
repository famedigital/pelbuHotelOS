export const ATTENDANCE_KINDS = [
  "clock_in",
  "clock_out",
  "break_start",
  "break_end",
] as const;

export type AttendanceKind = (typeof ATTENDANCE_KINDS)[number];

export type AttendanceSource =
  | "staff_mobile"
  | "offline_sync"
  | "kiosk"
  | "biometric"
  | "manual"
  | "integration";

const ALLOWED_NEXT: Record<AttendanceKind | "none", AttendanceKind[]> = {
  none: ["clock_in"],
  clock_in: ["break_start", "clock_out"],
  break_start: ["break_end", "clock_out"],
  break_end: ["break_start", "clock_out"],
  clock_out: ["clock_in"],
};

export function allowedAttendanceEvents(
  previous: AttendanceKind | null,
): AttendanceKind[] {
  return ALLOWED_NEXT[previous ?? "none"];
}
