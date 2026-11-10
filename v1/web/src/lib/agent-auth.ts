import { cookies } from "next/headers";
import {
  AGENT_PORTAL_COOKIE,
  parseAgentPortalToken,
} from "@/lib/agent-portal-session";
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

async function readPortalCookie(): Promise<string | null> {
  try {
    const jar = await cookies();
    // Host-only + Domain=.innorahotel.com duplicates can coexist after redeploys.
    // Prefer a value that actually verifies — empty/stale host-only must not win.
    const matches = jar
      .getAll()
      .filter((c) => c.name === AGENT_PORTAL_COOKIE)
      .map((c) => c.value?.trim() || "")
      .filter(Boolean);
    for (const value of matches) {
      if (parseAgentPortalToken(value)) return value;
    }
    return matches[0] ?? null;
  } catch {
    return null;
  }
}

async function sessionFromAgentRow(
  admin: Admin,
  data: {
    id: string;
    company_name: string;
    market: string;
    status: string;
    login_code: string | null;
    can_login: boolean;
    auth_user_id: string | null;
  },
  authUserId: string,
): Promise<AgentSession | null> {
  if (!data.can_login) return null;

  let links: AgentPropertyLink[];
  try {
    links = await loadMouAgentLinks(admin, data.id);
  } catch {
    return null;
  }
  if (links.length === 0) return null;

  const cookieId = await readAgentPropertyCookie();
  const active = resolveActiveLinkFromCookie(links, cookieId);

  return {
    agentId: data.id,
    authUserId,
    companyName: data.company_name,
    market: data.market,
    status: data.status,
    loginCode: data.login_code ?? "",
    links,
    activePropertyId: active?.propertyId ?? null,
    rateTier: active?.rateTier ?? "agents",
    creditLimit: active?.creditLimit ?? 0,
    creditUsed: active?.creditUsed ?? 0,
  };
}

/**
 * Portal session: signed partner cookie (preferred) or Supabase Auth,
 * plus can_login + ≥1 MoU-signed property link.
 */
export async function getAgentSession(): Promise<AgentSession | null> {
  const admin = createSupabaseAdminClient();
  const agentSelect =
    "id, company_name, market, status, login_code, can_login, auth_user_id";

  const portal = parseAgentPortalToken(await readPortalCookie());
  if (portal) {
    const { data } = await admin
      .from("agents")
      .select(agentSelect)
      .eq("id", portal.agentId)
      .eq("auth_user_id", portal.authUserId)
      .maybeSingle();
    if (data) {
      return sessionFromAgentRow(
        admin,
        data as {
          id: string;
          company_name: string;
          market: string;
          status: string;
          login_code: string | null;
          can_login: boolean;
          auth_user_id: string | null;
        },
        portal.authUserId,
      );
    }
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await admin
    .from("agents")
    .select(agentSelect)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!data) return null;

  return sessionFromAgentRow(
    admin,
    data as {
      id: string;
      company_name: string;
      market: string;
      status: string;
      login_code: string | null;
      can_login: boolean;
      auth_user_id: string | null;
    },
    user.id,
  );
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

/**
 * Guard for portal loaders: every query must be scoped to the signed-in agent.
 * Throws when a caller passes another agent's id (defense in depth vs service-role).
 */
export function assertPortalAgentScope(
  session: Pick<AgentSession, "agentId">,
  agentId: string,
): void {
  if (session.agentId !== agentId) {
    throw new Error("Partner portal may only load your own records.");
  }
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
