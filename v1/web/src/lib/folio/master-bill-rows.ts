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
  /** Room category, when the stay has one. */
  roomType?: string | null;
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

function mealCode(code: string | null | undefined): string | null {
  const plan = (code ?? "").trim().toUpperCase();
  if (!plan || plan === "EP" || plan === "RO" || plan === "EPAI") return null;
  return plan;
}

/** Category, meal code, and room number. Extras stay out of this label. */
function packageDescription(folio: MasterBillFolioInput): string {
  const category = folio.roomType?.trim() || "Room";
  const room = folio.room.trim();
  const plan = mealCode(folio.mealPlanCode);
  const foodInside =
    Boolean(plan) &&
    folio.lines.some((line) => (line.source_type ?? "").toLowerCase() === "meal_plan");
  if (room && foodInside && plan) return `${category} ${plan}-${room}`;
  if (room) return `${category}-${room}`.replace(/\s+-/g, "-");
  return category;
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
  const mealAmount = roundBtn(
    folio.lines
      .filter((line) => (line.source_type ?? "").toLowerCase() === "meal_plan")
      .reduce((sum, line) => sum + Number(line.total_btn || 0), 0),
  );
  const roomAmount = roundBtn(
    roomLines.reduce((sum, line) => sum + Number(line.total_btn || 0), 0) + mealAmount,
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
    const roomNight =
      totals.length === 1 && nights > 1 && roomCount === 1
        ? roundBtn(totals[0] / nights)
        : totals[0];
    const mealPerNight = roundBtn(mealAmount / (nights * roomCount));
    rate = roundBtn(roomNight + mealPerNight);
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
        description: packageDescription(folio),
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
