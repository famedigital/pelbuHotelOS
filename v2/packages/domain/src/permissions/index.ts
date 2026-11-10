/** Permission keys: `module.action` — checked by every command. */

export type PermissionKey = `${string}.${string}`;

export function permission(module: string, action: string): PermissionKey {
  return `${module}.${action}` as PermissionKey;
}

/** Minimal matrix seed — expand per MODULES roles in Wave A HR. */
export const ROLE_PERMISSIONS: Record<string, readonly PermissionKey[]> = {
  owner: ["*.*"],
  gm: ["*.*"],
  fo_manager: [
    "desk.*",
    "reservations.*",
    "stayview.*",
    "groups.*",
    "guests.*",
    "night_audit.*",
    "agents.*",
    "rates.*",
    "settings.*",
    "hr.*",
    "housekeeping.*",
    "pos.*",
    "finance.view",
    "finance.write",
    "purchases.*",
  ],
  fo_agent: ["desk.*", "reservations.*", "stayview.*", "guests.*", "rates.view"],
  accountant: [
    "finance.*",
    "compliance.*",
    "purchases.*",
    "agents.ar",
    "reports.view",
    "hr.view",
  ],
  waiter: ["pos.*", "kds.view"],
  chef: ["kds.*"],
  hk_supervisor: ["housekeeping.*", "laundry.*"],
  hk_attendant: ["housekeeping.write"],
  sales: ["agents.*", "rates.view", "groups.*"],
  marketing: ["cms.*", "marketing.*"],
  platform_admin: ["*.*", "superadmin.*"],
};

export function roleAllows(
  role: string,
  key: PermissionKey,
  matrix: Record<string, readonly PermissionKey[]> = ROLE_PERMISSIONS,
): boolean {
  const keys = matrix[role] ?? [];
  if (keys.includes("*.*")) return true;
  if (keys.includes(key)) return true;
  const [mod] = key.split(".");
  return keys.includes(`${mod}.*` as PermissionKey);
}
