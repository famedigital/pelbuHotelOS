export type DeskActor = {
  name: string;
  role: string;
  code: string | null;
};

const ROLE_WORD: Record<string, string> = {
  front_desk: "Front desk",
  cashier: "Cashier",
  gm: "Manager",
  hk: "Housekeeping",
  owner: "Owner",
  fnb: "Food and beverage",
  kitchen: "Kitchen",
  laundry: "Laundry",
  accountant: "Accounts",
};

export function deskRoleWord(role: string | null | undefined): string {
  if (!role) return "Staff";
  return ROLE_WORD[role] ?? role.replace(/_/g, " ");
}
