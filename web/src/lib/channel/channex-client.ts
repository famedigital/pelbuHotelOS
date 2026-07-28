/**
 * Channex HTTP client — only sends when CHANNEX_API_KEY is set.
 * Staging/live certification still requires mapping + Channex review.
 */

export type ChannexConfig = {
  apiKey: string;
  apiBase: string;
};

export function getChannexConfig(): ChannexConfig | null {
  const apiKey =
    process.env.CHANNEX_API_KEY?.trim() ||
    process.env.CHANNEXT_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    apiBase: (
      process.env.CHANNEX_API_BASE?.trim() ||
      process.env.CHANNEXT_API_BASE?.trim() ||
      "https://channex.io/api/v1"
    ).replace(/\/$/, ""),
  };
}

export async function channexFetch(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const cfg = getChannexConfig();
  if (!cfg) {
    return { ok: false, status: 0, body: { error: "CHANNEXT_API_KEY not set" } };
  }

  const url = path.startsWith("http") ? path : `${cfg.apiBase}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "user-api-key": cfg.apiKey,
      ...(init.headers ?? {}),
    },
  });

  let body: unknown = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

/** Push one availability batch — shape matches Channex Update Availability. */
export async function pushAvailabilityBatch(
  values: {
    property_id: string;
    room_type_id: string;
    date: string;
    availability: number;
  }[],
): Promise<{ ok: boolean; status: number; body: unknown }> {
  return channexFetch("/availability", {
    method: "POST",
    body: JSON.stringify({ values }),
  });
}

/** Booking revision feed (unacked). */
export async function pullBookingRevisionFeed(): Promise<{
  ok: boolean;
  status: number;
  body: unknown;
}> {
  return channexFetch("/booking_revisions/feed", { method: "GET" });
}

export async function ackBookingRevision(
  revisionId: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  return channexFetch(`/booking_revisions/${revisionId}/ack`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
