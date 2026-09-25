"use server";

import { writeAuditEvent } from "@/lib/audit";
import {
  agentAuthEmail,
  getAgentSession,
  normalizeAgentLoginCode,
  provisionAgentAuthUser,
  validateAgentPin,
} from "@/lib/agent-auth";
import { isCreditAgentStatus } from "@/lib/agents/status";
import {
  AGENT_PROPERTY_COOKIE,
  getAgentPropertyLink,
  loadMouAgentLinks,
} from "@/lib/erp/agent-property-links";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AgentLoginState = {
  ok: boolean;
  error?: string;
};

function isRedirect(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

async function setAgentPropertyCookie(propertyId: string | null) {
  const jar = await cookies();
  if (!propertyId) {
    jar.delete(AGENT_PROPERTY_COOKIE);
    return;
  }
  jar.set(AGENT_PROPERTY_COOKIE, propertyId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
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
      .maybeSingle();

    if (error) throw new Error("Could not look up agent login.");
    if (!agent || !agent.can_login || !agent.auth_user_id) {
      return { ok: false, error: "Incorrect agent code or PIN." };
    }

    const links = await loadMouAgentLinks(admin, agent.id as string);
    if (links.length === 0) {
      return {
        ok: false,
        error:
          "No hotel MoU is on file for this agent yet. Rates and inventory open after the hotel and Innora record a signed MoU.",
      };
    }

    const supabase = await createSupabaseServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: agentAuthEmail(agent.login_code as string),
      password: pin,
    });
    if (signInError) {
      return { ok: false, error: "Incorrect agent code or PIN." };
    }

    await admin
      .from("agents")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", agent.id);

    if (links.length === 1) {
      await setAgentPropertyCookie(links[0]!.propertyId);
      redirect("/agents/app");
    }

    await setAgentPropertyCookie(null);
    redirect("/agents/app/select-property");
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
  await setAgentPropertyCookie(null);
  await supabase.auth.signOut();
  redirect("/agents/login");
}

export async function setAgentActiveProperty(
  formData: FormData,
): Promise<void> {
  const session = await getAgentSession();
  if (!session) redirect("/agents/login");

  const propertyId = String(formData.get("property_id") ?? "").trim();
  const allowed = session.links.some(
    (l) =>
      l.propertyId === propertyId &&
      l.status === "approved" &&
      Boolean(l.mouSignedAt),
  );
  if (!allowed) {
    redirect("/agents/app/select-property");
  }

  await setAgentPropertyCookie(propertyId);
  revalidatePath("/agents/app");
  redirect("/agents/app");
}

/**
 * Desk-only: enable agent code + PIN login. Linking a hotel does not create Auth;
 * PIN is once per agent identity. Requires approved link at active hotel or
 * legacy approved/demo status.
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

    const link = await getAgentPropertyLink(admin, agentId, propertyId);
    const creditOk = isCreditAgentStatus(agent.status as string);
    const linkOk = link?.status === "approved";
    if (!creditOk && !linkOk) {
      throw new Error(
        "Link this agent to the hotel (approved) before enabling a portal PIN.",
      );
    }
    if (!link?.mouSignedAt) {
      throw new Error(
        "Record a signed MoU for this hotel before enabling portal login (rates & inventory).",
      );
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
