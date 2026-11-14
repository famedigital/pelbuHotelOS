/** Desk role → home route + Simple rail module ids (Bhutan dept homes). */

import { DEFAULT_DEPT_PINS } from "./default-dept-pins.js";

const SAFE_HOME = /^\/[a-z][a-z0-9/-]*$/i;

/** Known desk_role aliases → canonical module home (never invent paths). */
export function homeRouteForDeskRole(deskRole: string | null | undefined): string {
  const role = String(deskRole ?? "").toLowerCase().replace(/\s+/g, "_");
  if (role === "waiter" || role === "fnb" || role === "cashier" || role === "fnb_captain" || role === "fb_manager")
    return "/pos";
  if (role === "chef" || role === "kitchen" || role === "cook") return "/kds";
  if (
    role === "sales" ||
    role === "reservations" ||
    role === "reservation" ||
    role === "res"
  )
    return "/reservations";
  if (role === "hk" || role === "housekeeping" || role === "hk_attendant" || role === "hk_supervisor")
    return "/housekeeping";
  if (role === "storekeeper" || role === "stores" || role === "procurement")
    return "/purchases";
  if (role === "accountant" || role === "finance" || role === "accounts")
    return "/finance";
  if (role === "owner" || role === "gm") return "/owner";
  /* Property admin — full ops home (all modules on Simple rail). */
  if (role === "admin" || role === "property_admin") return "/desk";
  if (role === "hr" || role === "hr_admin") return "/hr";
  if (role === "night_auditor") return "/night-audit";
  if (
    role === "fo" ||
    role === "front_desk" ||
    role === "fo_agent" ||
    role === "fo_manager" ||
    role === "front_office"
  )
    return "/desk";
  /* Unknown — do not force Desk; caller should use resolveDeskHomeRoute. */
  return "/desk";
}

function homeFromEmployeeCode(employeeCode: string | null | undefined): string | null {
  const code = String(employeeCode ?? "").trim().toUpperCase();
  if (!code) return null;
  const hit = DEFAULT_DEPT_PINS.find((d) => d.employeeCode === code);
  return hit?.homeRoute ?? null;
}

function isSafeHomeRoute(path: string | null | undefined): path is string {
  if (!path || typeof path !== "string") return false;
  return SAFE_HOME.test(path.trim());
}

/**
 * PIN / AuthEntry landing — role first, then DEPT-* code, then DB home_route, else Desk.
 */
export function resolveDeskHomeRoute(input: {
  deskRole?: string | null;
  homeRoute?: string | null;
  employeeCode?: string | null;
}): string {
  const role = String(input.deskRole ?? "").toLowerCase().replace(/\s+/g, "_");
  const known =
    role === "fo" ||
    role === "front_desk" ||
    role === "fo_agent" ||
    role === "fo_manager" ||
    role === "front_office" ||
    role === "waiter" ||
    role === "fnb" ||
    role === "cashier" ||
    role === "fnb_captain" ||
    role === "fb_manager" ||
    role === "chef" ||
    role === "kitchen" ||
    role === "cook" ||
    role === "sales" ||
    role === "reservations" ||
    role === "reservation" ||
    role === "res" ||
    role === "hk" ||
    role === "housekeeping" ||
    role === "hk_attendant" ||
    role === "hk_supervisor" ||
    role === "storekeeper" ||
    role === "stores" ||
    role === "procurement" ||
    role === "accountant" ||
    role === "finance" ||
    role === "accounts" ||
    role === "owner" ||
    role === "gm" ||
    role === "admin" ||
    role === "property_admin" ||
    role === "hr" ||
    role === "hr_admin" ||
    role === "night_auditor";

  if (known) return homeRouteForDeskRole(input.deskRole);

  const fromCode = homeFromEmployeeCode(input.employeeCode);
  if (fromCode) return fromCode;

  if (isSafeHomeRoute(input.homeRoute?.trim() ?? null)) {
    return input.homeRoute!.trim();
  }

  return "/desk";
}

/**
 * Module ids visible on Simple rail (without Show all).
 * Sentinel `"*"` = every sidebar module (Property Admin).
 */
export function simpleRailItems(deskRole: string | null | undefined): readonly string[] {
  const role = String(deskRole ?? "").toLowerCase().replace(/\s+/g, "_");
  if (role === "waiter" || role === "fnb" || role === "cashier") return ["pos"];
  if (role === "chef" || role === "kitchen" || role === "cook") return ["kds"];
  if (role === "hk_attendant") return ["housekeeping"];
  if (role === "hk" || role === "housekeeping" || role === "hk_supervisor")
    return ["housekeeping", "laundry"];
  if (role === "storekeeper" || role === "stores") return ["purchases", "stock"];
  if (role === "sales" || role === "reservations" || role === "reservation")
    return ["reservations", "groups", "rates", "agents"];
  if (role === "accountant" || role === "finance")
    return ["finance", "bank-recon", "reports", "agents", "compliance"];
  if (role === "owner") return ["owner", "finance", "reports", "hr"];
  if (role === "gm") return ["owner", "finance", "reports", "hr", "desk"];
  if (role === "admin" || role === "property_admin") return ["*"];
  if (role === "fo_manager")
    return ["desk", "stayview", "guests", "reservations", "night-audit", "print"];
  if (
    role === "fo" ||
    role === "fo_agent" ||
    role === "front_desk" ||
    role === "front_office"
  )
    return ["desk", "stayview", "guests", "print"];
  if (role === "night_auditor") return ["night-audit", "desk", "finance"];
  if (role === "hr" || role === "hr_admin") return ["hr", "staff-portal"];
  return ["desk", "stayview", "guests"];
}
