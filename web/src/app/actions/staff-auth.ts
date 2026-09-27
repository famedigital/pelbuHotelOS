"use server";

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  DESK_LOGIN_DEPARTMENTS,
  type DeskLoginDepartment,
} from "@/lib/desk-login-departments";
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

export type DeskGateState = {
  ok: boolean;
  error?: string;
  step?: "pin";
  hotelCode?: string;
  propertyName?: string;
};

export type DeskStaffChoice = {
  id: string;
  name: string;
  code: string;
};

const DESK_GATE_COOKIE = "hotelos_desk_password_ok";
const DESK_GATE_MS = 10 * 60 * 1000;

function deskGateSecret(): string {
  return (
    process.env.DESK_PIN?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "hotel-os-desk-gate"
  );
}

function signDeskGate(propertyId: string, exp: number): string {
  const body = `${propertyId}.${exp}`;
  const sig = createHmac("sha256", deskGateSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

function readDeskGate(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [propertyId, expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (!propertyId || !Number.isFinite(exp) || exp < Date.now()) return null;
  const expected = createHmac("sha256", deskGateSecret())
    .update(`${propertyId}.${expRaw}`)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return propertyId;
}

function staffMatchesDepartment(
  row: {
    desk_role: string | null;
    department: string | null;
    role_label: string | null;
  },
  department: DeskLoginDepartment,
): boolean {
  const role = (row.desk_role ?? "").toLowerCase();
  const dept = (row.department ?? "").toLowerCase();
  const label = (row.role_label ?? "").toLowerCase();
  if (department === "front_desk") {
    return role === "front_desk" || dept.includes("front") || label === "front_desk";
  }
  if (department === "fnb") {
    return (
      role === "fnb" ||
      role === "cashier" ||
      dept.includes("fnb") ||
      dept.includes("f&b") ||
      dept.includes("food") ||
      label === "fnb"
    );
  }
  if (department === "hk") {
    return (
      role === "hk" ||
      dept.includes("house") ||
      label === "housekeeping" ||
      label === "hk"
    );
  }
  return (
    role === "kitchen" ||
    dept.includes("kitchen") ||
    label === "kitchen"
  );
}

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
    const hotelCode = normalizeHotelCodeInput(raw);
    if (!isValidHotelCodeFormat(hotelCode)) {
      return { ok: false, error: "Hotel code must be 6–8 letters or numbers only." };
    }

    const jar = await cookies();
    jar.set(LOGIN_HOTEL_CODE_COOKIE, hotelCode, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: LOGIN_HOTEL_CODE_COOKIE_MAX_AGE,
    });

    return { ok: true, hotelCode };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not check hotel code.",
    };
  }
}

export async function deskPasswordGateOpen(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(readDeskGate(jar.get(DESK_GATE_COOKIE)?.value));
}

export async function clearLoginHotelCode(): Promise<void> {
  const jar = await cookies();
  jar.delete(LOGIN_HOTEL_CODE_COOKIE);
  jar.delete(DESK_GATE_COOKIE);
}

/**
 * Desk step 1: hotel code + hotel password (owner / GM login password).
 * Does not open the desk. Step 2 asks for the department PIN.
 */
