/**
 * Manager PIN core — COPY from web/src/lib/manager-pin-core.ts
 * Framework-free: env verifier injected by host (API).
 */

export type DeskRole =
  | "owner"
  | "gm"
  | "fo_manager"
  | "fo_agent"
  | "night_auditor"
  | "cashier"
  | "hk_supervisor"
  | "hk_attendant"
  | "fb_manager"
  | "waiter"
  | "chef"
  | "storekeeper"
  | "accountant"
  | "hr"
  | "agent"
  | "platform_admin";

const MANAGER_ROLES: ReadonlySet<DeskRole> = new Set([
  "owner",
  "gm",
  "fo_manager",
  "platform_admin",
]);

export function isManagerDeskRole(role: string | null | undefined): boolean {
  return MANAGER_ROLES.has(role as DeskRole);
}

export type PinVerifier = (pin: string) => boolean | Promise<boolean>;

/** Sensitive actions that always require manager PIN (MODULES §6). */
export const PIN_REQUIRED_ACTIONS = [
  "void",
  "discount_above_threshold",
  "rate_below_floor",
  "folio_reopen",
  "fiscal_reissue",
  "checkout_leave_balance",
] as const;

export type PinRequiredAction = (typeof PIN_REQUIRED_ACTIONS)[number];

export async function assertManagerPin(
  pin: string | undefined,
  verify: PinVerifier,
  action: PinRequiredAction,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!pin || !pin.trim()) {
    return { ok: false, error: `Manager PIN required for ${action}` };
  }
  const ok = await verify(pin.trim());
  if (!ok) return { ok: false, error: "Invalid manager PIN" };
  return { ok: true };
}

export function verifyEnvManagerPin(
  pin: string,
  env: { POS_MANAGER_PIN?: string; DESK_PIN?: string; NODE_ENV?: string },
): boolean {
  const expected = env.POS_MANAGER_PIN?.trim() || env.DESK_PIN?.trim();
  if (!expected) return env.NODE_ENV !== "production";
  return pin.trim() === expected;
}
