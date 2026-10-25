import { formatRoomBillDate, stayNights } from "@/lib/folio/room-bill";
import { roundBtn } from "@/lib/pricing";

export type FolioChargeInput = {
  id: string;
  description?: string | null;
  source_type?: string | null;
  total_btn: number;
  unit_price_btn?: number | null;
  amount_btn?: number | null;
  service_charge_btn?: number | null;
  gst_btn?: number | null;
  qty?: number | null;
  business_date?: string | null;
};

export type FolioChargeRow = {
  id: string;
  particulars: string;
  room: string;
  arrival: string;
  departure: string;
  nights: number | null;
  /** Food and extras. Room nights stay in `nights`. */
  qty: number | null;
  rate: number | null;
  amount: number;
};

function addDay(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function roomNo(description: string): string {
  const match = description.match(/\bRoom\s+(\d+[A-Za-z0-9-]*)/i);
  return match?.[1] ?? "";
}

function mealWords(text: string): string {
  return text
    .replace(/\bMAPAI\b/gi, "Breakfast and dinner")
    .replace(/\bCPAI\b/gi, "Breakfast")
    .replace(/\bEPAI\b/gi, "Room only")
    .replace(/\bAPAI\b/gi, "Full board")
    .replace(/\bMAP\b/gi, "Breakfast and dinner")
    .replace(/\bBB\b/g, "Breakfast")
    .replace(/\bCP\b/gi, "Breakfast")
    .replace(/\bEP\b/gi, "Room only")
    .replace(/\bAP\b/gi, "Full board");
}

function particularsOf(source: string, description: string): string {
  if (/extra\s*mattress/i.test(description)) return "Extra mattress";
  if (source === "extra_bed" || /extra\s*bed/i.test(description)) return "Extra bed";
  if (source === "laundry") {
    const detail = description.replace(/^Laundry\s*·\s*/i, "").trim();
    return detail || "Laundry";
  }
  if (source === "service") return description.trim() || "Service";
  if (source === "order" || source === "pos" || source === "meal_plan" || source === "guest_service") {
    const food = description
      .replace(/\s*·\s*guest pays later, not the agent\s*/gi, "")
      .replace(/\s*·\s*agent tab\s*/gi, "")
      .replace(/^Desk\s+[^:]+:\s*/i, "")
      .replace(/\s*·\s*public card\s*/gi, "")
      .trim();
    return food || "Food";
  }
  let text = description
    .replace(/^Room\s+\d+[A-Za-z0-9-]*\s*·\s*/i, "")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "")
    .replace(/public card/gi, "")
    .replace(/[·\-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  text = mealWords(text);
  return text || "Room";
}

function pushGroup(
  groups: FolioChargeRow[],
  line: FolioChargeInput,
  room: string,
  particulars: string,
  night: string | null,
  stayNight: boolean,
) {
  const amount = roundBtn(Number(line.total_btn) || 0);
  const qty = Math.max(1, Number(line.qty) || 1);
  const rate = stayNight
    ? roundBtn(amount / qty)
    : line.unit_price_btn != null && Number(line.unit_price_btn) > 0
      ? roundBtn(Number(line.unit_price_btn))
      : roundBtn(amount / qty);
  const last = groups.at(-1);
  if (
    stayNight &&
    night &&
    last &&
    last.room === (room || "—") &&
    last.particulars === particulars &&
    last.rate != null &&
    Math.abs((last.rate ?? 0) - rate) < 0.5 &&
    last.departure === formatRoomBillDate(night)
  ) {
    last.nights = (last.nights ?? 0) + qty;
    last.departure = formatRoomBillDate(addDay(night));
    last.amount = roundBtn(last.amount + amount);
    return;
  }
  groups.push({
    id: line.id,
    particulars,
    room: room || "—",
    arrival: night ? formatRoomBillDate(night) : "—",
    departure: stayNight && night ? formatRoomBillDate(addDay(night)) : "—",
    nights: stayNight ? qty : null,
    qty: stayNight ? null : qty,
    rate,
    amount,
  });
}

function lineNight(line: FolioChargeInput): string | null {
  const raw = line.business_date?.slice(0, 10) ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = (line.description ?? "").match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return match?.[1] ?? null;
}

/** One list for room, food, and extra bed. Room rows carry nights and rate. Food rows carry qty and rate. */
export function buildFolioChargeRows(
  lines: FolioChargeInput[],
  stay?: { checkIn?: string | null; checkOut?: string | null },
): FolioChargeRow[] {
  const ordered = [...lines].sort((a, b) => {
    const aDay = lineNight(a) ?? "";
    const bDay = lineNight(b) ?? "";
    if (aDay !== bDay) return aDay.localeCompare(bDay);
    return a.id.localeCompare(b.id);
  });
  const rows: FolioChargeRow[] = [];
  for (const line of ordered) {
    const description = (line.description ?? "").trim();
    const source = (line.source_type ?? "").toLowerCase();
    const night = lineNight(line);
    const mattress = /extra\s*mattress/i.test(description);
    const stayNight =
      !mattress &&
      (source === "room" ||
        source === "extra_bed" ||
        /^room\s+\d+/i.test(description));
    pushGroup(
      rows,
      line,
      roomNo(description),
      particularsOf(source, description),
      night,
      stayNight,
    );
  }
  const checkIn = stay?.checkIn?.slice(0, 10) ?? "";
  const checkOut = stay?.checkOut?.slice(0, 10) ?? "";
  const stayLength =
    checkIn && checkOut ? stayNights(checkIn, checkOut) : null;
  const undated = rows.filter((row) => row.nights != null && row.arrival === "—");
  if (stayLength != null && stayLength > 1 && undated.length === 1) {
    const row = undated[0]!;
    row.nights = stayLength;
    row.arrival = formatRoomBillDate(checkIn);
    row.departure = formatRoomBillDate(checkOut);
    row.rate = roundBtn(row.amount / stayLength);
  }
  return rows;
}
