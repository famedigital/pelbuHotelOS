import { createServerClient } from "@supabase/ssr";
import {
  flagshipPropertyIdFromEnv,
  flagshipSlug,
  isFlagshipHost,
} from "@/lib/free-tier";
import { NextResponse, type NextRequest } from "next/server";

/** Mirrors DESK_COOKIE_NAME in lib/desk-auth (that module imports next/headers). */
const DESK_COOKIE = "hotelos_desk_session";

/** Keep well under Vercel middleware 25s invokation budget. */
const MIDDLEWARE_NET_MS = 2_000;

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
}

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

function erpCredentialsPresent(request: NextRequest): boolean {
  if (!process.env.DESK_PIN?.trim()) {
    return process.env.NODE_ENV !== "production";
  }
  return hasValidDeskPinCookie(request) || hasSupabaseAuthCookie(request);
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

  const supportProperty = request.cookies.get("hotelos_support_property")?.value;
  const erpOk =
    erpCredentialsPresent(request) ||
    (Boolean(supportProperty) && hasSupabaseAuthCookie(request));

  if (isErp && pathname !== "/erp/login" && !erpOk) {
    return NextResponse.redirect(new URL("/erp/login", request.url));
  }

  if ((isAdmin || isPartner) && !hasSupabaseAuthCookie(request)) {
    const login = isAdmin ? "/admin/login" : "/partner/login";
    return NextResponse.redirect(new URL(login, request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
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

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const needsAuthRefresh =
    hasSupabaseAuthCookie(request) &&
    (pathname.startsWith("/staff") ||
      pathname.startsWith("/agents/app") ||
      pathname.startsWith("/agents/login") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/partner") ||
      (isErp && !hasValidDeskPinCookie(request)));

  if (needsAuthRefresh) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (url && anon) {
      try {
        const supabase = createServerClient(url, anon, {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
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
        if (!refreshed.ok) {
          console.warn("[middleware] auth refresh skipped (deadline/outage)");
        }
      } catch (err) {
        console.warn("[middleware] auth refresh failed open", err);
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
    "/agents/app/:path*",
    "/agents/login",
    "/admin",
    "/admin/:path*",
    "/partner",
    "/partner/:path*",
  ],
};
