import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * Next.js CookieStore options that work on Vercel production.
 * Always pin path + SameSite + Secure so auth cookies survive the
 * Server Action → redirect → GET /erp hop on pelbu-os.vercel.app.
 */
function nextCookieOptions(
  options?: CookieOptions,
): Pick<
  CookieOptions,
  | "path"
  | "domain"
  | "maxAge"
  | "expires"
  | "httpOnly"
  | "secure"
  | "sameSite"
> {
  return {
    path: options?.path ?? "/",
    domain: options?.domain,
    maxAge: options?.maxAge,
    expires: options?.expires,
    httpOnly: options?.httpOnly,
    // Production (HTTPS): require Secure. Dev may run on http://localhost.
    secure: options?.secure ?? process.env.NODE_ENV === "production",
    sameSite: (options?.sameSite as CookieOptions["sameSite"]) ?? "lax",
  };
}

function bindSupabaseCookies(cookieStore: ReadonlyRequestCookies) {
  return {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          // Pass only serialize options Next/cookies accepts — drops any
          // library-only fields that can throw and abort the whole setAll.
          cookieStore.set(name, value, nextCookieOptions(options));
        });
      } catch {
        // Called from a Server Component — safe to ignore when middleware
        // refreshes sessions. Server Actions / Route Handlers must set cookies.
      }
    },
  };
}

/** Cookie-aware anon client for Server Components / Route Handlers / Actions. */
export async function createSupabaseServerClient(
  cookieStore?: ReadonlyRequestCookies,
) {
  const jar = cookieStore ?? (await cookies());

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: bindSupabaseCookies(jar),
  });
}
