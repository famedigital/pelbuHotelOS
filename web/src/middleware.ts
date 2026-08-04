import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const INSTALL_PATHS = new Set(["/", "/book", "/menu", "/spa", "/meeting"]);

/** Mirrors DESK_COOKIE_NAME in lib/desk-auth (that module imports next/headers). */
const DESK_COOKIE = "pelbu_desk_session";

/**
 * Supabase Auth session cookies for @supabase/ssr / supabase-js.
 * Base name: `sb-<project-ref>-auth-token`
 * Chunks:     `sb-<project-ref>-auth-token.0`, `.1`, …
 * PKCE:       `sb-<project-ref>-auth-token-code-verifier`
 */
function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
}

function hasValidDeskPinCookie(request: NextRequest): boolean {
  const pin = process.env.DESK_PIN?.trim();
  if (!pin) return false;
  // Match desk-auth: shared PIN retired in prod unless escape hatch.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DESK_PIN_IN_PROD !== "1"
  ) {
    return false;
  }
  return request.cookies.get(DESK_COOKIE)?.value === `ok:${pin}`;
}

function isErpLoginPath(pathname: string): boolean {
  return pathname === "/erp/login" || pathname.startsWith("/erp/login/");
}

/**
 * Presence-only credential check for /erp. Authorisation still happens in each
 * page via isDeskAuthenticated() — desk-capable staff need a `can_access_desk`
 * lookup that is too expensive to run here. This gate exists so a page that
 * forgets its own guard fails closed instead of rendering to anonymous callers.
 *
 * Staff Auth cookies always count, even when DESK_PIN is unset or unavailable
 * in the Edge Middleware env. Forcing a DESK_PIN-shaped early return in prod
 * ignored sb-* cookies and caused login → /erp → /erp/login loops.
 */
function erpCredentialsPresent(request: NextRequest): boolean {
  if (hasSupabaseAuthCookie(request)) return true;
  if (hasValidDeskPinCookie(request)) return true;

  // Matches hasDeskPinSession(): no PIN configured means open access off prod.
  if (!process.env.DESK_PIN?.trim()) {
    return process.env.NODE_ENV !== "production";
  }

  return false;
}

/**
 * Gate /erp, refresh staff Auth cookies, and emit a short-lived install hint
 * for eligible public mobile visits. The browser still decides whether
 * installation is possible; middleware cannot invoke the native install prompt.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isErp = pathname === "/erp" || pathname.startsWith("/erp/");

  if (isErp && !isErpLoginPath(pathname) && !erpCredentialsPresent(request)) {
    return NextResponse.redirect(new URL("/erp/login", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  // Layouts (e.g. ERP) use this to skip shell chrome on print / KDS routes.
  requestHeaders.set("x-pathname", pathname);
  // Host → property hint for public/desk multi-tenant (Wave 4 foundation).
  // Pages may read x-pelbu-property-slug; flagship used when unset/unmatched.
  try {
    const host = request.headers.get("host");
    if (host && !host.includes("localhost")) {
      const { resolvePropertyIdFromHost } = await import(
        "@/lib/tenant/resolve-host"
      );
      const resolved = await resolvePropertyIdFromHost(host);
      requestHeaders.set("x-pelbu-property-id", resolved.propertyId);
      requestHeaders.set("x-pelbu-property-slug", resolved.slug);
      requestHeaders.set("x-pelbu-tenant-via", resolved.via);
    }
  } catch {
    // Never block the request on tenant resolution failure.
  }

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const needsAuthRefresh =
    pathname.startsWith("/staff") ||
    pathname.startsWith("/agents/app") ||
    pathname.startsWith("/agents/login") ||
    // Desk-capable staff reach /erp on Supabase Auth rather than the shared
    // PIN, so refresh only for them and let PIN sessions skip the round trip.
    (isErp && !hasValidDeskPinCookie(request) && hasSupabaseAuthCookie(request));

  if (needsAuthRefresh) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (url && anon) {
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
              request: {
                headers: requestHeaders,
              },
            });
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      });

      await supabase.auth.getUser();
    }
  }

  const userAgent = request.headers.get("user-agent") ?? "";
  const mobile = /android|iphone|ipad|ipod|mobile/i.test(userAgent);
  const shouldHint =
    mobile &&
    INSTALL_PATHS.has(pathname) &&
    !request.cookies.has("pelbu_pwa") &&
    !request.cookies.has("pelbu_pwa_dismiss");

  if (shouldHint) {
    response.cookies.set("pelbu_install_hint", "1", {
      path: "/",
      maxAge: 60 * 60,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    response.headers.set("x-pelbu-install", "1");
  } else {
    response.cookies.delete("pelbu_install_hint");
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/book",
    "/menu",
    "/spa",
    "/meeting",
    "/erp",
    "/erp/:path*",
    "/staff/:path*",
    "/agents/app/:path*",
    "/agents/login",
  ],
};
