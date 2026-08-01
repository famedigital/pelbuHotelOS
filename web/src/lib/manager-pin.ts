import "server-only";

import {
  isManagerStaffMember,
  verifyEnvManagerPin,
} from "@/lib/manager-pin-core";
import { staffAuthEmail, validateStaffPin } from "@/lib/staff-auth";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type ManagerPinResult =
  | { ok: true; source: "env" }
  | { ok: true; source: "staff"; staffId: string; fullName: string }
  | { ok: false; error: string };

function ephemeralAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function staffPinMatches(
  propertyId: string,
  employeeCode: string,
  pin: string,
): Promise<boolean> {
  const client = ephemeralAuthClient();
  if (!client) return false;
  const { error } = await client.auth.signInWithPassword({
    email: staffAuthEmail(propertyId, employeeCode),
    password: pin,
  });
  return !error;
}

/**
 * Accept env manager PIN (legacy) or an owner/GM staff PIN for the property.
 * Does not replace the caller's desk session.
 */
export async function verifyManagerPinForProperty(
  admin: Admin,
  propertyId: string,
  rawPin: string,
): Promise<ManagerPinResult> {
  let pin: string;
  try {
    pin = validateStaffPin(rawPin);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid PIN format.",
    };
  }

  if (verifyEnvManagerPin(pin)) {
    return { ok: true, source: "env" };
  }

  const { data: staffRows, error } = await admin
    .from("staff_members")
    .select(
      "id, employee_code, full_name, access_level, desk_role, can_login, auth_user_id",
    )
    .eq("property_id", propertyId)
    .eq("can_login", true)
    .in("status", ["active", "on_leave"])
    .not("auth_user_id", "is", null);

  if (error) {
    return { ok: false, error: "Could not verify manager PIN." };
  }

  const managers = (staffRows ?? []).filter((row) =>
    isManagerStaffMember(
      row.desk_role as string | null,
      row.access_level as string,
    ),
  );

  if (!managers.length) {
    return {
      ok: false,
      error:
        "No owner or GM staff PIN is configured. Set POS_MANAGER_PIN or enable staff login for a manager.",
    };
  }

  for (const staff of managers) {
    const matches = await staffPinMatches(
      propertyId,
      staff.employee_code as string,
      pin,
    );
    if (matches) {
      return {
        ok: true,
        source: "staff",
        staffId: staff.id as string,
        fullName: staff.full_name as string,
      };
    }
  }

  return { ok: false, error: "Manager PIN is incorrect." };
}

export { verifyEnvManagerPin } from "@/lib/manager-pin-core";
