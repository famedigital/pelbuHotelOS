import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/** Shared shape for staff_members lookups; desk_module_keys optional for pre-migration fallback. */
type StaffMemberRow = {
  id: string;
  property_id: string;
  employee_code: string;
  full_name: string;
  role_label: string;
  access_level: string;
  department: string | null;
  status: string;
  can_login: boolean;
  can_access_desk: boolean | null;
  desk_role: string | null;
  desk_module_keys?: string[] | null;
};

export type StaffSession = {
  staffId: string;
  propertyId: string;
  authUserId: string;
  employeeCode: string;
  fullName: string;
  roleLabel: string;
  accessLevel: string;
  department: string | null;
  /** When true, this staff session may open /erp (dual-auth with DESK_PIN). */
  canAccessDesk: boolean;
  /** RBAC desk role for ERP money / FO gates. */
  deskRole: string | null;
  /**
   * Explicit ERP module allowlist. Null means inherit desk_role defaults.
   * @see resolveDeskModules
   */
  deskModuleKeys: string[] | null;
};

/** Deterministic Auth email for staff-code/PIN identities (never shown to staff). */
export function staffAuthEmail(propertyId: string, employeeCode: string): string {
  const propertyKey = propertyId.replace(/-/g, "").slice(0, 12).toLowerCase();
  const code = employeeCode.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `${code}.${propertyKey}@staff.pelbusuites.internal`;
}

export function validateStaffPin(pin: string): string {
  const normalized = pin.trim();
  if (!/^\d{4,8}$/.test(normalized)) {
    throw new Error("PIN must be 4 to 8 digits.");
  }
  return normalized;
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("staff_members")
    .select(
      "id, property_id, employee_code, full_name, role_label, access_level, department, status, can_login, can_access_desk, desk_role, desk_module_keys",
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Migration 20260816100000 may not be applied yet — fall back without the column
  // so staff login still resolves can_access_desk for /erp.
  let row: StaffMemberRow | null = data as StaffMemberRow | null;
  if (error?.message?.includes("desk_module_keys")) {
    const fallback = await admin
      .from("staff_members")
      .select(
        "id, property_id, employee_code, full_name, role_label, access_level, department, status, can_login, can_access_desk, desk_role",
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();
    row = fallback.data
      ? { ...(fallback.data as Omit<StaffMemberRow, "desk_module_keys">), desk_module_keys: null }
      : null;
  } else if (error) {
    return null;
  }

  if (
    !row ||
    !row.can_login ||
    !["active", "on_leave"].includes(row.status)
  ) {
    return null;
  }

  const rawKeys = row.desk_module_keys;
  const deskModuleKeys =
    Array.isArray(rawKeys) && rawKeys.length > 0
      ? rawKeys.map(String)
      : null;

  return {
    staffId: row.id,
    propertyId: row.property_id,
    authUserId: user.id,
    employeeCode: row.employee_code,
    fullName: row.full_name,
    roleLabel: row.role_label,
    accessLevel: row.access_level,
    department: row.department ?? null,
    canAccessDesk: Boolean(row.can_access_desk),
    deskRole: row.desk_role ?? null,
    deskModuleKeys,
  };
}

export async function requireStaffSession(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) {
    throw new Error("Staff session expired. Sign in again.");
  }
  return session;
}

export async function provisionStaffAuthUser(
  admin: Admin,
  staff: {
    id: string;
    property_id: string;
    employee_code: string;
    full_name: string;
    access_level: string;
    auth_user_id: string | null;
  },
  pin: string,
): Promise<string> {
  const password = validateStaffPin(pin);
  const email = staffAuthEmail(staff.property_id, staff.employee_code);
  const appMetadata = {
    kind: "staff",
    staff_id: staff.id,
    property_id: staff.property_id,
    access_level: staff.access_level,
  };

  if (staff.auth_user_id) {
    const { error } = await admin.auth.admin.updateUserById(staff.auth_user_id, {
      password,
      app_metadata: appMetadata,
      ban_duration: "none",
    });
    if (error) throw new Error("Could not update staff PIN.");
    return staff.auth_user_id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: staff.full_name,
    },
    app_metadata: appMetadata,
  });
  if (error || !data.user) {
    throw new Error(error?.message || "Could not create staff login.");
  }
  return data.user.id;
}
