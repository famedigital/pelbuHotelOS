export const DESK_LOGIN_DEPARTMENTS = [
  { id: "admin", label: "Admin", short: "Admin" },
  { id: "front_desk", label: "Front desk", short: "FO" },
  { id: "fnb", label: "F&B", short: "F&B" },
  { id: "hk", label: "Housekeeping", short: "HK" },
  { id: "kitchen", label: "Kitchen", short: "Kit" },
] as const;

export type DeskLoginDepartment = (typeof DESK_LOGIN_DEPARTMENTS)[number]["id"];
