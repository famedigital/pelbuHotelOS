/**
 * Document numbering helpers — COPY adapted for v2 series:
 * PS- confirmation, PSBN-YYYY-NNNNN stay/folio fiscal, INV-YYYY-NNNN F&B.
 * Gapless sequences are owned by DB (`property_sequences`); this formats only.
 */

export type FiscalDocKind = "PSBN" | "INV" | "PS";

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
  return clean || "PS";
}

/** Booking confirmation: PS-YYYY-NNNNN (not a fiscal invoice). */
export function formatConfirmationNo(
  prefix: string,
  seq: number,
  year = new Date().getFullYear(),
): string {
  const clean = prefix.replace(/[^A-Za-z0-9]/g, "") || "PS";
  const n = String(Math.max(1, Math.trunc(seq))).padStart(5, "0");
  return `${clean}-${year}-${n}`;
}

/** Stay/agency fiscal: PSBN-YYYY-NNNNN */
export function formatPsbn(seq: number, year = new Date().getFullYear()): string {
  const n = String(Math.max(1, Math.trunc(seq))).padStart(5, "0");
  return `PSBN-${year}-${n}`;
}

/** F&B fiscal: INV-YYYY-NNNN */
export function formatInv(seq: number, year = new Date().getFullYear()): string {
  const n = String(Math.max(1, Math.trunc(seq))).padStart(4, "0");
  return `INV-${year}-${n}`;
}

export function looksLikeFiscalQuery(q: string): boolean {
  const t = q.trim().toUpperCase().replace(/\s+/g, "");
  if (!t) return false;
  return (
    t.startsWith("PS-") ||
    t.startsWith("PSBN-") ||
    t.startsWith("INV-") ||
    /^[A-Z]{2,}-\d{4}-\d+$/.test(t)
  );
}
