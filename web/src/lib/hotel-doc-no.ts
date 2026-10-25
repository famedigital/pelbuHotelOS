/** Staff-facing numbers: PSFN folio, PSRM room folio, PSFF food folio, PSBK booking, PSBN master bill. */

export type HotelDocKind = "FN" | "BK" | "BN";

export type PaperDocKind = "room" | "fnb" | "master";

const PAPER_KIND: Record<PaperDocKind, "RM" | "FF" | "BN"> = {
  room: "RM",
  fnb: "FF",
  master: "BN",
};

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
 * Printed number for one paper. Same serial as the folio.
 * PSFN-2026-00006 → PSRM room, PSFF food, PSBN master bill.
 */
export function paperDocNo(
  folioNo: string | null | undefined,
  paper: PaperDocKind,
): string {
  const t = (folioNo ?? "").trim();
  if (!t || t === "—") return t || "—";
  const kind = PAPER_KIND[paper];
  if (/[A-Za-z]{2,}(FN|RM|FF|BN)-\d{4}-\d+$/i.test(t)) {
    return t.replace(/(FN|RM|FF|BN)(?=-\d{4}-)/i, kind).toUpperCase();
  }
  return t;
}

/** PDF name: the paper’s number, the agent, then the group or the guest. */
export function folioPrintFileName(input: {
  pack?: boolean;
  bill: PaperDocKind;
  folioNo: string;
  agentName?: string | null;
  guestName?: string | null;
  groupName?: string | null;
}): string {
  const paper: PaperDocKind = input.pack || input.bill === "master" ? "master" : input.bill;
  const party = (input.groupName ?? "").trim() || (input.guestName ?? "").trim();
  const raw = [paperDocNo(input.folioNo, paper), (input.agentName ?? "").trim(), party]
    .filter(Boolean)
    .join(" ");
  return raw.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
}

/**
 * Room bill folio number. PS-2026-00160 is the booking code; the folio is
 * PSFN-2026-00160. A stored PSFN / PSBK / PSBN / PSRM / PSFF number is left as written.
 */
export function folioNoFromConfirmation(
  code: string | null | undefined,
): string | null {
  const t = (code ?? "").trim();
  if (!t) return null;
  if (/^[A-Za-z]{2,}(FN|BK|BN|RM|FF)-/i.test(t)) return t.toUpperCase();
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
  if (/^[A-Z]{2,}(FN|BK|BN|RM|FF)-\d{4}-\d+$/.test(t)) return true;
  return /^[A-Z]{2,}(FN|BK|BN|RM|FF)\d+$/.test(t);
}
