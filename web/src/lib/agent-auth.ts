import { cookies } from "next/headers";
import {
  AGENT_PROPERTY_COOKIE,
  loadMouAgentLinks,
  resolveActiveLinkFromCookie,
  type AgentPropertyLink,
} from "@/lib/erp/agent-property-links";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type AgentSession = {
  agentId: string;
  authUserId: string;
  companyName: string;
  market: string;
  /** Platform registry status on agents row. */
  status: string;
  loginCode: string;
  /** Approved hotel memberships. */
  links: AgentPropertyLink[];
  /** Active hotel from cookie (null when agent must pick). */
  activePropertyId: string | null;
  /** Commercial terms for active hotel; null until property selected. */
  rateTier: string;
  creditLimit: number;
  creditUsed: number;
};

/** Deterministic Auth email for agent-code/PIN identities (never shown to agents). */
export function agentAuthEmail(loginCode: string): string {
  const code = loginCode.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `${code}@agent.pelbusuites.internal`;
}

export function validateAgentPin(pin: string): string {
  const normalized = pin.trim();
  if (!/^\d{4,8}$/.test(normalized)) {
    throw new Error("PIN must be 4 to 8 digits.");
  }
  return normalized;
}

export function normalizeAgentLoginCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

async function readAgentPropertyCookie(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(AGENT_PROPERTY_COOKIE)?.value?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Portal session: Auth + can_login + ≥1 MoU-signed property link.
 * Rates and inventory are only for hotels with a signed MoU.
 */
export async function getAgentSession(): Promise<AgentSession | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("agents")
    .select(
      "id, company_name, market, status, login_code, can_login, auth_user_id",
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!data || !data.can_login) {
    return null;
  }

  let links: AgentPropertyLink[];
  try {
    links = await loadMouAgentLinks(admin, data.id as string);
  } catch {
    return null;
  }
  if (links.length === 0) return null;

  const cookieId = await readAgentPropertyCookie();
  const active = resolveActiveLinkFromCookie(links, cookieId);

  return {
    agentId: data.id as string,
    authUserId: user.id,
    companyName: data.company_name as string,
    market: data.market as string,
    status: data.status as string,
    loginCode: (data.login_code as string | null) ?? "",
    links,
    activePropertyId: active?.propertyId ?? null,
    rateTier: active?.rateTier ?? "agents",
    creditLimit: active?.creditLimit ?? 0,
    creditUsed: active?.creditUsed ?? 0,
  };
}

export async function requireAgentSession(): Promise<AgentSession> {
  const session = await getAgentSession();
  if (!session) redirect("/agents/login");
  return session;
}

/** Require session with an active approved property (redirect to picker if needed). */
export async function requireAgentPropertySession(): Promise<
  AgentSession & { activePropertyId: string }
> {
  const session = await requireAgentSession();
  if (!session.activePropertyId) {
    redirect("/agents/app/select-property");
  }
  return session as AgentSession & { activePropertyId: string };
}

export async function provisionAgentAuthUser(
  admin: Admin,
  agent: {
    id: string;
    company_name: string;
    login_code: string;
    auth_user_id: string | null;
  },
  pin: string,
): Promise<string> {
  const password = validateAgentPin(pin);
  const email = agentAuthEmail(agent.login_code);
  const appMetadata = {
    kind: "agent",
    agent_id: agent.id,
  };

  if (agent.auth_user_id) {
    const { error } = await admin.auth.admin.updateUserById(agent.auth_user_id, {
      password,
      app_metadata: appMetadata,
      ban_duration: "none",
    });
    if (error) throw new Error("Could not update agent PIN.");
    return agent.auth_user_id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { company_name: agent.company_name },
    app_metadata: appMetadata,
  });
  if (error || !data.user) {
    throw new Error(error?.message || "Could not create agent login.");
  }
  return data.user.id;
}
