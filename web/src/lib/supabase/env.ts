export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

/**
 * Server-side Postgres/Realtime URL.
 * Set SUPABASE_INTERNAL_URL to the Docker network host so the app does not
 * hairpin out to the public :8001 address. Browsers keep NEXT_PUBLIC_SUPABASE_URL.
 */
export function getSupabaseServerUrl(): string {
  const internal = process.env.SUPABASE_INTERNAL_URL?.trim();
  if (internal) return internal;
  return getSupabaseUrl();
}

export function getSupabaseAnonKey(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
