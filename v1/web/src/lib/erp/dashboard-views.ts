/**
 * Client-safe dashboard view labels / parsers.
 * Keep free of supabase, server-only, and next/headers so ModuleHeaderTabs
 * and other Client Components can import without pulling the snapshot loader.
 */

export type DashboardView =
  | "owner"
  | "gm"
  | "front_desk"
  | "fnb"
  | "kitchen"
  | "hk"
  | "laundry"
  | "cashier";

export const DASHBOARD_VIEWS: Array<{
  id: DashboardView;
  label: string;
  blurb: string;
}> = [
  { id: "owner", label: "Owner", blurb: "Compliance, revenue posture, night audit" },
  { id: "gm", label: "Manager", blurb: "Cross-department duty manager board" },
  { id: "front_desk", label: "Front desk", blurb: "Arrivals, holds, in-house, folio" },
  { id: "fnb", label: "F&B", blurb: "POS tickets, service, banquet bills" },
  { id: "kitchen", label: "Kitchen", blurb: "Meal pax, KOT, set menus, events" },
  { id: "hk", label: "Housekeeping", blurb: "Room status board" },
  { id: "laundry", label: "Laundry", blurb: "Bags in pipeline" },
  { id: "cashier", label: "Cashier", blurb: "POS shift path + F&B settle" },
];

export function deskRoleToDashboardView(role: string): DashboardView {
  if (role === "owner") return "owner";
  if (role === "gm") return "gm";
  if (role === "front_desk") return "front_desk";
  if (role === "fnb") return "fnb";
  if (role === "kitchen") return "kitchen";
  if (role === "hk") return "hk";
  if (role === "laundry") return "laundry";
  if (role === "cashier") return "cashier";
  return "front_desk";
}

export function canPreviewDashboards(role: string | null): boolean {
  return role === "owner" || role === "gm";
}

export function parseDashboardView(
  raw: string | null | undefined,
): DashboardView | null {
  if (!raw) return null;
  const id = raw.toLowerCase() as DashboardView;
  return DASHBOARD_VIEWS.some((v) => v.id === id) ? id : null;
}
