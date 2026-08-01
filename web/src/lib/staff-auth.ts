import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

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
  const { data } = await admin
    .from("staff_members")
    .select(
      "id, property_id, employee_code, full_name, role_label, access_level, department, status, can_login, can_access_desk, desk_role",
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (
    !data ||
    !data.can_login ||
    !["active", "on_leave"].includes(data.status as string)
  ) {
    return null;
  }

  return {
    staffId: data.id as string,
    propertyId: data.property_id as string,
    authUserId: user.id,
    employeeCode: data.employee_code as string,
    fullName: data.full_name as string,
    roleLabel: data.role_label as string,
    accessLevel: data.access_level as string,
    department: (data.department as string | null) ?? null,
    canAccessDesk: Boolean(data.can_access_desk),
    deskRole: (data.desk_role as string | null) ?? null,
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
