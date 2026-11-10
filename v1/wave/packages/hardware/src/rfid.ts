/**
 * RFID keycard encoder bridge.
 * Prefer WebUSB when the vendor exposes it; otherwise TCP proxy via apps/api.
 */

export interface KeycardEncodeRequest {
  roomNumber: string;
  checkInIso: string;
  checkOutIso: string;
  guestName: string;
}

export async function encodeKeycardViaApi(
  apiBaseUrl: string,
  token: string,
  body: KeycardEncodeRequest,
): Promise<{ ok: true; encoderId: string } | { ok: false; error: string }> {
  const res = await fetch(`${apiBaseUrl}/v1/hardware/keycard`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { ok: false, error: await res.text() };
  }
  return (await res.json()) as { ok: true; encoderId: string };
}
