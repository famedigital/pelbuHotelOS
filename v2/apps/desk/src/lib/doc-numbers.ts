/**
 * Hotel document numbers:
 *   Folio   → {HOTEL_INITIAL}FN{serial}   e.g. DHFN00042
 *   Invoice → {HOTEL_INITIAL}INV{serial}  e.g. DHINV00042
 * Agent city-ledger fiscal stays PSBN-style via kind flag when needed.
 */
import { useSettingsStore } from "./settings-store";

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

export function resolveHotelInitial(): string {
  const s = useSettingsStore.getState();
  const custom = s.hotelInitial?.trim();
  if (custom && custom.length >= 2) return custom.toUpperCase().slice(0, 4);
  return hotelInitialFromName(s.hotelName);
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