export async function signDeskHotelPassword(
  _previous: DeskGateState,
  formData: FormData,
): Promise<DeskGateState> {
  try {
    const h = await headers();
    const rl = await rateLimit(`desk-hotel-password:${clientIp(h)}`, {
      limit: 20,
      windowMs: 15 * 60_000,
    });
    if (!rl.ok) {
      return { ok: false, error: "Too many attempts. Wait a few minutes." };
    }

    const looked = await lookupPropertyByHotelCode(
      trimRequired(formData.get("hotel_code"), "Hotel code"),
    );
    if ("error" in looked) {
      return {
        ok: false,
        error:
          looked.error === "invalid"
            ? "Incorrect hotel code or password."
            : looked.error,
      };
    }

    const password = validateStaffPin(String(formData.get("password") ?? ""));
    const admin = createSupabaseAdminClient();
    const { data: keys, error } = await admin
      .from("staff_members")
      .select(
        "id, employee_code, property_id, desk_role, access_level, can_login, auth_user_id",
      )
      .eq("property_id", looked.property.id as string)
      .eq("can_login", true)
      .not("auth_user_id", "is", null)
      .in("status", ["active", "on_leave"])
      .limit(12);
    if (error) throw new Error("Could not check the hotel password.");

    const owners = (keys ?? []).filter((row) => {
      const role = String(row.desk_role ?? "");
      const level = String(row.access_level ?? "");
      const code = String(row.employee_code ?? "").toUpperCase();
      return role === "owner" || role === "gm" || level === "owner" || code === "OWNER";
    });
    if (owners.length === 0) {
      return { ok: false, error: "Incorrect hotel code or password." };
    }

    const supabase = await createSupabaseServerClient();
    let matched = false;
    for (const row of owners) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: staffAuthEmail(
          row.property_id as string,
          row.employee_code as string,
        ),
        password,
      });
      if (!signInError) {
        matched = true;
        break;
      }
    }
    await supabase.auth.signOut();
    if (!matched) {
      return { ok: false, error: "Incorrect hotel code or password." };
    }

    const exp = Date.now() + DESK_GATE_MS;
    const jar = await cookies();
    jar.set(DESK_GATE_COOKIE, signDeskGate(looked.property.id as string, exp), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(DESK_GATE_MS / 1000),
    });
    jar.set(LOGIN_HOTEL_CODE_COOKIE, looked.hotelCode, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: LOGIN_HOTEL_CODE_COOKIE_MAX_AGE,
    });

    return {
      ok: true,
      step: "pin",
      hotelCode: looked.hotelCode,
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
      error: error instanceof Error ? error.message : "Could not check the hotel.",
    };
  }
}

