import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/** Cookie-aware anon client for Server Components / Route Handlers. */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Pass only serialize options Next/cookies accepts — drops any
            // library-only fields that can throw and abort the whole setAll.
            cookieStore.set(name, value, {
              path: options?.path,
              domain: options?.domain,
              maxAge: options?.maxAge,
              expires: options?.expires,
              httpOnly: options?.httpOnly,
              secure: options?.secure,
              sameSite: options?.sameSite as
                | boolean
                | "lax"
                | "strict"
                | "none"
                | undefined,
            });
          });
        } catch {
          // Called from a Server Component — safe to ignore when middleware
          // refreshes sessions. Server Actions / Route Handlers must set cookies.
        }
      },
    },
  });
}
