import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  type ApiScope,
  type VerifiedApiKey,
  verifyBearerApiKey,
  writeApiAudit,
} from "@/lib/website-api-keys";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN_SCOPE"
  | "FORBIDDEN_ORIGIN"
  | "RATE_LIMITED"
  | "VALIDATION"
  | "QUOTE_MISMATCH"
  | "SOLD_OUT"
  | "NOT_FOUND"
  | "IDEMPOTENCY_CONFLICT"
  | "REVOKED_KEY"
  | "DUPLICATE_EXTERNAL_REF";

export function jsonError(
  code: ApiErrorCode,
  message: string,
  status: number,
  requestId: string,
  extraHeaders?: HeadersInit,
): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    {
      status,
      headers: {
        "X-Request-Id": requestId,
        ...extraHeaders,
      },
    },
  );
}

export function jsonOk(
  body: unknown,
  requestId: string,
  status = 200,
  extraHeaders?: HeadersInit,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "X-Request-Id": requestId,
      ...extraHeaders,
    },
  });
}

function corsHeaders(
  key: VerifiedApiKey,
  origin: string | null,
): HeadersInit | null {
  if (!origin) return {};
  if (!key.corsOrigins.includes(origin)) {
    return null;
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Idempotency-Key, X-Booking-Lookup-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

export function handleOptions(
  req: Request,
  keyCorsOrigins: string[],
): NextResponse {
  const origin = req.headers.get("origin");
  const requestId = randomUUID();
  if (!origin || !keyCorsOrigins.includes(origin)) {
    // Preflight without known key: allow only if we can't know — reject
    return new NextResponse(null, { status: 204, headers: { "X-Request-Id": requestId } });
  }
  return new NextResponse(null, {
    status: 204,
    headers: {
      "X-Request-Id": requestId,
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, Idempotency-Key, X-Booking-Lookup-Token",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  });
}

export async function authenticateApiRequest(
  req: Request,
  requiredScope: ApiScope,
  rate:
    | { kind: "availability" | "ari" | "bookings" },
): Promise<
  | {
      ok: true;
      key: VerifiedApiKey;
      requestId: string;
      ip: string;
      started: number;
      cors: HeadersInit;
    }
  | { ok: false; response: NextResponse }
> {
  const requestId = randomUUID();
  const started = Date.now();
  const ip = clientIp(req.headers);
  const origin = req.headers.get("origin");

  const verified = await verifyBearerApiKey(req.headers.get("authorization"), {
    ip,
    requiredScope,
  });

  if (!verified.ok) {
    const status =
      verified.code === "FORBIDDEN_SCOPE"
        ? 403
        : verified.code === "REVOKED_KEY"
          ? 401
          : 401;
    const res = jsonError(verified.code, messageFor(verified.code), status, requestId);
    await writeApiAudit({
      apiKeyId: null,
      propertyId: null,
      route: new URL(req.url).pathname,
      method: req.method,
      status,
      ip,
      requestId,
      latencyMs: Date.now() - started,
    });
    return { ok: false, response: res };
  }

  const cors = corsHeaders(verified.key, origin);
  if (origin && cors === null) {
    const res = jsonError(
      "FORBIDDEN_ORIGIN",
      "Origin is not allowlisted for this API key.",
      403,
      requestId,
    );
    await writeApiAudit({
      apiKeyId: verified.key.apiKeyId,
      propertyId: verified.key.propertyId,
      route: new URL(req.url).pathname,
      method: req.method,
      status: 403,
      ip,
      requestId,
      latencyMs: Date.now() - started,
    });
    return { ok: false, response: res };
  }

  const limits =
    rate.kind === "bookings"
      ? { key: 60, keyWindow: 60 * 60_000, ip: 20, ipWindow: 60 * 60_000 }
      : rate.kind === "ari"
        ? { key: 60, keyWindow: 60_000, ip: 30, ipWindow: 60_000 }
        : { key: 120, keyWindow: 60_000, ip: 60, ipWindow: 60_000 };

  const rlKey = await rateLimit(`v1:${rate.kind}:key:${verified.key.apiKeyId}`, {
    limit: limits.key,
    windowMs: limits.keyWindow,
  });
  const rlIp = await rateLimit(`v1:${rate.kind}:ip:${ip}`, {
    limit: limits.ip,
    windowMs: limits.ipWindow,
  });
  if (!rlKey.ok || !rlIp.ok) {
    const resetAt = Math.max(rlKey.resetAt, rlIp.resetAt);
    const retry = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    const res = jsonError(
      "RATE_LIMITED",
      "Too many requests.",
      429,
      requestId,
      {
        "Retry-After": String(retry),
        ...(cors ?? {}),
      },
    );
    await writeApiAudit({
      apiKeyId: verified.key.apiKeyId,
      propertyId: verified.key.propertyId,
      route: new URL(req.url).pathname,
      method: req.method,
      status: 429,
      ip,
      requestId,
      latencyMs: Date.now() - started,
    });
    return { ok: false, response: res };
  }

  return {
    ok: true,
    key: verified.key,
    requestId,
    ip,
    started,
    cors: cors ?? {},
  };
}

function messageFor(code: ApiErrorCode): string {
  switch (code) {
    case "UNAUTHORIZED":
      return "Invalid or missing API key.";
    case "REVOKED_KEY":
      return "API key is revoked or expired.";
    case "FORBIDDEN_SCOPE":
      return "API key is missing the required scope.";
    default:
      return "Request denied.";
  }
}

export async function finishAudit(
  auth: {
    key: VerifiedApiKey;
    requestId: string;
    ip: string;
    started: number;
  },
  req: Request,
  status: number,
): Promise<void> {
  await writeApiAudit({
    apiKeyId: auth.key.apiKeyId,
    propertyId: auth.key.propertyId,
    route: new URL(req.url).pathname,
    method: req.method,
    status,
    ip: auth.ip,
    requestId: auth.requestId,
    latencyMs: Date.now() - auth.started,
  });
}

export function hashRequestBody(body: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
}

export async function loadIdempotency(
  apiKeyId: string,
  idempotencyKey: string,
): Promise<{ requestHash: string; responseJson: unknown; bookingId: string | null } | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("website_api_idempotency")
    .select("request_hash, response_json, booking_id, created_at")
    .eq("api_key_id", apiKeyId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (!data) return null;
  const age = Date.now() - new Date(data.created_at as string).getTime();
  if (age > 24 * 60 * 60_000) return null;
  return {
    requestHash: data.request_hash as string,
    responseJson: data.response_json,
    bookingId: (data.booking_id as string | null) ?? null,
  };
}

export async function saveIdempotency(input: {
  apiKeyId: string;
  idempotencyKey: string;
  requestHash: string;
  responseJson: unknown;
  bookingId: string | null;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("website_api_idempotency").upsert(
    {
      api_key_id: input.apiKeyId,
      idempotency_key: input.idempotencyKey,
      request_hash: input.requestHash,
      response_json: input.responseJson,
      booking_id: input.bookingId,
    },
    { onConflict: "api_key_id,idempotency_key" },
  );
}

export async function readJsonBody(
  req: Request,
  maxBytes = 32_768,
): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const text = await req.text();
  if (text.length > maxBytes) {
    return { ok: false, error: "Request body too large." };
  }
  if (!text.trim()) {
    return { ok: false, error: "JSON body required." };
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "JSON object required." };
    }
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }
}
