"use server";

import { writeAuditEvent } from "@/lib/audit";
import {
  agentAuthEmail,
  getAgentSession,
  normalizeAgentLoginCode,
  provisionAgentAuthUser,
  validateAgentPin,
} from "@/lib/agent-auth";
import { hasSupabaseAuthSessionCookie } from "@/lib/supabase-auth-cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AgentLoginState = {
  ok: boolean;
  error?: string;
  redirectTo?: string;
};

function isRedirect(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function agentLogin(
  _previous: AgentLoginState,
  formData: FormData,
): Promise<AgentLoginState> {
  try {
    const loginCode = normalizeAgentLoginCode(
      trimRequired(formData.get("login_code"), "Agent code"),
    );
    const pin = validateAgentPin(String(formData.get("pin") ?? ""));

    const admin = createSupabaseAdminClient();
    const { data: agent, error } = await admin
      .from("agents")
      .select("id, company_name, login_code, auth_user_id, can_login, status")
      .eq("login_code", loginCode)
      .in("status", ["approved", "demo"])
      .maybeSingle();

    if (error) throw new Error("Could not look up agent login.");
    if (!agent || !agent.can_login || !agent.auth_user_id) {
      return { ok: false, error: "Incorrect agent code or PIN." };
    }

    const supabase = await createSupabaseServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: agentAuthEmail(agent.login_code as string),
      password: pin,
    });
    if (signInError) {
      return { ok: false, error: "Incorrect agent code or PIN." };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        ok: false,
        error: "Signed in but session cookie was not set. Try again.",
      };
    }

    const jar = await cookies();
    if (!hasSupabaseAuthSessionCookie(jar.getAll())) {
      return {
        ok: false,
        error: "Session cookie could not be saved. Check browser cookies and try again.",
      };
    }

    await admin
      .from("agents")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", agent.id);

    // Hard-nav on the client after Set-Cookie; avoid soft-redirect races.
    return { ok: true, redirectTo: "/agents/app" };
  } catch (error) {
    if (isRedirect(error)) throw error;
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not sign in.",
    };
  }
}

export async function agentLogout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/agents/login");
}

/**
 * Desk-only: enable agent code + PIN login. Requires an active desk session and
 * an approved/demo agent. Generates a stable login code if none exists.
 */
export async function setAgentPortalPin(
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
    const agentId = trimRequired(formData.get("agent_id"), "Agent");
    const pin = validateAgentPin(String(formData.get("pin") ?? ""));
    const confirm = String(formData.get("confirm_pin") ?? "").trim();
    if (pin !== confirm) throw new Error("PIN confirmation does not match.");

    const { data: agent, error } = await admin
      .from("agents")
      .select("id, company_name, login_code, auth_user_id, status")
      .eq("id", agentId)
      .maybeSingle();
    if (error || !agent) throw new Error("Agent not found.");
    if (!["approved", "demo"].includes(agent.status as string)) {
      throw new Error("Only approved or demo agents can receive a login PIN.");
    }

    let loginCode = (agent.login_code as string | null) ?? null;
    if (!loginCode) {
      loginCode = await generateAgentLoginCode(admin);
      const { error: codeError } = await admin
        .from("agents")
        .update({ login_code: loginCode })
        .eq("id", agentId);
      if (codeError) throw new Error("Could not assign an agent code.");
    }

    const authUserId = await provisionAgentAuthUser(
      admin,
      {
        id: agent.id as string,
        company_name: agent.company_name as string,
        login_code: loginCode,
        auth_user_id: (agent.auth_user_id as string | null) ?? null,
      },
      pin,
    );

    const { error: updateError } = await admin
      .from("agents")
      .update({
        auth_user_id: authUserId,
        can_login: true,
        pin_set_at: new Date().toISOString(),
      })
      .eq("id", agentId);
    if (updateError) throw new Error("Could not enable agent login.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "agent.pin_set",
      entityType: "agents",
      entityId: agentId,
      summary: `Enabled agent app login for ${agent.company_name as string}`,
      meta: { loginCode },
    });

    revalidatePath("/erp/agents");
    return { ok: true, message: `Agent login enabled. Code: ${loginCode}` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not set PIN.",
    };
  }
}

async function generateAgentLoginCode(
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<string> {
  const { count } = await admin
    .from("agents")
    .select("id", { count: "exact", head: true })
    .not("login_code", "is", null);
  const next = (count ?? 0) + 1;
  return `AG-${String(next).padStart(4, "0")}`;
}

export async function getAgentSessionSafe() {
  return getAgentSession();
}
