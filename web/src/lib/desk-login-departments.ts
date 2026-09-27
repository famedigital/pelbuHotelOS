export const DESK_LOGIN_DEPARTMENTS = [
  { id: "front_desk", label: "Front desk" },
  { id: "fnb", label: "F&B" },
  { id: "hk", label: "Housekeeping" },
  { id: "kitchen", label: "Kitchen" },
] as const;

export type DeskLoginDepartment = (typeof DESK_LOGIN_DEPARTMENTS)[number]["id"];
