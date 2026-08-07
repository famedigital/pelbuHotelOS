/**
 * Desk bill process: Master (all) · Room · F&B.
 * Round figures: whole Nu ending in 0 or 5 (see roundGuestWholeBtn).
 */

import { isGuestRateAdjDescription } from "@/lib/pricing";

export type BillKind = "master" | "room" | "fnb";

export type BillLineGroup = "room" | "fnb" | "hotel_adj" | "other";

export const BILL_KIND_LABELS: Record<BillKind, string> = {
  master: "Master bill",
  room: "Room bill",
  fnb: "F&B bill",
};

export const BILL_KIND_TITLES: Record<BillKind, string> = {
  master: "MASTER BILL",
  room: "ROOM BILL",
  fnb: "F&B BILL",
};

export function parseBillKind(
  value: string | null | undefined,
): BillKind {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "room" || v === "fnb" || v === "master") return v;
  return "master";
}

export function classifyBillLine(line: {
  source_type: string;
  description?: string | null;
}): BillLineGroup {
  if (isGuestRateAdjDescription(line.description)) return "hotel_adj";
  const st = (line.source_type ?? "").toLowerCase();
  if (["room", "meal_plan", "extra_bed"].includes(st)) return "room";
  if (["order", "pos", "laundry"].includes(st)) return "fnb";
  if (st === "comp" || st === "adjustment") return "hotel_adj";
  return "other";
}

/** Room / F&B only views hide hotel absorb lines and the other stream. */
export function lineBelongsOnBill(
  line: { source_type: string; description?: string | null },
  bill: BillKind,
): boolean {
  const group = classifyBillLine(line);
  if (bill === "master") return true;
  if (bill === "room") {
    return group === "room" || isStreamAdj(line.description, "room");
  }
  if (bill === "fnb") {
    return group === "fnb" || isStreamAdj(line.description, "fnb");
  }
  return true;
}

export function isStreamAdj(
  description: string | null | undefined,
  stream: "room" | "fnb" | "master",
): boolean {
  if (!isGuestRateAdjDescription(description)) return false;
  const d = (description ?? "").toLowerCase();
  if (stream === "room") return d.includes("room bill");
  if (stream === "fnb") return d.includes("f&b") || d.includes("fnb");
  return !d.includes("room bill") && !d.includes("f&b") && !d.includes("fnb");
}

export function guestRateAdjDescriptionForStream(
  stream: "room" | "fnb" | "master",
): string {
  if (stream === "room") {
    return "Adj · hotel absorbs · room bill (round to Nu 0 or 5)";
  }
  if (stream === "fnb") {
    return "Adj · hotel absorbs · F&B bill (round to Nu 0 or 5)";
  }
  return "Adj · hotel absorbs (round to Nu 0 or 5)";
}
