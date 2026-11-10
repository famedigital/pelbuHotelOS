/**
 * Pelbu Suites Olakha rate-sheet inventory (canonical).
 * Source: docs/rate-agent.html + docs/rate-public.html
 * 27 sellable = Deluxe Queen/King/Twin (26) + Suite (1). Guide/driver beds are non-sellable.
 */
import type { Room, RoomTypeCode } from "./front-office-store";

export type RateSheetType = {
  code: RoomTypeCode;
  name: string;
  /** EP room net (excl. 10% S.C.) — public peak double band / 1.1, rounded. */
  nightlyNet: number;
  sellable: boolean;
  /** Expected physical count on the flagship rate sheet. */
  inventoryHint: number;
};

/** Live DB codes used by pelbu-olakha after cutover. */
export const RATE_SHEET_TYPES: RateSheetType[] = [
  { code: "deluxe_queen", name: "Deluxe Queen", nightlyNet: 5900, sellable: true, inventoryHint: 2 },
  { code: "deluxe_king", name: "Deluxe King", nightlyNet: 5900, sellable: true, inventoryHint: 2 },
  { code: "deluxe_twin", name: "Deluxe Twin", nightlyNet: 5900, sellable: true, inventoryHint: 22 },
  { code: "suite", name: "Pelbu Suite", nightlyNet: 14350, sellable: true, inventoryHint: 1 },
];

/** Legacy / Innora aliases → rate-sheet codes. */
const TYPE_ALIASES: Record<string, RoomTypeCode> = {
  "DLX-K": "deluxe_king",
  "DLX-T": "deluxe_twin",
  "VAL-K": "deluxe_king",
  "VAL-T": "deluxe_twin",
  "EXE-K": "suite",
  "EXE-T": "suite",
  dq: "deluxe_king",
  dt: "deluxe_twin",
  sr: "suite",
  "d&g": "driver_guide",
  d_g: "driver_guide",
  driver_guide: "driver_guide",
  "King Room": "deluxe_king",
  "Deluxe Twin": "deluxe_twin",
  "Suite Room": "suite",
  "Driver & Guide": "driver_guide",
  deluxe_queen: "deluxe_queen",
  deluxe_king: "deluxe_king",
  deluxe_twin: "deluxe_twin",
  suite: "suite",
};

export function normalizeRoomTypeCode(code: string | null | undefined): RoomTypeCode {
  const raw = String(code ?? "").trim();
  if (!raw) return "deluxe_twin";
  if (TYPE_ALIASES[raw]) return TYPE_ALIASES[raw];
  const lower = raw.toLowerCase().replace(/\s+/g, "_");
  if (TYPE_ALIASES[lower]) return TYPE_ALIASES[lower];
  if (lower.includes("suite")) return "suite";
  if (lower.includes("queen")) return "deluxe_queen";
  if (lower.includes("king")) return "deluxe_king";
  if (lower.includes("twin")) return "deluxe_twin";
  if (lower.includes("guide") || lower.includes("driver")) return "driver_guide";
  return raw as RoomTypeCode;
}

export function isSellableRoomType(code: string | null | undefined): boolean {
  const n = normalizeRoomTypeCode(code);
  return n !== "driver_guide" && !String(n).includes("guide");
}

export function rateSheetTypeMeta(code: string | null | undefined): RateSheetType {
  const n = normalizeRoomTypeCode(code);
  return (
    RATE_SHEET_TYPES.find((t) => t.code === n) ?? {
      code: n,
      name: n,
      nightlyNet: 5900,
      sellable: isSellableRoomType(n),
      inventoryHint: 0,
    }
  );
}

/** Fast Book / Rates picker: rate-sheet order, then any extra sellable codes from inventory. */
export function sellableTypeOptionsFromRooms(
  rooms: Room[],
): { code: RoomTypeCode; name: string; nightlyNet: number; freeCount: number; totalCount: number }[] {
  const byCode = new Map<
    string,
    { code: RoomTypeCode; name: string; nightlyNet: number; freeCount: number; totalCount: number }
  >();

  for (const sheet of RATE_SHEET_TYPES.filter((t) => t.sellable)) {
    byCode.set(sheet.code, {
      code: sheet.code,
      name: sheet.name,
      nightlyNet: sheet.nightlyNet,
      freeCount: 0,
      totalCount: 0,
    });
  }

  for (const room of rooms) {
    const code = normalizeRoomTypeCode(room.typeCode);
    if (!isSellableRoomType(code)) continue;
    const meta = rateSheetTypeMeta(code);
    const row = byCode.get(code) ?? {
      code,
      name: room.typeName || meta.name,
      nightlyNet: meta.nightlyNet,
      freeCount: 0,
      totalCount: 0,
    };
    row.totalCount += 1;
    if (room.hkStatus === "clean" || room.hkStatus === "inspected") {
      row.freeCount += 1;
    }
    if (!row.name || row.name === code) row.name = room.typeName || meta.name;
    byCode.set(code, row);
  }

  const ordered = RATE_SHEET_TYPES.filter((t) => t.sellable).map((t) => byCode.get(t.code)!);
  for (const [code, row] of byCode) {
    if (!RATE_SHEET_TYPES.some((t) => t.code === code)) ordered.push(row);
  }
  return ordered.filter((r) => r.totalCount > 0 || RATE_SHEET_TYPES.some((t) => t.code === r.code));
}
