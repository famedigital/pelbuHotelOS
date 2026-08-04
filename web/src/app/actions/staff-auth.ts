"use server";

import { writeAuditEvent } from "@/lib/audit";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  getStaffSession,
  provisionStaffAuthUser,
  staffAuthEmail,
  validateStaffPin,
} from "@/lib/staff-auth";
import {
  clearSupabaseAuthSessionCookies,
  hasSupabaseAuthSessionCookie,
} from "@/lib/supabase-auth-cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export type StaffLoginState = {
  ok: boolean;
  error?: string;
  /** Full-page destination after cookies land (hard nav on client). */
  redirectTo?: string;
};

function staffSignInErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("fetch") || lower.includes("network")) {
    return "Could not reach auth service. Check your connection and try again.";
  }
  return "Incorrect employee code or PIN.";
}

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

    const admin = createSupabaseAdminClient();
    const { data: staff, error } = await admin
      .from("staff_members")
      .select(
        "id, property_id, employee_code, full_name, access_level, auth_user_id, can_login, can_access_desk, status",
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
      throw new Error("Ask HR to enable your staff login PIN first.");
    }

    const cookieStore = await cookies();
    // A prior failed sign-in can leave mismatched auth-token.0/.1 chunks that
    // pass the name-only cookie check but break getUser on the next GET /erp.
    clearSupabaseAuthSessionCookies(cookieStore);

    const supabase = await createSupabaseServerClient(cookieStore);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: staffAuthEmail(
        member.property_id as string,
        member.employee_code as string,
      ),
      password: pin,
    });
    if (signInError) {
      return {
        ok: false,
        error: staffSignInErrorMessage(signInError.message),
      };
    }

    // Confirm session materialised on this request before redirect (cookies
    // are written via createSupabaseServerClient setAll on SIGNED_IN).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        ok: false,
        error: "Signed in but session cookie was not set. Try again.",
      };
    }

    // getUser() can succeed from in-memory client state even when Set-Cookie
    // failed; middleware only sees real request cookies.
    if (!hasSupabaseAuthSessionCookie(cookieStore.getAll())) {
      return {
        ok: false,
        error: "Session cookie could not be saved. Check browser cookies and try again.",
      };
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
      meta: { canAccessDesk: Boolean(member.can_access_desk) },
    });

    // Soft redirect() races RSC prefetches before Set-Cookie commits on Vercel.
    // Return the destination and let the client do window.location.assign so
    // the auth cookie is on the next full document request.
    // Do not revalidatePath here — it can trigger /erp RSC while session is mid-write.
    return {
      ok: true,
      redirectTo: member.can_access_desk ? "/erp" : "/staff",
    };
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
        "id, property_id, employee_code, full_name, access_level, auth_user_id, status",
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

    const { error: updateError } = await admin
      .from("staff_members")
      .update({
        auth_user_id: authUserId,
        can_login: true,
        can_access_desk: formData.get("can_access_desk") === "on",
        pin_set_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
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
        canAccessDesk: formData.get("can_access_desk") === "on",
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
