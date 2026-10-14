/**
 * Service-role PostgREST helper for one-off Hotel OS scripts.
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

export function restClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with node --env-file=.env.local",
    );
  }

  async function request(path, options = {}) {
    const method = options.method ?? "GET";
    const response = await fetch(`${url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(options.prefer ? { Prefer: options.prefer } : {}),
      },
      body: options.body == null ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!response.ok) {
      const message =
        data && typeof data === "object"
          ? data.message || data.hint || data.details || JSON.stringify(data)
          : text;
      throw new Error(`${method} ${path.split("?")[0]} ${response.status}: ${message}`);
    }
    return data;
  }

  return {
    url,
    request,
    async select(path) {
      return (await request(path)) ?? [];
    },
    async insert(table, body, onConflict) {
      const path = onConflict
        ? `${table}?on_conflict=${encodeURIComponent(onConflict)}`
        : table;
      const prefer = onConflict
        ? "resolution=merge-duplicates,return=representation"
        : "return=representation";
      return request(path, { method: "POST", body, prefer });
    },
    async update(path, body) {
      return request(path, {
        method: "PATCH",
        body,
        prefer: "return=representation",
      });
    },
  };
}
