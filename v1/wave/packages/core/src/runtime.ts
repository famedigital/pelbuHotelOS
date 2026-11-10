import type { Admin } from "./admin.ts";

export type ManagerPinResult =
  | { ok: true; source: "env" }
  | { ok: true; source: "staff"; staffId: string; fullName: string }
  | { ok: false; error: string };

/**
 * Verifies an owner/GM (or env) manager PIN for a property. Supplied by the
 * host app because PIN checks need its auth client + env (Innora: staff PIN via
 * Supabase auth; v2 API: same staff PIN flow through `@hotel-os/db`).
 */
export type ManagerPinVerifier = (
  admin: Admin,
  propertyId: string,
  pin: string,
) => Promise<ManagerPinResult>;

export type CoreRuntime = {
  verifyManagerPin: ManagerPinVerifier | null;
};

const runtime: CoreRuntime = {
  verifyManagerPin: null,
};

/**
 * Register host-provided services once at process start. Re-registering
 * replaces the previous implementation (hot reload safe).
 */
export function configureCore(services: Partial<CoreRuntime>): void {
  if (services.verifyManagerPin !== undefined) {
    runtime.verifyManagerPin = services.verifyManagerPin;
  }
}

export function coreRuntime(): Readonly<CoreRuntime> {
  return runtime;
}
