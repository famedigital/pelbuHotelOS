import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const INSTALL_PATHS = new Set(["/", "/book", "/menu", "/spa", "/meeting"]);

/** Mirrors DESK_COOKIE_NAME in lib/desk-auth (that module imports next/headers). */
const DESK_COOKIE = "pelbu_desk_session";

/** Keep well under Vercel middleware 25s invokation budget. */
const MIDDLEWARE_NET_MS = 2_500;

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

/**
 * Presence-only credential check for /erp. Authorisation still happens in each
 * page via isDeskAuthenticated() — desk-capable staff need a `can_access_desk`
 * lookup that is too expensive to run here. This gate exists so a page that
 * forgets its own guard fails closed instead of rendering to anonymous callers.
 */
function erpCredentialsPresent(request: NextRequest): boolean {
  // Matches hasDeskPinSession(): no PIN configured means open access off prod.
  if (!process.env.DESK_PIN?.trim()) {
    return process.env.NODE_ENV !== "production";
  }
  return hasValidDeskPinCookie(request) || hasSupabaseAuthCookie(request);
}

/** Race network work so Supabase 522 / hang cannot take the whole middleware. */
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
 * Gate /erp, refresh staff Auth cookies, and emit a short-lived install hint
 * for eligible public mobile visits. The browser still decides whether
 * installation is possible; middleware cannot invoke the native install prompt.
 *
 * Network calls must fail-open with a short deadline — Supabase Auth outages
 * (522) previously held every request until MIDDLEWARE_INVOCATION_TIMEOUT.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isErp = pathname === "/erp" || pathname.startsWith("/erp/");

  if (isErp && pathname !== "/erp/login" && !erpCredentialsPresent(request)) {
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
      const resolved = await withDeadline(
        resolvePropertyIdFromHost(host),
        MIDDLEWARE_NET_MS,
      );
      if (resolved.ok) {
        requestHeaders.set("x-pelbu-property-id", resolved.value.propertyId);
        requestHeaders.set("x-pelbu-property-slug", resolved.value.slug);
        requestHeaders.set("x-pelbu-tenant-via", resolved.value.via);
      }
      // On timeout / Supabase outage: leave unset; pages resolve flagship themselves.
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

        // Fail-open: session refresh is best-effort. Auth 522 must not 504 the site.
        const refreshed = await withDeadline(
          supabase.auth.getUser(),
          MIDDLEWARE_NET_MS,
        );
        if (!refreshed.ok) {
          console.warn(
            "[middleware] supabase.auth.getUser deadline — continuing without refresh",
          );
        }
      } catch (err) {
        console.warn("[middleware] auth refresh failed open", err);
      }
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
