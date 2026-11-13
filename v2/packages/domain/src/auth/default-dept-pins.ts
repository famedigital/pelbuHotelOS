/**
 * Default department desk PINs — applied to every new/live property unless overridden.
 * Anonymous PIN pad matches these keys (no name gallery).
 */
export type DefaultDeptPin = {
  /** Stable employee_code per property */
  employeeCode: string;
  displayName: string;
  deskRole: string;
  homeRoute: string;
  pin: string;
  roleLabel: string;
};

export const DEFAULT_DEPT_PINS: readonly DefaultDeptPin[] = [
  {
    employeeCode: "DEPT-RES",
    displayName: "Reservation",
    deskRole: "reservations",
    homeRoute: "/reservations",
    pin: "9999",
    roleLabel: "Reservation",
  },
  {
    employeeCode: "DEPT-FO",
    displayName: "Front Office",
    deskRole: "fo",
    homeRoute: "/desk",
    pin: "1111",
    roleLabel: "FO",
  },
  {
    employeeCode: "DEPT-FNB",
    displayName: "F&B",
    deskRole: "fnb",
    homeRoute: "/pos",
    pin: "2222",
    roleLabel: "FNB",
  },
  {
    employeeCode: "DEPT-HK",
    displayName: "Housekeeping",
    deskRole: "hk",
    homeRoute: "/housekeeping",
    pin: "3333",
    roleLabel: "HK",
  },
  {
    employeeCode: "DEPT-KIT",
    displayName: "Kitchen",
    deskRole: "kitchen",
    homeRoute: "/kds",
    pin: "4444",
    roleLabel: "Kitchen",
  },
  {
    employeeCode: "DEPT-OWN",
    displayName: "Owner",
    deskRole: "owner",
    homeRoute: "/owner",
    pin: "0000",
    roleLabel: "OWNER",
  },
] as const;

/** Map free-text / legacy desk_role → default department PIN. */
export function defaultPinForDeskRole(
  deskRole: string | null | undefined,
): string | null {
  const role = String(deskRole ?? "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (
    role === "reservations" ||
    role === "reservation" ||
    role === "sales" ||
    role === "res"
  )
    return "9999";
  if (
    role === "fo" ||
    role === "fo_agent" ||
    role === "fo_manager" ||
    role === "front_desk" ||
    role === "front_office"
  )
    return "1111";
  if (
    role === "fnb" ||
    role === "cashier" ||
    role === "waiter" ||
    role === "fnb_captain" ||
    role === "fb_manager"
  )
    return "2222";
  if (
    role === "hk" ||
    role === "housekeeping" ||
    role === "hk_attendant" ||
    role === "hk_supervisor"
  )
    return "3333";
  if (role === "kitchen" || role === "chef" || role === "cook") return "4444";
  if (role === "owner" || role === "gm" || role === "admin") return "0000";
  return null;
}
