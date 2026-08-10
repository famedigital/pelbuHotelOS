"use server";

import { writeAuditEvent } from "@/lib/audit";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  getStaffSession,
  provisionStaffAuthUser,
  staffAuthEmail,
  validateStaffPin,
} from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type StaffLoginState = {
  ok: boolean;
  error?: string;
};

export async function staffLogin(
  _previous: StaffLoginState,
  formData: FormData,
): Promise<StaffLoginState> {
  try {
    const h = await headers();
    const rl = await rateLimit(`staff-login:${clientIp(h)}`, {
      limit: 20,
      windowMs: 15 * 60_000,
    });
    if (!rl.ok) {
      return {
        ok: false,
        error: "Too many login attempts. Wait a few minutes.",
      };
    }

    const employeeCode = trimRequired(formData.get("employee_code"), "Employee code")
      .toUpperCase()
      .replace(/\s+/g, "-");
    const pin = validateStaffPin(String(formData.get("pin") ?? ""));
    const { safeStaffNextPath } = await import("@/lib/safe-staff-next");
    const returnNext = safeStaffNextPath(String(formData.get("next") ?? ""));

    const admin = createSupabaseAdminClient();
    const { data: staff, error } = await admin
      .from("staff_members")
      .select(
        "id, property_id, employee_code, full_name, access_level, desk_role, auth_user_id, can_login, can_access_desk, status",
      )
      .eq("employee_code", employeeCode)
      .in("status", ["active", "on_leave"])
      .limit(2);

    if (error) throw new Error("Could not look up staff login.");
    if (!staff?.length) throw new Error("Incorrect employee code or PIN.");
    if (staff.length > 1) {
      throw new Error("Multiple properties share this code. Contact HR.");
    }

    const member = staff[0];
    if (!member.can_login || !member.auth_user_id) {
      throw new Error(
        "Ask HR to enable your staff login PIN first (Team → person → Set PIN).",
      );
    }

    // "desk" when signing in from /erp/login — fail closed with a clear HR path
    // instead of silently opening the staff portal (looks like "login failed").
    const wantsDesk = String(formData.get("workspace") ?? "") === "desk";

    const supabase = await createSupabaseServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: staffAuthEmail(
        member.property_id as string,
        member.employee_code as string,
      ),
      password: pin,
    });
    if (signInError) {
      return { ok: false, error: "Incorrect employee code or PIN." };
    }

    if (wantsDesk && !member.can_access_desk) {
      await supabase.auth.signOut();
      return {
        ok: false,
        error:
          "Your PIN works, but hotel desk is off for this account. Ask HR or a manager to turn on “Allow hotel desk (/erp)” and set a desk role (front desk, cashier, etc.).",
      };
    }

    let mayOpenDesk = Boolean(member.can_access_desk);
    if (mayOpenDesk) {
      const { staffSessionSatisfiesDeskShift } = await import(
        "@/lib/desk-shift-gate"
      );
      const gate = await staffSessionSatisfiesDeskShift(admin, {
        staffId: member.id as string,
        propertyId: member.property_id as string,
        accessLevel: (member.access_level as string) ?? "employee",
        deskRole: (member.desk_role as string | null) ?? null,
      });
      if (!gate.ok) {
        if (wantsDesk) {
          await supabase.auth.signOut();
          return { ok: false, error: gate.message };
        }
        // Staff portal login: keep session but route to /staff, not /erp.
        mayOpenDesk = false;
      }
    }

    await admin
      .from("staff_members")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", member.id);

    await writeAuditEvent(admin, {
      propertyId: member.property_id as string,
      action: "staff.login",
      entityType: "staff_members",
      entityId: member.id as string,
      summary: `${member.full_name as string} signed into staff portal`,
      actor: member.employee_code as string,
      meta: {
        canAccessDesk: Boolean(member.can_access_desk),
        deskOpened: mayOpenDesk,
        workspace: wantsDesk ? "desk" : "staff",
        returnNext: returnNext ?? null,
      },
    });

    const { resolveDeskHomeHref } = await import("@/lib/erp/desk-modules");
    const { normalizeDeskRole } = await import("@/lib/desk-auth");
    const deskRole = normalizeDeskRole((member.desk_role as string | null) ?? null);
    const deskHome = resolveDeskHomeHref({ deskRole, pinOnlySession: false });

    // Prefer return URL (bag QR scan) over default desk/staff home.
    redirect(returnNext ?? (mayOpenDesk ? deskHome : "/staff"));
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not sign in.",
    };
  }
}