/** Names in a department after the hotel password. PINs stay on each person. */
export async function listDeskDepartmentStaff(
  department: string,
): Promise<{ ok: true; staff: DeskStaffChoice[] } | { ok: false; error: string }> {
  const jar = await cookies();
  const propertyId = readDeskGate(jar.get(DESK_GATE_COOKIE)?.value);
  if (!propertyId) {
    return { ok: false, error: "Enter the hotel code and password again." };
  }
  if (!DESK_LOGIN_DEPARTMENTS.some((row) => row.id === department)) {
    return { ok: false, error: "Choose a department." };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("staff_members")
    .select("id, full_name, employee_code, desk_role, department, role_label")
    .eq("property_id", propertyId)
    .eq("can_login", true)
    .eq("can_access_desk", true)
    .not("auth_user_id", "is", null)
    .in("status", ["active", "on_leave"])
    .order("full_name")
    .limit(40);
  if (error) return { ok: false, error: "Could not load staff for that department." };

  const staff = (data ?? [])
    .filter((row) =>
      staffMatchesDepartment(
        {
          desk_role: (row.desk_role as string | null) ?? null,
          department: (row.department as string | null) ?? null,
          role_label: (row.role_label as string | null) ?? null,
        },
        department as DeskLoginDepartment,
      ),
    )
    .map((row) => ({
      id: row.id as string,
      name: (row.full_name as string) || (row.employee_code as string),
      code: row.employee_code as string,
    }));
  return { ok: true, staff };
}

/** Desk step 2: the chosen person’s own PIN. */
export async function signDeskDepartmentPin(
  _previous: DeskGateState,
  formData: FormData,
): Promise<DeskGateState> {
  try {
    const h = await headers();
    const rl = await rateLimit(`desk-dept-pin:${clientIp(h)}`, {
      limit: 20,
      windowMs: 15 * 60_000,
    });
    if (!rl.ok) {
      return { ok: false, error: "Too many attempts. Wait a few minutes." };
    }

    const jar = await cookies();
    const propertyId = readDeskGate(jar.get(DESK_GATE_COOKIE)?.value);
    if (!propertyId) {
      return {
        ok: false,
        error: "Enter the hotel code and password again.",
      };
    }

    const department = String(formData.get("department") ?? "") as DeskLoginDepartment;
    if (!DESK_LOGIN_DEPARTMENTS.some((row) => row.id === department)) {
      return { ok: false, error: "Choose a department.", step: "pin" };
    }
    const staffId = String(formData.get("staff_id") ?? "").trim();
    if (!staffId) {
      return { ok: false, step: "pin", error: "Choose your name." };
    }
    const pin = validateStaffPin(String(formData.get("desk_pin") ?? ""));

    const admin = createSupabaseAdminClient();
    const { data: member, error } = await admin
      .from("staff_members")
      .select(
        "id, property_id, employee_code, full_name, access_level, desk_role, department, role_label, auth_user_id, can_login, can_access_desk, status",
      )
      .eq("id", staffId)
      .eq("property_id", propertyId)
      .eq("can_login", true)
      .eq("can_access_desk", true)
      .not("auth_user_id", "is", null)
      .in("status", ["active", "on_leave"])
      .maybeSingle();
    if (error) throw new Error("Could not look up that person.");
    if (
      !member ||
      !staffMatchesDepartment(
        {
          desk_role: (member.desk_role as string | null) ?? null,
          department: (member.department as string | null) ?? null,
          role_label: (member.role_label as string | null) ?? null,
        },
        department,
      )
    ) {
      return {
        ok: false,
        step: "pin",
        error: "That person is not set up for this department.",
      };
    }

    const supabase = await createSupabaseServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: staffAuthEmail(
        member.property_id as string,
        member.employee_code as string,
      ),
      password: pin,
    });
    if (signInError) {
      await supabase.auth.signOut();
      return { ok: false, step: "pin", error: "Incorrect PIN for that person." };
    }

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
      await supabase.auth.signOut();
      return { ok: false, step: "pin", error: gate.message };
    }

    await admin
      .from("staff_members")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", member.id);

    const { safePosRegisterNextPath } = await import("@/lib/safe-staff-next");
    const returnNext = safePosRegisterNextPath(String(formData.get("next") ?? ""));

    await writeAuditEvent(admin, {
      propertyId: member.property_id as string,
      action: "staff.login",
      entityType: "staff_members",
      entityId: member.id as string,
      summary: `${member.full_name as string} opened the ${department} desk`,
      actor: member.employee_code as string,
      meta: { workspace: "desk", department, returnNext: returnNext ?? null },
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
    const { ACTIVE_PROPERTY_COOKIE } = await import("@/lib/property-context");

    jar.set(ACTIVE_PROPERTY_COOKIE, member.property_id as string, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
    jar.delete(DESK_GATE_COOKIE);
    if (returnNext !== "/erp/pos") jar.delete(LOGIN_HOTEL_CODE_COOKIE);
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

    redirect(returnNext ?? deskHome);
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
      step: "pin",
      error: error instanceof Error ? error.message : "Could not open the desk.",
    };
  }
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
    const { safePosRegisterNextPath, safeStaffNextPath } = await import(
      "@/lib/safe-staff-next"
    );
    const requestedNext = String(formData.get("next") ?? "");
    const wantsDesk = String(formData.get("workspace") ?? "") === "desk";
    const returnNext =
      safeStaffNextPath(requestedNext) ??
      (wantsDesk ? safePosRegisterNextPath(requestedNext) : null);

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
      if (returnNext !== "/erp/pos") {
        jar.delete(LOGIN_HOTEL_CODE_COOKIE);
      }
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

export async function posRegisterLogout(): Promise<void> {
  await endStaffSession();
  await forgetDeskHotelGate();
  redirect("/erp/pos/login");
}

/** Drop the hotel-password gate so the next person must enter it again. */
export async function forgetDeskHotelGate(): Promise<void> {
  const jar = await cookies();
  jar.delete(DESK_GATE_COOKIE);
  jar.delete(LOGIN_HOTEL_CODE_COOKIE);
}

/**
 * Shift change: this person leaves, the hotel stays open for a few minutes,
 * and the next person picks their name and PIN.
 */
export async function deskShiftChange(formData?: FormData): Promise<void> {
  const next =
    formData instanceof FormData ? String(formData.get("next") ?? "") : "";
  const session = await getStaffSession();
  const propertyId = session?.propertyId ?? null;

  const { DESK_COOKIE_NAME } = await import("@/lib/desk-auth");
  const jar = await cookies();
  jar.delete(DESK_COOKIE_NAME);
  await endStaffSession();

  if (propertyId) {
    const exp = Date.now() + DESK_GATE_MS;
    jar.set(DESK_GATE_COOKIE, signDeskGate(propertyId, exp), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(DESK_GATE_MS / 1000),
    });
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("properties")
      .select("hotel_code")
      .eq("id", propertyId)
      .maybeSingle();
    const code = (data?.hotel_code as string | null)?.trim();
    if (code) {
      jar.set(LOGIN_HOTEL_CODE_COOKIE, code, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: LOGIN_HOTEL_CODE_COOKIE_MAX_AGE,
      });
    }
  }

  redirect(next === "pos" ? "/erp/pos/login" : "/erp/login");
}

async function endStaffSession(): Promise<void> {
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
}

export async function staffLogout(): Promise<void> {
  await endStaffSession();
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
