import { createServerClient } from "@supabase/ssr";
import {
  flagshipPropertyIdFromEnv,
  flagshipSlug,
  isFlagshipHost,
} from "@/lib/free-tier";
import {
  erpCredentialsPresent,
  shouldApplyMiddlewareAuthCookies,
} from "@/lib/middleware-session-gate";
import { hasSupabaseAuthSessionCookie } from "@/lib/supabase-auth-cookies";
import { NextResponse, type NextRequest } from "next/server";

/** Mirrors DESK_COOKIE_NAME in lib/desk-auth (that module imports next/headers). */
const DESK_COOKIE = "hotelos_desk_session";

/** Keep well under Vercel middleware 25s invokation budget. */
const MIDDLEWARE_NET_MS = 2_000;

function hasValidDeskPinCookie(request: NextRequest): boolean {
  const pin = process.env.DESK_PIN?.trim();
  if (!pin) return false;
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DESK_PIN_IN_PROD !== "1"
  ) {
    return false;
  }
  return request.cookies.get(DESK_COOKIE)?.value === `ok:${pin}`;
}

function erpOkForRequest(request: NextRequest): boolean {
  const supportProperty = request.cookies.get("hotelos_support_property")?.value;
  const hasSession = hasSupabaseAuthSessionCookie(request.cookies.getAll());
  if (supportProperty && hasSession) return true;
  return erpCredentialsPresent({
    deskPinConfigured: Boolean(process.env.DESK_PIN?.trim()),
    isProduction: process.env.NODE_ENV === "production",
    hasValidDeskPinCookie: hasValidDeskPinCookie(request),
    hasSupabaseSessionCookie: hasSession,
  });
}

async function withDeadline<T>(
  work: Promise<T>,
  ms: number,
): Promise<{ ok: true; value: T } | { ok: false }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("middleware_deadline")), ms);
      }),
    ]);
    return { ok: true, value };
  } catch {
    return { ok: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Host → property + ERP/staff/agents/admin/partner session refresh.
 * Support cookie hotelos_support_property allows audited desk entry.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isErp = pathname === "/erp" || pathname.startsWith("/erp/");
  const isAdmin =
    pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");
  const isPartner =
    pathname.startsWith("/partner") && !pathname.startsWith("/partner/login");

  const hasSessionCookie = hasSupabaseAuthSessionCookie(request.cookies.getAll());
  const erpOk = erpOkForRequest(request);

  const isPosLogin =
    pathname === "/erp/pos/login" || pathname.startsWith("/erp/pos/login/");
  if (isErp && pathname !== "/erp/login" && !isPosLogin && !erpOk) {
    const loginPath =
      pathname === "/erp/pos" || pathname === "/erp/pos/"
        ? "/erp/pos/login"
        : "/erp/login";
    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  if ((isAdmin || isPartner) && !hasSessionCookie) {
    const login = isAdmin ? "/admin/login" : "/partner/login";
    return NextResponse.redirect(new URL(login, request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  const supportProperty = request.cookies.get("hotelos_support_property")?.value;
  if (supportProperty) {
    requestHeaders.set("x-property-id", supportProperty);
    requestHeaders.set("x-tenant-via", "support");
  }

  try {
    const host = request.headers.get("host");
    if (host && !supportProperty) {
      if (isFlagshipHost(host) || flagshipPropertyIdFromEnv()) {
        const id = flagshipPropertyIdFromEnv();
        if (id) requestHeaders.set("x-property-id", id);
        if (isFlagshipHost(host)) {
          requestHeaders.set("x-property-slug", flagshipSlug());
          requestHeaders.set("x-tenant-via", "flagship");
        } else if (id) {
          requestHeaders.set("x-property-slug", flagshipSlug());
          requestHeaders.set("x-tenant-via", "flagship-env");
        }
      } else if (!host.includes("localhost") && !host.endsWith(".vercel.app")) {
        const { resolvePropertyIdFromHost } = await import(
          "@/lib/tenant/resolve-host"
        );
        const resolved = await withDeadline(
          resolvePropertyIdFromHost(host),
          MIDDLEWARE_NET_MS,
        );
        if (resolved.ok) {
          requestHeaders.set("x-property-id", resolved.value.propertyId);
          requestHeaders.set("x-property-slug", resolved.value.slug);
          requestHeaders.set("x-tenant-via", resolved.value.via);
        }
      }
    }
  } catch {
    // never block
  }

  const pristine = NextResponse.next({
    request: { headers: requestHeaders },
  });
  let response = pristine;

  // Do NOT refresh Supabase sessions on /agents/* here. A failed/slow refresh
  // clears sb-* cookies via setAll and causes partner login loops. Agent pages
  // validate the session in RSC (getAgentSession) instead.
  const needsAuthRefresh =
    hasSessionCookie &&
    (pathname.startsWith("/staff") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/partner") ||
      (isErp && !hasValidDeskPinCookie(request)));

  if (needsAuthRefresh) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (url && anon) {
      let acceptSetAll = true;
      try {
        const supabase = createServerClient(url, anon, {
          cookieOptions: {
            path: "/",
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
          },
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              if (!acceptSetAll) return;
              cookiesToSet.forEach(({ name, value }) => {
                request.cookies.set(name, value);
              });
              response = NextResponse.next({
                request: { headers: requestHeaders },
              });
              cookiesToSet.forEach(({ name, value, options }) => {
                response.cookies.set(name, value, options);
              });
            },
          },
        });
        const refreshed = await withDeadline(
          supabase.auth.getUser(),
          MIDDLEWARE_NET_MS,
        );
        if (!shouldApplyMiddlewareAuthCookies(refreshed.ok)) {
          // Deadline/outage: ignore in-flight setAll (may clear sb-* cookies).
          acceptSetAll = false;
          console.warn("[middleware] auth refresh skipped (deadline/outage)");
          return pristine;
        }
      } catch (err) {
        acceptSetAll = false;
        console.warn("[middleware] auth refresh failed open", err);
        return pristine;
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/erp",
    "/erp/:path*",
    "/staff/:path*",
    // Still stamp x-pathname for agent shells; auth refresh skipped above.
    "/agents/app",
    "/agents/app/:path*",
    "/agents/login",
    "/admin",
    "/admin/:path*",
    "/partner",
    "/partner/:path*",
  ],
};
