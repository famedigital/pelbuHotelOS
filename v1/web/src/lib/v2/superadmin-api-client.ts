import { getDeskApiBaseUrl, readV2DeskToken } from "@/lib/v2/desk-api";
import { DeskApiError } from "@/lib/v2/desk-api-client";

/**
 * Platform SuperAdmin calls use the same Bearer JWT as desk PIN auth;
 * the API checks `platform_admins` for the JWT subject.
 */
export async function superadminFetchJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = readV2DeskToken();
  if (!token) {
    throw new Error("Sign in on /v2 with a platform admin staff PIN (listed in platform_admins).");
  }
  const base = getDeskApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new DeskApiError(res.status, text);
  }
  if (!text.trim()) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error(
      `SuperAdmin API: invalid JSON (${err instanceof Error ? err.message : String(err)})`,
    );
  }
}
