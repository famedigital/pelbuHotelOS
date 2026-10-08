import type { DeskRole } from "@/lib/desk-auth";
import { allDeskModuleKeys } from "@/lib/erp/desk-modules";

/**
 * Hotel positions by department. Saving a catalog title sets desk role and
 * module access. FO, HK, and F&B supervisors stay on that role’s screens.
 * General manager and owner titles open the full desk.
 */
export type PositionModules = "full" | "defaults" | "none";

export type StaffPosition = {
  department: string;
  title: string;
  deskRole: DeskRole | null;
  accessLevel: "employee" | "supervisor" | "hr_admin" | "owner";
  modules: PositionModules;
};

export type PositionDeskAssignment = {
  canAccessDesk: boolean;
  deskRole: string | null;
  accessLevel: string;
  /** null = role defaults. A module-key list = those modules, every screen. */
  deskModuleKeys: string[] | null;
};

const POSITIONS: readonly StaffPosition[] = [
  // Front office
  pos("Front office", "Front office manager", "gm", "supervisor", "full"),
  pos("Front office", "Supervisor", "front_desk", "supervisor", "defaults"),
  pos("Front office", "Duty manager", "gm", "supervisor", "full"),
  pos("Front office", "Receptionist", "front_desk", "employee", "defaults"),
  pos("Front office", "Reservation officer", "front_desk", "employee", "defaults"),
  pos("Front office", "Night auditor", "front_desk", "employee", "defaults"),
  pos("Front office", "Cashier", "cashier", "employee", "defaults"),
  pos("Front office", "Guest relations", "front_desk", "employee", "defaults"),
  pos("Front office", "Bell captain", "front_desk", "employee", "defaults"),
  pos("Front office", "Concierge", "front_desk", "employee", "defaults"),

  // Rooms
  pos("Rooms", "Rooms controller", "front_desk", "supervisor", "full"),
  pos("Rooms", "Supervisor", "hk", "supervisor", "full"),
  pos("Rooms", "Room attendant", "hk", "employee", "defaults"),

  // Housekeeping
  pos("Housekeeping", "Executive housekeeper", "hk", "supervisor", "full"),
  pos("Housekeeping", "Supervisor", "hk", "supervisor", "defaults"),
  pos("Housekeeping", "Floor supervisor", "hk", "supervisor", "defaults"),
  pos("Housekeeping", "Room attendant", "hk", "employee", "defaults"),
  pos("Housekeeping", "Public area attendant", "hk", "employee", "defaults"),
  pos("Housekeeping", "Houseman", "hk", "employee", "defaults"),
  pos("Housekeeping", "Laundry supervisor", "laundry", "supervisor", "full"),
  pos("Housekeeping", "Laundry attendant", "laundry", "employee", "defaults"),

  // F&B — supervisor uses the outlet screens, not the whole hotel
  pos("F&B", "F&B manager", "fnb", "supervisor", "full"),
  pos("F&B", "Supervisor", "fnb", "supervisor", "defaults"),
  pos("F&B", "Banquet supervisor", "fnb", "supervisor", "defaults"),
  pos("F&B", "Captain", "fnb", "employee", "defaults"),
  pos("F&B", "Waiter", "fnb", "employee", "defaults"),
  pos("F&B", "Bartender", "fnb", "employee", "defaults"),
  pos("F&B", "Host", "fnb", "employee", "defaults"),
  pos("F&B", "Outlet cashier", "cashier", "employee", "defaults"),

  // Kitchen
  pos("Kitchen", "Executive chef", "kitchen", "supervisor", "full"),
  pos("Kitchen", "Supervisor", "kitchen", "supervisor", "full"),
  pos("Kitchen", "Sous chef", "kitchen", "employee", "defaults"),
  pos("Kitchen", "Chef de partie", "kitchen", "employee", "defaults"),
  pos("Kitchen", "Cook", "kitchen", "employee", "defaults"),
  pos("Kitchen", "Steward", "kitchen", "employee", "defaults"),

  // Spa
  pos("Spa", "Spa manager", "front_desk", "supervisor", "full"),
  pos("Spa", "Supervisor", "front_desk", "supervisor", "full"),
  pos("Spa", "Therapist", null, "employee", "none"),
  pos("Spa", "Spa receptionist", "front_desk", "employee", "defaults"),

  // Security
  pos("Security", "Security supervisor", "front_desk", "supervisor", "full"),
  pos("Security", "Security officer", null, "employee", "none"),

  // Maintenance
  pos("Maintenance", "Chief engineer", "hk", "supervisor", "full"),
  pos("Maintenance", "Supervisor", "hk", "supervisor", "full"),
  pos("Maintenance", "Technician", "hk", "employee", "defaults"),

  // Accounts
  pos("Accounts", "Finance manager", "gm", "supervisor", "full"),
  pos("Accounts", "Supervisor", "gm", "supervisor", "full"),
  pos("Accounts", "Accountant", "accountant", "employee", "defaults"),
  pos("Accounts", "Accounts assistant", "cashier", "employee", "defaults"),

  // Management
  pos("Management", "General manager", "gm", "supervisor", "full"),
  pos("Management", "Owner", "owner", "owner", "full"),
  pos("Management", "Assistant manager", "gm", "supervisor", "full"),

  // Other
  pos("Other", "Staff", null, "employee", "none"),
];

function pos(
  department: string,
  title: string,
  deskRole: DeskRole | null,
  accessLevel: StaffPosition["accessLevel"],
  modules: PositionModules,
): StaffPosition {
  return { department, title, deskRole, accessLevel, modules };
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function positionsForDepartment(
  department: string | null | undefined,
): StaffPosition[] {
  const dept = (department ?? "").trim();
  if (!dept) return [];
  return POSITIONS.filter((p) => sameText(p.department, dept));
}

export function findStaffPosition(
  department: string | null | undefined,
  title: string | null | undefined,
): StaffPosition | null {
  const name = (title ?? "").trim();
  if (!name) return null;
  return (
    positionsForDepartment(department).find((p) => sameText(p.title, name)) ??
    null
  );
}

export function positionAccessLabel(position: StaffPosition): string {
  if (position.modules === "full") return "Full desk — every module";
  if (position.modules === "none" || !position.deskRole) return "No hotel desk";
  return "Desk follows this role’s default screens";
}

export function positionDeskAssignment(
  position: StaffPosition,
): PositionDeskAssignment {
  if (position.modules === "none" || !position.deskRole) {
    return {
      canAccessDesk: false,
      deskRole: null,
      accessLevel: position.accessLevel,
      deskModuleKeys: null,
    };
  }
  if (position.modules === "full") {
    return {
      canAccessDesk: true,
      deskRole: position.deskRole,
      accessLevel: position.accessLevel,
      deskModuleKeys: allDeskModuleKeys(),
    };
  }
  return {
    canAccessDesk: true,
    deskRole: position.deskRole,
    accessLevel: position.accessLevel,
    deskModuleKeys: null,
  };
}
