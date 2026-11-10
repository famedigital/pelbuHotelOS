import {
  agentAuthEmail,
  normalizeAgentLoginCode,
  validateAgentPin,
} from "@/lib/agent-auth";
import {
  AGENT_PORTAL_COOKIE,
  agentPortalCookieDomain,
  agentPortalCookieOptions,
  createAgentPortalToken,
  portalCookieClearSpecs,
} from "@/lib/agent-portal-session";
import {
  AGENT_PROPERTY_COOKIE,
  loadMouAgentLinks,
  type AgentPropertyLink,
} from "@/lib/erp/agent-property-links";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function requestHost(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.split(",")[0]?.trim() ||
    ""
  );
}

/** Public origin for error redirects only — success uses relative Location. */
function publicOrigin(request: NextRequest): string {
  const host = requestHost(request);
  let proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "";

  if (host && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
    if (!proto) {
      proto =
        /\.sslip\.io$/i.test(host) || /^\d+\.\d+\.\d+\.\d+/.test(host)
          ? "http"
          : "https";
    }
    if (/innorahotel\.com$/i.test(host)) proto = "https";
    return `${proto}://${host}`;
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  if (
    site &&
    !site.includes("localhost") &&
    !site.includes("127.0.0.1")
  ) {
    return site.startsWith("http") ? site : `https://${site}`;
  }

  return "https://innorahotel.com";
}

function loginErrorRedirect(request: NextRequest, message: string) {
  const url = new URL("/agents/login", publicOrigin(request));
  url.searchParams.set("error", message.slice(0, 240));
  return NextResponse.redirect(url, 303);
}

function pickActiveLink(links: AgentPropertyLink[]): AgentPropertyLink | null {
  if (links.length === 0) return null;
  if (links.length === 1) return links[0]!;
  return (
    links.find((l) => l.propertySlug === "pelbu-olakha") ||
    links.find(
      (l) =>
        !/demo/i.test(l.propertySlug) && !/demo/i.test(l.propertyName),
    ) ||
    null
  );
}

function clearStaleAuthCookies(response: NextResponse, request: NextRequest) {
  const host = requestHost(request);
  const domain = agentPortalCookieDomain(host);
  const secure = process.env.NODE_ENV === "production";
  for (const spec of portalCookieClearSpecs(host)) {
    response.cookies.set(spec.name, spec.value, spec.options);
  }

  const names = new Set(
    request.cookies
      .getAll()
      .map((c) => c.name)
      .filter((name) => name.startsWith("sb-") || name === AGENT_PROPERTY_COOKIE),
  );
  names.add(AGENT_PROPERTY_COOKIE);

  for (const name of names) {
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      secure,
    });
    if (domain) {
      response.cookies.set(name, "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure,
        domain,
      });
    }
  }
}

type AgentRow = {
  id: string;
  company_name: string;
  login_code: string | null;
  auth_user_id: string | null;
  can_login: boolean;
  status: string;
  contact_email: string | null;
};

function looksLikeEmail(value: string): boolean {
  return value.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Cookie-safe partner login. Relative Location keeps Set-Cookie same-origin;
 * signed innora_agent_portal is the session browsers actually keep.
 *
 * Accepts either:
 * - partner email + password (contact_email → auth.users)
 * - agent code + 4–8 digit PIN (legacy internal auth email)
 */
export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return loginErrorRedirect(request, "Could not read sign-in form.");
  }

  const rawId = String(form.get("login_code") ?? "").trim();
  const secret = String(form.get("pin") ?? "");
  if (!rawId || !secret) {
    return loginErrorRedirect(request, "Email/code and password/PIN are required.");
  }

  const admin = createSupabaseAdminClient();
  const emailMode = looksLikeEmail(rawId);
  let agent: AgentRow | null = null;
  let authEmail: string;

  if (emailMode) {
    const email = rawId.toLowerCase();
    const { data, error } = await admin
      .from("agents")
      .select(
        "id, company_name, login_code, auth_user_id, can_login, status, contact_email",
      )
      .ilike("contact_email", email)
      .eq("can_login", true)
      .maybeSingle();
    if (error || !data?.auth_user_id) {
      return loginErrorRedirect(request, "Incorrect email or password.");
    }
    agent = data as AgentRow;
    authEmail = email;
  } else {
    let loginCode: string;
    try {
      loginCode = normalizeAgentLoginCode(rawId);
      if (!loginCode) throw new Error("Agent code is required.");
    } catch (e) {
      return loginErrorRedirect(
        request,
        e instanceof Error ? e.message : "Invalid agent code or PIN.",
      );
    }

    const { data, error } = await admin
      .from("agents")
      .select(
        "id, company_name, login_code, auth_user_id, can_login, status, contact_email",
      )
      .eq("login_code", loginCode)
      .maybeSingle();

    if (error || !data || !data.can_login || !data.auth_user_id) {
      return loginErrorRedirect(request, "Incorrect agent code or PIN.");
    }
    agent = data as AgentRow;
    /* Prefer real portal email when provisioned; else synthetic code@agent… + PIN. */
    const portalEmail = agent.contact_email?.trim().toLowerCase() || "";
    authEmail = portalEmail || agentAuthEmail(String(agent.login_code));
    if (!portalEmail) {
      try {
        validateAgentPin(secret);
      } catch (e) {
        return loginErrorRedirect(
          request,
          e instanceof Error ? e.message : "Invalid agent code or PIN.",
        );
      }
    } else if (secret.length < 4 || secret.length > 72) {
      return loginErrorRedirect(request, "Incorrect agent code or password.");
    }
  }

  if (!agent?.auth_user_id) {
    return loginErrorRedirect(request, "Incorrect email or password.");
  }

  let links: AgentPropertyLink[];
  try {
    links = await loadMouAgentLinks(admin, agent.id);
  } catch {
    return loginErrorRedirect(
      request,
      "Could not load hotel MoU links. Try again.",
    );
  }
  if (links.length === 0) {
    return loginErrorRedirect(
      request,
      "No hotel MoU is on file for this agent yet. Rates and inventory open after a signed MoU.",
    );
  }

  const active = pickActiveLink(links);
  const homePath = active ? "/agents/app" : "/agents/app/select-property";
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: homePath },
  });

  clearStaleAuthCookies(response, request);

  const cookieSecure = process.env.NODE_ENV === "production";
  const host = requestHost(request);
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: cookieSecure,
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password: secret,
  });
  if (signInError) {
    return loginErrorRedirect(
      request,
      emailMode ? "Incorrect email or password." : "Incorrect agent code or PIN.",
    );
  }

  await supabase.auth.getSession();

  const portalToken = createAgentPortalToken(agent.id, agent.auth_user_id);
  response.cookies.set(
    AGENT_PORTAL_COOKIE,
    portalToken,
    agentPortalCookieOptions(host),
  );

  const propertyDomain = agentPortalCookieDomain(host);
  const propertyOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieSecure,
    path: "/",
    ...(propertyDomain ? { domain: propertyDomain } : {}),
  };

  if (active) {
    response.cookies.set(AGENT_PROPERTY_COOKIE, active.propertyId, {
      ...propertyOpts,
      maxAge: 60 * 60 * 24 * 90,
    });
  } else {
    response.cookies.set(AGENT_PROPERTY_COOKIE, "", {
      ...propertyOpts,
      maxAge: 0,
    });
  }

  await admin
    .from("agents")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", agent.id);

  return response;
}
