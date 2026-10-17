import {
  AGENT_PORTAL_COOKIE,
  agentPortalCookieDomain,
  portalCookieClearSpecs,
} from "@/lib/agent-portal-session";
import { AGENT_PROPERTY_COOKIE } from "@/lib/erp/agent-property-links";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
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

/** GET — clear partner cookies and land on login (breaks browser redirect loops). */
export async function GET(request: NextRequest) {
  const host = requestHost(request);
  const domain = agentPortalCookieDomain(host);
  const secure = process.env.NODE_ENV === "production";
  // Relative Location — same-origin clears must not bounce to sslip/internal hosts.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/agents/login" },
  });

  for (const spec of portalCookieClearSpecs(host || "innorahotel.com")) {
    response.cookies.set(spec.name, spec.value, spec.options);
  }

  const names = new Set(
    request.cookies
      .getAll()
      .map((c) => c.name)
      .filter(
        (name) =>
          name.startsWith("sb-") ||
          name === AGENT_PROPERTY_COOKIE ||
          name === AGENT_PORTAL_COOKIE,
      ),
  );
  names.add(AGENT_PROPERTY_COOKIE);
  names.add(AGENT_PORTAL_COOKIE);

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

  try {
    const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      cookieOptions: { path: "/", sameSite: "lax", secure },
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
    await supabase.auth.signOut();
  } catch {
    // still redirect with clears
  }

  return response;
}
