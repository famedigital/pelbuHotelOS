/** Desk role → home route + Simple rail module ids (Bhutan dept homes). */

export function homeRouteForDeskRole(deskRole: string | null | undefined): string {
  const role = String(deskRole ?? "").toLowerCase().replace(/\s+/g, "_");
  if (role === "waiter" || role === "fnb" || role === "cashier" || role === "fnb_captain")
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
  if (role === "owner" || role === "gm" || role === "admin") return "/owner";
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
  return "/desk";
}

/** Module ids visible on Simple rail (without Show all). */
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
