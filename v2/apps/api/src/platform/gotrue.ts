/** Thin GoTrue password grant helper (droplet supabase-envoy). */

export function gotrueAuthBase(): string {
  const explicit = process.env.SUPABASE_AUTH_URL?.replace(/\/$/, "");
  if (explicit) {
    return explicit.endsWith("/auth/v1") ? explicit : `${explicit}/auth/v1`;
  }
  const supabase = process.env.SUPABASE_URL?.replace(/\/$/, "");
  if (supabase) {
    return supabase.endsWith("/auth/v1") ? supabase : `${supabase}/auth/v1`;
  }
  return "http://supabase-envoy:8000/auth/v1";
}

export function gotrueAnonKey(): string {
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw Object.assign(new Error("SUPABASE_ANON_KEY not configured"), { statusCode: 503 });
  }
  return key;
}

export type GoTrueUser = { id: string; email?: string };

export async function gotrueSignInWithPassword(
  email: string,
  password: string,
): Promise<
  | { ok: true; accessToken: string; user: GoTrueUser }
  | { ok: false; status: number; error: string }
> {
  const base = gotrueAuthBase();
  const key = gotrueAnonKey();
  let authRes: Response;
  try {
    authRes = await fetch(`${base}/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auth unreachable";
    return { ok: false, status: 503, error: message };
  }
  const authJson = (await authRes.json().catch(() => ({}))) as {
    access_token?: string;
    user?: { id?: string; email?: string };
    error_description?: string;
    msg?: string;
    error?: string;
  };
  if (!authRes.ok || !authJson.access_token || !authJson.user?.id) {
    return {
      ok: false,
      status: 401,
      error: "Incorrect email or password",
    };
  }
  return {
    ok: true,
    accessToken: authJson.access_token,
    user: { id: authJson.user.id, email: authJson.user.email },
  };
}
