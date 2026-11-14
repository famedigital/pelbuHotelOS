/**
 * Hotel document numbers:
 *   Folio   → {HOTEL_INITIAL}FN{serial}   e.g. DHFN00042 / PSFN00042
 *   Invoice → {HOTEL_INITIAL}INV{serial}  e.g. DHINV00042 / PSINV00042
 * Agent city-ledger fiscal stays PSBN-style via kind flag when needed.
 */
import { useSettingsStore } from "./settings-store";

const DOC_KIND_TAIL = /^(FN|INV|PSBN|RCP)\d+$/i;

/** Letters from hotel name → 2–4 char INITIAL (Demo Hotel → DH). */
export function hotelInitialFromName(hotelName: string): string {
  const words = hotelName
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ""))
    .filter(Boolean);
  if (words.length === 0) return "HT";
  if (words.length === 1) {
    return words[0]!.slice(0, 3).toUpperCase().padEnd(2, "X");
  }
  return words
    .slice(0, 4)
    .map((w) => w[0]!)
    .join("")
    .toUpperCase();
}

/**
 * Property-aware initial. Pelbu Suites must stay **PS** (not PSO from
 * “Pelbu Suites Olakha” first-letter derivation).
 */
export function canonicalHotelInitial(hotelName: string): string {
  const n = hotelName.trim().toLowerCase();
  if (n.includes("pelbu")) return "PS";
  return hotelInitialFromName(hotelName);
}

/** Rewrite DHFN00121 → PSFN00121 (same kind + serial, new hotel initial). */
export function rewriteDocHotelInitial(
  docNo: string,
  fromInitial: string,
  toInitial: string,
): string {
  const from = fromInitial.trim().toUpperCase();
  const to = toInitial.trim().toUpperCase().slice(0, 4);
  if (!from || !to || from === to) return docNo;
  const raw = docNo.trim();
  if (!raw.toUpperCase().startsWith(from)) return docNo;
  const tail = raw.slice(from.length);
  if (!DOC_KIND_TAIL.test(tail)) return docNo;
  return `${to}${tail.toUpperCase()}`;
}

export function resolveHotelInitial(): string {
  const s = useSettingsStore.getState();
  const custom = s.hotelInitial?.trim();
  if (custom && custom.length >= 2) return custom.toUpperCase().slice(0, 4);
  return canonicalHotelInitial(s.hotelName);
}

/**
 * Display/print helper: if a leftover Demo prefix (DH…) is shown on a
 * Pelbu (PS) desk, rewrite kind+serial onto the live hotel initial.
 */
export function displayHotelDocNo(docNo: string | null | undefined): string {
  if (!docNo?.trim()) return "";
  const target = resolveHotelInitial();
  const raw = docNo.trim();
  const m = raw.match(/^([A-Za-z]{2,4})(FN|INV|PSBN|RCP)(\d+)$/i);
  if (!m) return raw;
  const from = m[1]!.toUpperCase();
  if (from === target) return `${target}${m[2]!.toUpperCase()}${m[3]}`;
  if (from === "DH" && target !== "DH") {
    return rewriteDocHotelInitial(raw, "DH", target);
  }
  return raw;
}

export function formatFolioNo(serial: number, initial = resolveHotelInitial()): string {
  return `${initial}FN${String(Math.max(1, Math.floor(serial))).padStart(5, "0")}`;
}

export function formatInvoiceNo(serial: number, initial = resolveHotelInitial()): string {
  return `${initial}INV${String(Math.max(1, Math.floor(serial))).padStart(5, "0")}`;
}

/** Agent city ledger fiscal (still gapless, hotel-prefixed). */
export function formatPsbnNo(serial: number, initial = resolveHotelInitial()): string {
  return `${initial}PSBN${String(Math.max(1, Math.floor(serial))).padStart(5, "0")}`;
}

let folioSeq = 120;
let invSeq = 880;
let psbnSeq = 1042;
let rcpSeq = 2400;

export function formatReceiptNo(serial: number, initial = resolveHotelInitial()): string {
  return `${initial}RCP${String(Math.max(1, Math.floor(serial))).padStart(5, "0")}`;
}

export function peekNextReceiptNo(): string {
  return formatReceiptNo(rcpSeq + 1);
}

export function allocateReceiptNo(): string {
  rcpSeq += 1;
  return formatReceiptNo(rcpSeq);
}

export function peekNextFolioNo(): string {
  return formatFolioNo(folioSeq + 1);
}

export function allocateFolioNo(): string {
  folioSeq += 1;
  return formatFolioNo(folioSeq);
}

export function peekNextInvoiceNo(): string {
  return formatInvoiceNo(invSeq + 1);
}

export function allocateInvoiceNo(): string {
  invSeq += 1;
  return formatInvoiceNo(invSeq);
}

export function peekNextPsbnNo(): string {
  return formatPsbnNo(psbnSeq + 1);
}

export function allocatePsbnNo(): string {
  psbnSeq += 1;
  return formatPsbnNo(psbnSeq);
}
