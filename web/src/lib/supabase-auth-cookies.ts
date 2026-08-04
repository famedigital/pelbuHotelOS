/**
 * Detect Supabase Auth session cookies written by @supabase/ssr.
 *
 * Project ref umrpibwhxpzsfdyypiuf → names like:
 *   sb-umrpibwhxpzsfdyypiuf-auth-token
 *   sb-umrpibwhxpzsfdyypiuf-auth-token.0  (chunked JWT)
 *   sb-umrpibwhxpzsfdyypiuf-auth-token.1
 *
 * PKCE verifier (`*-auth-token-code-verifier`) alone is not a session.
 */
export function isSupabaseAuthSessionCookieName(name: string): boolean {
  if (!name.startsWith("sb-")) return false;
  if (name.endsWith("-auth-token")) return true;
  return /\-auth-token\.\d+$/.test(name);
}

export function hasSupabaseAuthSessionCookie(
  cookies: Iterable<{ name: string }>,
): boolean {
  for (const c of cookies) {
    if (isSupabaseAuthSessionCookieName(c.name)) return true;
  }
  return false;
}

type MutableCookieJar = {
  getAll(): { name: string }[];
  delete(name: string): void;
};

/** Drop stale sb-* session chunks before a fresh staff sign-in. */
export function clearSupabaseAuthSessionCookies(jar: MutableCookieJar): void {
  for (const cookie of jar.getAll()) {
    if (isSupabaseAuthSessionCookieName(cookie.name)) {
      jar.delete(cookie.name);
    }
  }
}
