"use server";

import { writeAuditEvent } from "@/lib/audit";
import {
  LOGIN_HOTEL_CODE_COOKIE,
  LOGIN_HOTEL_CODE_COOKIE_MAX_AGE,
  isValidHotelCodeFormat,
  normalizeHotelCodeInput,
} from "@/lib/hotel-codes";
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
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export type StaffLoginState = {
  ok: boolean;
  error?: string;
};

export type ResolveHotelCodeState = {
  ok: boolean;
  error?: string;
  hotelCode?: string;
  propertyName?: string;
};

async function lookupPropertyByHotelCode(hotelCodeRaw: string) {
  const hotelCode = normalizeHotelCodeInput(hotelCodeRaw);
  if (!isValidHotelCodeFormat(hotelCode)) {
    return { error: "Hotel code must be 6–8 letters or numbers only." as const };
  }

  const admin = createSupabaseAdminClient();
  const { data: byCode, error: codeErr } = await admin
    .from("properties")
    .select("id, slug, name, hotel_code")
    .eq("hotel_code", hotelCode)
    .maybeSingle();
  if (codeErr) throw new Error("Could not look up hotel code.");
  if (byCode) return { property: byCode, hotelCode };

  // Migration fallback: slug still accepted until hotel_code is assigned.
  const slugGuess = hotelCodeRaw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  const { data: bySlug, error: slugErr } = await admin
    .from("properties")
    .select("id, slug, name, hotel_code")
    .ilike("slug", slugGuess)
    .maybeSingle();
  if (slugErr) throw new Error("Could not look up hotel code.");
  if (bySlug) {
    return {
      property: bySlug,
      hotelCode: (bySlug.hotel_code as string | null) ?? hotelCode,
    };
  }
  return { error: "invalid" as const };
}

/** Step 1: validate hotel code and remember it for the credentials step. */
export async function resolveHotelCode(
  _previous: ResolveHotelCodeState,
  formData: FormData,
): Promise<ResolveHotelCodeState> {
  try {
    const h = await headers();
    const rl = await rateLimit(`hotel-code-resolve:${clientIp(h)}`, {
      limit: 30,
      windowMs: 15 * 60_000,
    });
    if (!rl.ok) {
      return {
        ok: false,
        error: "Too many attempts. Wait a few minutes.",
      };
    }

    const raw = trimRequired(formData.get("hotel_code"), "Hotel code");
    const result = await lookupPropertyByHotelCode(raw);
    if ("error" in result && result.error === "invalid") {
      return { ok: false, error: "That hotel code was not found." };
    }
    if ("error" in result) {
      return { ok: false, error: result.error };
    }

    const { property, hotelCode } = result;
    const jar = await cookies();
    jar.set(LOGIN_HOTEL_CODE_COOKIE, hotelCode, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: LOGIN_HOTEL_CODE_COOKIE_MAX_AGE,
    });

    return {
      ok: true,
      hotelCode,
      propertyName: property.name as string,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not check hotel code.",
    };
  }
}

export async function clearLoginHotelCode(): Promise<void> {
  const jar = await cookies();
  jar.delete(LOGIN_HOTEL_CODE_COOKIE);
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

    const jar = await cookies();
    const cookieCode = jar.get(LOGIN_HOTEL_CODE_COOKIE)?.value?.trim() ?? "";
    const formCode = String(formData.get("hotel_code") ?? "").trim();
    const hotelCodeRaw = formCode || cookieCode;
    if (!hotelCodeRaw) {
      return { ok: false, error: "Enter your hotel code first." };
    }

    const looked = await lookupPropertyByHotelCode(hotelCodeRaw);
    if ("error" in looked) {
      return {
        ok: false,
        error:
          looked.error === "invalid"
            ? "Incorrect hotel code, user ID, or password."
            : looked.error,
      };
    }
    const property = looked.property;

    const employeeCode = trimRequired(
      formData.get("user_id") ?? formData.get("employee_code"),
      "User ID",
    )
      .toUpperCase()
      .replace(/\s+/g, "-");
    const passwordRaw = String(
      formData.get("password") ?? formData.get("pin") ?? "",
    );
    const pin = validateStaffPin(passwordRaw);
    const { safeStaffNextPath } = await import("@/lib/safe-staff-next");
    const returnNext = safeStaffNextPath(String(formData.get("next") ?? ""));

    const admin = createSupabaseAdminClient();

    const { data: member, error } = await admin
      .from("staff_members")
      .select(
        "id, property_id, employee_code, full_name, access_level, desk_role, auth_user_id, can_login, can_access_desk, status",
      )
      .eq("property_id", property.id as string)
      .eq("employee_code", employeeCode)
      .in("status", ["active", "on_leave"])
      .maybeSingle();

    if (error) throw new Error("Could not look up staff login.");
    if (!member) {
      return { ok: false, error: "Incorrect hotel code, user ID, or password." };
    }
    if (!member.can_login || !member.auth_user_id) {
      throw new Error(
        "Ask HR to enable your staff login password first (Team → person → Set PIN).",
      );
    }

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
      return { ok: false, error: "Incorrect hotel code, user ID, or password." };
    }

    if (wantsDesk && !member.can_access_desk) {
      await supabase.auth.signOut();
      return {
        ok: false,
        error:
          "Your password works, but hotel desk is off for this account. Ask HR or a manager to turn on “Allow hotel desk (/erp)” and set a desk role (front desk, cashier, etc.).",
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
        hotelCode: looked.hotelCode,
      },
    });

    const { resolveDeskHomeHref } = await import("@/lib/erp/desk-modules");
    const { normalizeDeskRole } = await import("@/lib/desk-auth");
    const {
      DESK_WORKSPACE_COOKIE,
      DESK_WORKSPACE_COOKIE_MAX_AGE,
      defaultWorkspaceForRole,
      isDeskWorkspace,
    } = await import("@/lib/erp/desk-workspace");
    const deskRole = normalizeDeskRole((member.desk_role as string | null) ?? null);
    const deskHome = resolveDeskHomeHref({ deskRole, pinOnlySession: false });

    {
      const { ACTIVE_PROPERTY_COOKIE } = await import("@/lib/property-context");
      jar.set(ACTIVE_PROPERTY_COOKIE, member.property_id as string, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 90,
      });
      jar.delete(LOGIN_HOTEL_CODE_COOKIE);
      if (mayOpenDesk) {
        const stored = jar.get(DESK_WORKSPACE_COOKIE)?.value;
        const workspace = isDeskWorkspace(stored)
          ? stored
          : defaultWorkspaceForRole(deskRole);
        jar.set(DESK_WORKSPACE_COOKIE, workspace, {
          httpOnly: false,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: DESK_WORKSPACE_COOKIE_MAX_AGE,
        });
      }
    }

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
