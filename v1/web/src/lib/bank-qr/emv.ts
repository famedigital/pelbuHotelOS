/**
 * Bhutan bank QR (EMV merchant-presented). A static code has no amount.
 * Tag 01 = 12 and tag 54 = the Nu amount make mBoB fill the payment.
 * Currency 064 is BTN.
 */

function tlv(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

export function parseEmv(payload: string): Map<string, string> {
  const map = new Map<string, string>();
  const raw = payload.replace(/[\n\r\t]/g, "").trim();
  let i = 0;
  while (i + 4 <= raw.length) {
    const tag = raw.slice(i, i + 2);
    const len = Number(raw.slice(i + 2, i + 4));
    if (!Number.isFinite(len) || len < 0) break;
    const value = raw.slice(i + 4, i + 4 + len);
    if (tag !== "63") map.set(tag, value);
    i += 4 + len;
  }
  return map;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF). */
export function crc16ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function serializeInner(map: Map<string, string>): string {
  const tags = [...map.keys()].filter((tag) => tag !== "63").sort();
  let body = "";
  for (const tag of tags) {
    body += tlv(tag, map.get(tag) ?? "");
  }
  return body;
}

function serialize(map: Map<string, string>): string {
  const withLen = `${serializeInner(map)}6304`;
  return `${withLen}${crc16ccitt(withLen)}`;
}

function mergeAdditionalData(existing: string, remarks?: string): string {
  const inner = parseEmv(existing);
  const note = remarks?.trim().slice(0, 25);
  if (note) inner.set("05", note);
  else inner.delete("05");
  return serializeInner(inner);
}

const CURRENCY = "064";

/** Strip any amount so the saved code can be stamped per bill. */
export function toStaticEmv(payload: string): string {
  const raw = payload.replace(/[\n\r\t]/g, "").trim();
  if (!raw.startsWith("000201")) return "";
  const map = parseEmv(raw);
  if (map.get("00") !== "01") return "";
  map.set("01", "11");
  map.delete("54");
  const extra = map.get("62");
  if (extra) {
    const kept = mergeAdditionalData(extra);
    if (kept) map.set("62", kept);
    else map.delete("62");
  }
  if (!map.get("53")) map.set("53", CURRENCY);
  return serialize(map);
}

/** Amount in Nu, two decimals. Remarks land in the bank app reference (25 chars). */
export function buildDynamicEmv(
  staticPayload: string,
  amountNu: number,
  remarks: string,
): string {
  if (!staticPayload.trim() || amountNu <= 0) return "";
  const map = parseEmv(staticPayload);
  if (map.get("00") !== "01") return "";
  map.set("01", "12");
  map.set("53", CURRENCY);
  map.set("54", amountNu.toFixed(2));
  map.set("62", mergeAdditionalData(map.get("62") || "", remarks));
  return serialize(map);
}
