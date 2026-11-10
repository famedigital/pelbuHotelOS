/** Permission keys: `module.action` — checked by every command. */

export type PermissionKey = `${string}.${string}`;

export function permission(module: string, action: string): PermissionKey {
  return `${module}.${action}` as PermissionKey;
}

/**
 * Map live desk_role / Hermes / JWT aliases onto ROLE_PERMISSIONS keys.
 * Staff rows often store `fo` or `front_desk`; without this, assertPermission
 * sees an unknown role → empty grants → Forbidden on every money command.
 */
export function normalizeActorRole(raw: string | null | undefined): string {
  const role = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!role) return "fo_agent";

  const aliases: Record<string, string> = {
    fo: "fo_agent",
    front_desk: "fo_agent",
    frontdesk: "fo_agent",
    fd: "fo_agent",
    receptionist: "fo_agent",
    staff: "fo_agent",
    hotel_desk: "fo_agent",
    fo_agent: "fo_agent",
    fo_manager: "fo_manager",
    manager: "fo_manager",
    fom: "fo_manager",
    night_auditor: "fo_manager",
    night_audit: "fo_manager",
    owner: "owner",
    gm: "gm",
    general_manager: "gm",
    accountant: "accountant",
    accounts: "accountant",
    cashier: "accountant",
    waiter: "waiter",
    fnb: "waiter",
    chef: "chef",
    kitchen: "chef",
    hk: "hk_attendant",
    housekeeping: "hk_attendant",
    hk_attendant: "hk_attendant",
    hk_supervisor: "hk_supervisor",
    hk_lead: "hk_supervisor",
    sales: "sales",
    marketing: "marketing",
    platform_admin: "platform_admin",
    superadmin: "platform_admin",
    admin: "owner",
  };

  return aliases[role] ?? role;
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
  /* Front-desk agents post package charges + void/rebuild on rate/meal edits. */
  fo_agent: [
    "desk.*",
    "reservations.*",
    "stayview.*",
    "guests.*",
    "groups.*",
    "rates.view",
    "rates.write",
    "housekeeping.*",
    "finance.view",
    "finance.write",
  ],
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
  const canonical = normalizeActorRole(role);
  const keys = matrix[canonical] ?? matrix[role] ?? [];
  if (keys.includes("*.*")) return true;
  if (keys.includes(key)) return true;
  const [mod] = key.split(".");
  return keys.includes(`${mod}.*` as PermissionKey);
}