export async function staffLogout(): Promise<void> {
  const session = await getStaffSession();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  if (session) {
    const admin = createSupabaseAdminClient();
    await writeAuditEvent(admin, {
      propertyId: session.propertyId,
      action: "staff.logout",
      entityType: "staff_members",
      entityId: session.staffId,
      summary: `${session.fullName} signed out of staff portal`,
      actor: session.employeeCode,
    });
  }
  redirect("/login");
}

export async function setStaffPortalPin(
  _previous: { ok: boolean; error?: string; message?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string; message?: string }> {
  try {
    const { isDeskAuthenticated } = await import("@/lib/desk-auth");
    const { resolveActivePropertyId } = await import("@/lib/property-context");
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const staffId = trimRequired(formData.get("staff_id"), "Staff");
    const pin = validateStaffPin(String(formData.get("pin") ?? ""));
    const confirm = String(formData.get("confirm_pin") ?? "").trim();
    if (pin !== confirm) throw new Error("PIN confirmation does not match.");

    const { data: staff, error } = await admin
      .from("staff_members")
      .select(
        "id, property_id, employee_code, full_name, access_level, auth_user_id, status, can_access_desk, desk_role",
      )
      .eq("id", staffId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (error || !staff) throw new Error("Staff member not found.");
    if (!["active", "on_leave"].includes(staff.status as string)) {
      throw new Error("Only active staff can receive a portal PIN.");
    }

    const authUserId = await provisionStaffAuthUser(
      admin,
      {
        id: staff.id as string,
        property_id: staff.property_id as string,
        employee_code: staff.employee_code as string,
        full_name: staff.full_name as string,
        access_level: staff.access_level as string,
        auth_user_id: (staff.auth_user_id as string | null) ?? null,
      },
      pin,
    );

    // can_access_desk semantics:
    // - "on" → grant desk
    // - field present but not "on" (dossier hidden "off") → explicit revoke/keep off
    // - field absent (unchecked checkbox on bulk form) → preserve existing so a PIN
    //   reset cannot accidentally strip desk that Access already granted
    const deskField = formData.get("can_access_desk");
    let nextCanAccessDesk = Boolean(staff.can_access_desk);
    if (deskField === "on") {
      nextCanAccessDesk = true;
    } else if (deskField !== null) {
      nextCanAccessDesk = false;
    }

    const update: Record<string, unknown> = {
      auth_user_id: authUserId,
      can_login: true,
      can_access_desk: nextCanAccessDesk,
      pin_set_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Desk flag without RBAC role breaks Access UX require-desk-role; default FO.
    if (
      nextCanAccessDesk &&
      !(staff.desk_role as string | null)?.trim()
    ) {
      update.desk_role = "front_desk";
    }

    const { error: updateError } = await admin
      .from("staff_members")
      .update(update)
      .eq("id", staffId)
      .eq("property_id", propertyId);
    if (updateError) throw new Error("Could not enable staff login.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "staff.pin_set",
      entityType: "staff_members",
      entityId: staffId,
      summary: `Enabled staff portal PIN for ${staff.full_name as string}`,
      meta: {
        employeeCode: staff.employee_code,
        canAccessDesk: nextCanAccessDesk,
      },
    });

    revalidatePath("/erp/hr");
    return { ok: true, message: "Staff portal PIN saved." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not set PIN.",
    };
  }
}
