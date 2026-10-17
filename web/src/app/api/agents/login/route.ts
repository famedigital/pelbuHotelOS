import {
  agentAuthEmail,
  normalizeAgentLoginCode,
  validateAgentPin,
} from "@/lib/agent-auth";
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

function loginErrorRedirect(request: NextRequest, message: string) {
  const url = new URL("/agents/login", request.url);
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

/**
 * Cookie-safe partner login. Server Actions can drop Supabase Set-Cookie on
 * the action response; a Route Handler redirect keeps session cookies attached.
 */
export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return loginErrorRedirect(request, "Could not read sign-in form.");
  }

  let loginCode: string;
  let pin: string;
  try {
    loginCode = normalizeAgentLoginCode(
      String(form.get("login_code") ?? "").trim(),
    );
    if (!loginCode) throw new Error("Agent code is required.");
    pin = validateAgentPin(String(form.get("pin") ?? ""));
  } catch (e) {
    return loginErrorRedirect(
      request,
      e instanceof Error ? e.message : "Invalid agent code or PIN.",
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: agent, error } = await admin
    .from("agents")
    .select("id, company_name, login_code, auth_user_id, can_login, status")
    .eq("login_code", loginCode)
    .maybeSingle();

  if (error || !agent || !agent.can_login || !agent.auth_user_id) {
    return loginErrorRedirect(request, "Incorrect agent code or PIN.");
  }

  let links: AgentPropertyLink[];
  try {
    links = await loadMouAgentLinks(admin, agent.id as string);
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
  const redirectTo = new URL(homePath, request.url);
  const response = NextResponse.redirect(redirectTo, 303);

  const cookieSecure = process.env.NODE_ENV === "production";
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
    email: agentAuthEmail(agent.login_code as string),
    password: pin,
  });
  if (signInError) {
    return loginErrorRedirect(request, "Incorrect agent code or PIN.");
  }

  // Ensure auth storage flush finished before we return Set-Cookie + redirect.
  await supabase.auth.getSession();

  if (active) {
    response.cookies.set(AGENT_PROPERTY_COOKIE, active.propertyId, {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure,
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
  } else {
    response.cookies.set(AGENT_PROPERTY_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure,
      path: "/",
      maxAge: 0,
    });
  }

  await admin
    .from("agents")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", agent.id);

  return response;
}
