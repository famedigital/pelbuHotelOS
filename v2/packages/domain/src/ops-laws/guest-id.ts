/** Check-in document gate — passport / CID must be captured (not Pending). */

export function assertGuestIdDocument(
  passportOrCid: string | null | undefined,
): { ok: true; documentRef: string } | { ok: false; error: "GUEST_ID_REQUIRED" } {
  const raw = (passportOrCid ?? "").trim();
  if (!raw || /^pending$/i.test(raw) || raw.length < 4) {
    return { ok: false, error: "GUEST_ID_REQUIRED" };
  }
  return { ok: true, documentRef: raw };
}
