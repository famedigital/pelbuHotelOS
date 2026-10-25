import { classifyBillLine } from "@/lib/folio/bill-kinds";
import { formatRoomBillDate, stayNights } from "@/lib/folio/room-bill";
import { roundBtn } from "@/lib/pricing";

export type MasterBillLine = {
  source_type?: string | null;
  description?: string | null;
  total_btn: number;
  qty?: number | null;
  unit_price_btn?: number | null;
};

/** One guest folio on the master bill. Line items stay on the folio pages. */
export type MasterBillFolioInput = {
  id: string;
  docNo: string | null;
  guest: string;
  room: string;
  arrival: string | null;
  departure: string | null;
  mealPlanCode?: string | null;
  lines: MasterBillLine[];
};

export type MasterBillRow = {
  id: string;
  folio: string;
  guest: string;
  room: string;
  stay: string;
  nights: number | null;
  /** Food quantity. Room nights stay in `nights`. */
  qty: number | null;
  /** Nightly room rate when the folio has room charges. */
  rate: number | null;
  description: string;
  amount: number;
};

function mealPhrase(code: string | null | undefined): string | null {
  const plan = (code ?? "").trim().toUpperCase();
  if (plan === "MAP" || plan === "MAPAI") return "Breakfast and dinner";
  if (plan === "CP" || plan === "BB" || plan === "CPAI") return "Breakfast";
  if (plan === "AP" || plan === "APAI") return "Breakfast, lunch and dinner";
  if (plan === "EP" || plan === "EPAI" || plan === "RO") return "Room only";
  return null;
}

function coverDescription(folio: MasterBillFolioInput): string {
  let room = false;
  let fnb = false;
  let laundry = false;
  let services = false;
  let other = false;
  for (const line of folio.lines) {
    const source = (line.source_type ?? "").toLowerCase();
    const group = classifyBillLine({
      source_type: source,
      description: line.description,
    });
    if (source === "laundry") laundry = true;
    else if (group === "services") services = true;
    else if (group === "room") room = true;
    else if (group === "fnb") fnb = true;
    else other = true;
  }
  const parts: string[] = [];
  if (room) parts.push("Room");
  const meal = mealPhrase(folio.mealPlanCode);
  if (fnb) parts.push(meal ?? "Meals");
  else if (meal && meal !== "Room only") parts.push(meal);
  if (laundry) parts.push("Laundry");
  if (services) parts.push("Services");
  if (other) parts.push("Other");
  return parts.join(", ") || "Folio";
}

function stayLabel(arrival: string | null, departure: string | null): string {
  if (!arrival && !departure) return "—";
  const from = arrival ? formatRoomBillDate(arrival) : "—";
  const to = departure ? formatRoomBillDate(departure) : "—";
  const nights =
    arrival && departure ? stayNights(arrival, departure) : null;
  const range = `${from} – ${to}`;
  return nights != null ? `${range} · ${nights} ${nights === 1 ? "night" : "nights"}` : range;
}

function isFood(line: MasterBillLine): boolean {
  const source = (line.source_type ?? "").toLowerCase();
  return classifyBillLine({ source_type: source, description: line.description }) === "fnb"
    && source !== "laundry";
}

function isRoom(line: MasterBillLine): boolean {
  const source = (line.source_type ?? "").toLowerCase();
  return (
    classifyBillLine({ source_type: source, description: line.description }) === "room" ||
    /^room\s+\d+/i.test(line.description ?? "")
  );
}

function folioFacts(folio: MasterBillFolioInput): {
  nights: number | null;
  qty: number | null;
  rate: number | null;
} {
  const nights =
    folio.arrival && folio.departure
      ? stayNights(folio.arrival, folio.departure)
      : null;
  const roomLines = folio.lines.filter(isRoom);
  const roomAmount = roundBtn(
    roomLines.reduce((sum, line) => sum + Number(line.total_btn || 0), 0),
  );
  const roomCount = Math.max(
    1,
    folio.room
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean).length,
  );
  const totals = roomLines.map((line) => roundBtn(Number(line.total_btn) || 0));
  const sameRate = totals.length > 0 && totals.every((total) => total === totals[0]);
  let rate: number | null = null;
  if (sameRate && nights) {
    rate =
      totals.length === 1 && nights > 1 && roomCount === 1
        ? roundBtn(totals[0] / nights)
        : totals[0];
  } else if (nights && roomAmount) {
    rate = roundBtn(roomAmount / (nights * roomCount));
  }
  const food = folio.lines.filter(isFood);
  const qty = food.length
    ? food.reduce((sum, line) => sum + Math.max(1, Number(line.qty) || 1), 0)
    : null;
  return { nights, qty, rate };
}

function roomKey(room: string): number {
  const match = room.match(/\d+/);
  return match ? Number(match[0]) : 9999;
}

/** One row per folio: number, who, room, stay, what it covers, and the amount. */
export function buildMasterBillRows(
  folios: MasterBillFolioInput[],
): MasterBillRow[] {
  return [...folios]
    .map((folio) => {
      const facts = folioFacts(folio);
      return {
        id: folio.id,
        folio: folio.docNo?.trim() || "—",
        guest: folio.guest.trim() || "Guest",
        room: folio.room.trim() || "—",
        stay: stayLabel(folio.arrival, folio.departure),
        nights: facts.nights,
        qty: facts.qty,
        rate: facts.rate,
        description: coverDescription(folio),
        amount: roundBtn(
          folio.lines.reduce((sum, line) => sum + Number(line.total_btn || 0), 0),
        ),
      };
    })
    .sort((a, b) => {
      const byRoom = roomKey(a.room) - roomKey(b.room);
      if (byRoom !== 0) return byRoom;
      return a.folio.localeCompare(b.folio);
    });
}
