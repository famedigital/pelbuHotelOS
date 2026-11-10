import { getDeskApiBaseUrl, readV2DeskToken } from "@/lib/v2/desk-api";

export class DeskApiError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`Desk API ${status}: ${body.slice(0, 500)}`);
    this.name = "DeskApiError";
    this.status = status;
    this.body = body;
  }
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Authenticated JSON fetch against `NEXT_PUBLIC_DESK_API_URL` (Bearer v2 JWT).
 */
export async function deskFetchJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = readV2DeskToken();
  if (!token) {
    throw new Error("Sign in with staff PIN on /v2 to obtain a desk JWT.");
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
      `Desk API: invalid JSON (${err instanceof Error ? err.message : String(err)})`,
    );
  }
}
