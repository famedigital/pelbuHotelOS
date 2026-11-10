/**
 * Manager / desk PIN authority — HR staff store + PinGateway presets.
 * Dirty CI / assign overrides accept any active staff PIN (desk already unlocked).
 */
import { useEnterpriseOpsStore } from "./enterprise-ops-store";

const MANAGER_ROLE_RE = /(manager|gm|owner|admin)/i;

/** PinGateway unlock presets — keep in sync with `PinGateway.tsx` STAFF pins. */
const GATEWAY_PINS: ReadonlyArray<{ pin: string; staffId: string; name: string }> = [
  { pin: "1234", staffId: "st-1", name: "Karma Dorji" },
  { pin: "2345", staffId: "gateway-deki", name: "Deki Yangzom" },
  { pin: "3456", staffId: "gateway-tshering", name: "Tshering Tobgay" },
  { pin: "4567", staffId: "gateway-ugyen", name: "Ugyen Penjor" },
  { pin: "9999", staffId: "gateway-tenzin", name: "Tenzin Norbu" },
];

export function verifyDeskManagerPin(
  pin: string,
): { ok: true; staffId: string; name: string } | { ok: false; error: string } {
  const trimmed = pin.trim();
  if (!/^\d{4,8}$/.test(trimmed)) {
    return { ok: false, error: "Enter a 4–8 digit manager PIN" };
  }
  const staff = useEnterpriseOpsStore.getState().hrStaff.filter((s) => s.active);
  /* Prefer managers, but any unlocked desk staff PIN is valid for dirty override. */
  const managers = staff.filter((s) => MANAGER_ROLE_RE.test(s.role));
  const pool = managers.length > 0 ? [...managers, ...staff] : staff;
  const hit = pool.find((s) => s.pin === trimmed);
  if (hit) {
    return { ok: true, staffId: hit.id, name: hit.name };
  }
  const gateway = GATEWAY_PINS.find((g) => g.pin === trimmed);
  if (gateway) {
    return { ok: true, staffId: gateway.staffId, name: gateway.name };
  }
  return { ok: false, error: "Invalid PIN — use your desk unlock PIN (e.g. Karma 1234)" };
}

/** Expected PIN for domain assertVoidPin — first active FO manager, else first staff. */
export function deskManagerExpectedPin(): string {
  const staff = useEnterpriseOpsStore.getState().hrStaff.filter((s) => s.active);
  const mgr = staff.find((s) => MANAGER_ROLE_RE.test(s.role));
  return (mgr ?? staff[0])?.pin ?? GATEWAY_PINS[0]?.pin ?? "";
}
