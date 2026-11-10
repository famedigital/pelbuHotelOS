import { normalizePropertySlugInput } from "@hotel-os/core";
import { resolveDefaultV2PropertySlugFromEnv } from "./resolve-default-v2-property-slug";

/**
 * Browser-side Hotel OS desk API base URL (Fastify apps/api).
 */
export function getDeskApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_DESK_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:4100";
  }
  throw new Error(
    "NEXT_PUBLIC_DESK_API_URL is not set. Point it at the Fastify desk API (e.g. http://localhost:4100).",
  );
}

export function getDefaultPropertySlug(): string {
  return resolveDefaultV2PropertySlugFromEnv();
}

/**
 * Slug for API calls when an optional prop may contain UI copy (e.g. `Staff PIN · x-y`).
 */
export function normalizePropertySlugFromProp(raw: string | undefined): string {
  return normalizePropertySlugInput(raw) ?? resolveDefaultV2PropertySlugFromEnv();
}

export const V2_DESK_JWT_STORAGE_KEY = "hotel_os_v2_desk_jwt";
export const V2_DESK_STAFF_STORAGE_KEY = "hotel_os_v2_desk_staff_json";

export type V2StoredStaff = {
  id: string;
  fullName: string;
  deskRole: string | null;
  employeeCode: string;
};

export function readV2DeskToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(V2_DESK_JWT_STORAGE_KEY);
  } catch (err) {
    console.error("[v2.desk] readV2DeskToken failed", { err });
    return null;
  }
}

export function readV2Staff(): V2StoredStaff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(V2_DESK_STAFF_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as V2StoredStaff;
    if (!parsed?.id || !parsed.fullName) return null;
    return parsed;
  } catch (err) {
    console.error("[v2.desk] readV2Staff failed", { err });
    return null;
  }
}

export function writeV2Session(token: string, staff: V2StoredStaff): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(V2_DESK_JWT_STORAGE_KEY, token);
    window.localStorage.setItem(
      V2_DESK_STAFF_STORAGE_KEY,
      JSON.stringify(staff),
    );
  } catch (err) {
    console.error("[v2.desk] writeV2Session failed", { err });
    throw err;
  }
}

export function clearV2Session(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(V2_DESK_JWT_STORAGE_KEY);
    window.localStorage.removeItem(V2_DESK_STAFF_STORAGE_KEY);
  } catch (err) {
    console.error("[v2.desk] clearV2Session failed", { err });
  }
}

/**
 * Reload `/v1/desk/snapshot` after a successful mutation so RAM matches Postgres.
 */
export async function fetchDeskSnapshotJson(
  token: string,
): Promise<Record<string, unknown>> {
  const base = getDeskApiBaseUrl();
  const res = await fetch(`${base}/v1/desk/snapshot`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    credentials: "omit",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Desk snapshot ${res.status}: ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `Desk snapshot: invalid JSON (${err instanceof Error ? err.message : String(err)})`,
    );
  }
}
