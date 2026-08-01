import { mapAccessLevelToDeskRole, type DeskRole } from "@/lib/desk-auth";

const MANAGER_DESK_ROLES: ReadonlySet<DeskRole> = new Set(["owner", "gm"]);

/** Shared env PIN fallback (POS_MANAGER_PIN, then DESK_PIN). */
export function verifyEnvManagerPin(pin: string): boolean {
  const expected =
    process.env.POS_MANAGER_PIN?.trim() || process.env.DESK_PIN?.trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  return pin.trim() === expected;
}

export function isManagerDeskRole(role: string | null | undefined): boolean {
  return MANAGER_DESK_ROLES.has(role as DeskRole);
}

export function resolveStaffDeskRole(
  deskRole: string | null | undefined,
  accessLevel: string | null | undefined,
): DeskRole {
  return (
    (deskRole as DeskRole | null) ?? mapAccessLevelToDeskRole(accessLevel)
  );
}

export function isManagerStaffMember(
  deskRole: string | null | undefined,
  accessLevel: string | null | undefined,
): boolean {
  return isManagerDeskRole(resolveStaffDeskRole(deskRole, accessLevel));
}
