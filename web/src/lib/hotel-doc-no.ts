/** Staff-facing numbers: PSFN-2026-00160 folio, PSBK-2026-00088 booking, PSBN-2026-00041 master bill. */

export type HotelDocKind = "FN" | "BK" | "BN";

export function hotelDocPrefix(name: string | null | undefined): string {
  const raw = (name ?? "").trim();
  if (/^pelbu\b/i.test(raw)) return "PS";
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const initials = words
      .slice(0, 2)
      .map((word) => word.replace(/[^A-Za-z0-9]/g, "").charAt(0))
      .join("");
    if (initials.length >= 2) return initials.toUpperCase();
  }
  const clean = (words[0] ?? "").replace(/[^A-Za-z0-9]/g, "");
  return clean || "Hotel";
}

export function formatHotelDocNo(
  prefix: string,
  kind: HotelDocKind,
  seq: number,
  year = new Date().getFullYear(),
): string {
  const clean = prefix.replace(/[^A-Za-z0-9]/g, "") || "Hotel";
  const n = String(Math.max(1, Math.trunc(seq))).padStart(5, "0");
  const y = String(Math.trunc(year));
  return `${clean}${kind}-${y}-${n}`;
}

/**
 * Room bill folio number. PS-2026-00160 is the booking code; the folio is
 * PSFN-2026-00160. A stored PSFN / PSBK / PSBN number is left as written.
 */
export function folioNoFromConfirmation(
  code: string | null | undefined,
): string | null {
  const t = (code ?? "").trim();
  if (!t) return null;
  if (/^[A-Za-z]{2,}(FN|BK|BN)-/i.test(t)) return t.toUpperCase();
  const match = t.match(/^([A-Za-z]{2,})-(\d{4})-(\d+)$/);
  if (!match) return t;
  return `${match[1].toUpperCase()}FN-${match[2]}-${match[3]}`;
}

/** PS-, INV-, RCP-, CN-, and HotelFN / HotelBK / HotelBN. */
export function looksLikeHotelDocQuery(q: string): boolean {
  const t = q.trim().toUpperCase().replace(/\s+/g, "");
  if (!t) return false;
  if (
    t.startsWith("PS-") ||
    t.startsWith("INV-") ||
    t.startsWith("RCP-") ||
    t.startsWith("CN-")
  ) {
    return true;
  }
  if (/^PS\d{4}\d{1,6}$/.test(t)) return true;
  if (/^[A-Z]{2,}(FN|BK|BN)-\d{4}-\d+$/.test(t)) return true;
  return /^[A-Z]{2,}(FN|BK|BN)\d+$/.test(t);
}
