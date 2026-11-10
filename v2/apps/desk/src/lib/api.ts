/** Desk → clean v2 API. Dev actor until PIN gateway issues JWTs. */

/**
 * Empty string = same-origin (production nginx proxies /v1 + /health).
 * Unset in local Vite → localhost API. Explicit VITE_API_URL overrides.
 */
export const API_BASE =
  import.meta.env.VITE_API_URL !== undefined
    ? String(import.meta.env.VITE_API_URL).replace(/\/$/, "")
    : "http://127.0.0.1:4200";

/** Absolute URL for fetch / EventSource when API_BASE may be same-origin "". */
export function apiAbsoluteUrl(path: string): URL {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (API_BASE) return new URL(`${API_BASE}${p}`);
  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:4280";
  return new URL(p, origin);
}

function sessionBearer(): string | null {
  try {
    return (
      sessionStorage.getItem("hos.v2.desk.token") ||
      sessionStorage.getItem("hos.v2.portal.token") ||
      sessionStorage.getItem("hos.v2.hotel.token")
    );
  } catch {
    return null;
  }
}

/** Fired when active `hos.v2.propertyId` changes (hotel switch / login). */
export const HOS_PROPERTY_CHANGED_EVENT = "hos:v2:property-changed";

export function notifyPropertyChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HOS_PROPERTY_CHANGED_EVENT));
}

/** Active tenant from hotel login; falls back to local demo id only. */
export function sessionPropertyId(): string {
  try {
    return localStorage.getItem("hos.v2.propertyId") || DEV_PROPERTY_ID;
  } catch {
    return DEV_PROPERTY_ID;
  }
}

/** Stable demo property for local deep-page work (not Pelbu hardcode in product). */
export const DEV_PROPERTY_ID = "00000000-0000-4000-8000-000000000001";

export const DEV_ACTOR = {
  staffId: "00000000-0000-4000-8000-0000000000aa",
  role: "gm",
  propertyId: DEV_PROPERTY_ID,
  tenantId: DEV_PROPERTY_ID,
};

type Inflight = {
  promise: Promise<unknown>;
  controller: AbortController;
};

const inflightGets = new Map<string, Inflight>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts?: { retries?: number; timeoutMs?: number },
): Promise<Response> {
  const retries = opts?.retries ?? 2;
  const timeoutMs = opts?.timeoutMs ?? 10_000;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const parent = init.signal;
    const onParentAbort = () => controller.abort();
    if (parent) {
      if (parent.aborted) controller.abort();
      else parent.addEventListener("abort", onParentAbort, { once: true });
    }
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (parent) parent.removeEventListener("abort", onParentAbort);
      /* Retry transient upstream failures. */
      if (res.status >= 500 && attempt < retries) {
        await sleep(300 * 2 ** attempt);
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (parent) parent.removeEventListener("abort", onParentAbort);
      lastErr = err;
      const aborted =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");
      if (aborted && parent?.aborted) throw err;
      if (attempt < retries) {
        await sleep(300 * 2 ** attempt);
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Coalesced GET — identical in-flight paths share one network round-trip. */
export async function apiGet<T>(
  path: string,
  opts?: { signal?: AbortSignal; retries?: number },
): Promise<T> {
  const key = path;
  const existing = inflightGets.get(key);
  if (existing) {
    return existing.promise as Promise<T>;
  }
  const controller = new AbortController();
  if (opts?.signal) {
    if (opts.signal.aborted) controller.abort();
    else {
      opts.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }
  const promise = (async () => {
    try {
      const res = await fetchWithRetry(
        `${API_BASE}${path}`,
        { method: "GET", signal: controller.signal },
        { retries: opts?.retries ?? 2 },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `GET ${path} failed (${res.status})`);
      }
      return (await res.json()) as T;
    } finally {
      inflightGets.delete(key);
    }
  })();
  inflightGets.set(key, { promise, controller });
  return promise;
}

export async function runCommandRaw<T>(
  command: string,
  input: Record<string, unknown>,
  opts?: { signal?: AbortSignal },
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const propertyId = sessionPropertyId();
    const token = sessionBearer();
    const actor = {
      ...DEV_ACTOR,
      propertyId,
      tenantId: propertyId,
    };
    const res = await fetchWithRetry(
      `${API_BASE}/v1/command`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          command,
          input: { ...input, propertyId },
          actor,
        }),
        signal: opts?.signal,
      },
      { retries: 1, timeoutMs: 15_000 },
    );
    const body = (await res.json()) as { ok: boolean; data?: T; error?: string };
    if (!body.ok) return { ok: false, error: body.error ?? `Command ${command} failed` };
    return { ok: true, data: body.data as T };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api] runCommand failed", { command, err: msg });
    return { ok: false, error: "API_UNREACHABLE" };
  }
}

export async function runCommand<T>(
  command: string,
  input: Record<string, unknown>,
  opts?: { bufferOffline?: boolean; signal?: AbortSignal },
): Promise<{ ok: true; data: T } | { ok: false; error: string; queued?: boolean }> {
  const res = await runCommandRaw<T>(command, input, { signal: opts?.signal });
  if (res.ok) return res;
  if (res.error === "API_UNREACHABLE" && opts?.bufferOffline !== false) {
    try {
      const { enqueueOfflineCommand } = await import("./offline-buffer");
      await enqueueOfflineCommand(command, {
        ...input,
        propertyId: sessionPropertyId(),
      });
      return { ok: false, error: "API_UNREACHABLE", queued: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[api] offline enqueue failed", { command, err: msg });
    }
  }
  return res;
}

/** Lightweight health probe for shell connection pill. */
export async function probeApiHealth(): Promise<{
  ok: boolean;
  ms: number;
  error?: string;
}> {
  const t0 = performance.now();
  try {
    const res = await fetchWithRetry(
      `${API_BASE}/health`,
      { method: "GET" },
      { retries: 0, timeoutMs: 4_000 },
    );
    const ms = Math.round(performance.now() - t0);
    if (!res.ok) return { ok: false, ms, error: `HTTP ${res.status}` };
    return { ok: true, ms };
  } catch (err) {
    return {
      ok: false,
      ms: Math.round(performance.now() - t0),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Hard-law commands that must not silently invent money — local demo only when API refuses. */
export function isOpsDbUnavailable(error: string): boolean {
  return (
    error === "DATABASE_REQUIRED" ||
    error === "PROPERTY_NOT_FOUND" ||
    error === "API_UNREACHABLE"
  );
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
