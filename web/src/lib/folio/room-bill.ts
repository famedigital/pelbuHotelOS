import { roundBtn } from "@/lib/pricing";

export type RoomBillLineInput = {
  roomTypeName: string;
  roomNumbers: string[];
  rooms: number;
  /** double | single when the voucher sells occupancy, not only the room type. */
  occupancy?: string | null;
  /** Agreed or sheet nightly rate for this room category. */
  nightlyRateBtn: number | null;
  /** Posted all-in total for these rooms, when the folio already has nights. */
  postedAmountBtn?: number | null;
};

export type RoomBillInput = {
  checkIn: string;
  checkOut: string;
  mealPlanCode?: string | null;
  /** When nights use different plans, the bill lists each night. */
  nightMeals?: Array<{ date: string; mealPlanCode: string }> | null;
  adults?: number | null;
  children?: number | null;
  nationalities?: Array<string | null | undefined> | null;
  guideNumber?: string | null;
  /** room keeps type, door, and meal. full also prints pax, nationality, and guide. */
  descriptionScope?: "full" | "room";
  lines: RoomBillLineInput[];
};

export type RoomBillRow = {
  description: string;
  checkInLabel: string;
  checkOutLabel: string;
  rooms: number;
  nights: number;
  rate: number | null;
  amount: number | null;
};

export function stayNights(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${checkOut.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 1;
  return Math.round((b - a) / 86_400_000);
}

/** 22 Oct 2026 */
export function formatRoomBillDate(iso: string): string {
  const raw = iso.slice(0, 10);
  const d = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return raw || "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** One code when every night matches. Otherwise "22 Oct MAP · 23 Oct CP". */
export function mealPlanBillLabel(
  fallback: string | null | undefined,
  nightMeals?: Array<{ date: string; mealPlanCode: string }> | null,
): string {
  const nights = (nightMeals ?? [])
    .map((night) => ({
      date: night.date.slice(0, 10),
      code: night.mealPlanCode.trim().toUpperCase(),
    }))
    .filter((night) => night.date && night.code)
    .sort((a, b) => a.date.localeCompare(b.date));
  const codes = [...new Set(nights.map((night) => night.code))];
  if (codes.length === 0) return (fallback ?? "").trim().toUpperCase();
  if (codes.length === 1) return codes[0] ?? "";
  return nights
    .map((night) => `${formatRoomBillDate(night.date).replace(/ \d{4}$/, "")} ${night.code}`)
    .join(" · ");
}

export function stayNightDates(checkIn: string, checkOut: string): string[] {
  const nights = stayNights(checkIn, checkOut);
  const start = Date.parse(`${checkIn.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start)) return [];
  return Array.from({ length: nights }, (_, index) => {
    const day = new Date(start + index * 86_400_000);
    return day.toISOString().slice(0, 10);
  });
}

export function roomBillDescription(input: {
  roomTypeName: string;
  roomNumbers: string[];
  occupancy?: string | null;
  mealPlanCode?: string | null;
  nightMeals?: Array<{ date: string; mealPlanCode: string }> | null;
  pax: number;
  nationalities?: Array<string | null | undefined> | null;
  guideNumber?: string | null;
  scope?: "full" | "room";
}): string {
  const rooms = input.roomNumbers.map((n) => n.trim()).filter(Boolean);
  const nations = [
    ...new Set(
      (input.nationalities ?? [])
        .map((n) => (n ?? "").trim())
        .filter((n) => n.length > 0 && n.toLowerCase() !== "deferred"),
    ),
  ];
  const meal = mealPlanBillLabel(input.mealPlanCode, input.nightMeals);
  const guide = (input.guideNumber ?? "").trim();
  const occupancy =
    input.occupancy === "double"
      ? "Double"
      : input.occupancy === "single"
        ? "Single"
        : null;
  const typeName = input.roomTypeName.trim() || "Room";
  const roomOnly = input.scope === "room";
  const parts = [
    occupancy && occupancy.toLowerCase() !== typeName.toLowerCase()
      ? occupancy
      : null,
    typeName,
    rooms.length ? `Rm ${rooms.join(", ")}` : null,
    meal || null,
    !roomOnly && input.pax > 0 ? `${input.pax} pax` : null,
    !roomOnly && nations.length ? nations.join(", ") : null,
    !roomOnly && guide ? `Guide ${guide}` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join(" · ");
}

export function buildRoomBillRows(input: RoomBillInput): RoomBillRow[] {
  const nights = stayNights(input.checkIn, input.checkOut);
  const checkInLabel = formatRoomBillDate(input.checkIn);
  const checkOutLabel = formatRoomBillDate(input.checkOut);
  const pax =
    Math.max(0, Number(input.adults ?? 0)) +
    Math.max(0, Number(input.children ?? 0));
  const source =
    input.lines.length > 0
      ? input.lines
      : [
          {
            roomTypeName: "Room",
            roomNumbers: [],
            rooms: 1,
            nightlyRateBtn: null,
          },
        ];

  return source.map((line) => {
    const rooms = Math.max(1, Number(line.rooms) || 1);
    const posted =
      line.postedAmountBtn != null && Number.isFinite(line.postedAmountBtn)
        ? roundBtn(line.postedAmountBtn)
        : null;
    const nightly =
      line.nightlyRateBtn != null && Number.isFinite(line.nightlyRateBtn)
        ? roundBtn(line.nightlyRateBtn)
        : null;
    let rate = nightly;
    let amount: number | null = null;
    if (posted != null && posted !== 0) {
      amount = posted;
      if (rate == null && rooms * nights > 0) {
        rate = roundBtn(posted / (rooms * nights));
      }
    } else if (rate != null) {
      amount = roundBtn(rate * rooms * nights);
    }
    return {
      description: roomBillDescription({
        roomTypeName: line.roomTypeName,
        roomNumbers: line.roomNumbers,
        occupancy: line.occupancy,
        mealPlanCode: input.mealPlanCode,
        nightMeals: input.nightMeals,
        pax,
        nationalities: input.nationalities,
        guideNumber: input.guideNumber,
        scope: input.descriptionScope,
      }),
      checkInLabel,
      checkOutLabel,
      rooms,
      nights,
      rate,
      amount,
    };
  });
}

export function roomBillTotal(rows: RoomBillRow[]): number {
  return roundBtn(
    rows.reduce((sum, row) => sum + (row.amount != null ? row.amount : 0), 0),
  );
}
