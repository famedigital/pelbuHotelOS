/**
 * Map apps/api `homeRoute` (desk app paths) to Innora `/v2/*` cockpit routes.
 * See docs/v2/ENTERPRISE-SPEC.md §6 — v2 uses consolidated surfaces under /v2.
 */
export function mapApiHomeRouteToV2(apiPath: string): string {
  const p = (apiPath || "/desk").replace(/\/$/, "") || "/desk";
  if (p === "/desk") return "/v2/desk";
  if (p === "/pos") return "/v2/pos";
  if (p === "/purchases") return "/v2/purchases";
  if (p === "/finance") return "/v2/purchases";
  if (p === "/owner") return "/v2/reports";
  if (p === "/kds") return "/v2/staff/kds";
  if (p === "/housekeeping") return "/v2/staff/housekeeping";
  return "/v2/desk";
}

/**
 * Map `staff_members.desk_role` (when JWT not available) to a v2 home path.
 */
export function mapDeskRoleToV2Home(deskRole: string | null | undefined): string {
  const r = String(deskRole || "").toLowerCase();
  if (r === "fnb" || r === "cashier") return "/v2/pos";
  if (r === "kitchen") return "/v2/staff/kds";
  if (r === "accountant") return "/v2/purchases";
  if (r === "gm" || r === "owner") return "/v2/reports";
  if (r === "hk" || r === "laundry") return "/v2/staff/housekeeping";
  if (r === "front_desk") return "/v2/desk";
  return "/v2/desk";
}
