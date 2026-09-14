/** Shared stay-date helpers for hero search and the /book wizard. */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysIso(iso: string, days: number): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00`).getTime();
  const b = new Date(`${checkOut}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime());
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export type StaySearchParams = {
  checkIn: string;
  checkOut: string;
  adults: number;
  rooms: number;
};

export type StaySearchInput = {
  checkIn?: string | null;
  checkOut?: string | null;
  adults?: string | number | null;
  rooms?: string | number | null;
};

/**
 * Normalize hero / URL stay params into a safe wizard starting state.
 * Invalid or past dates fall back to today → tomorrow.
 */
export function parseStaySearch(input: StaySearchInput = {}): StaySearchParams {
  const minCheckIn = todayIso();
  let checkIn =
    typeof input.checkIn === "string" && isIsoDate(input.checkIn)
      ? input.checkIn
      : minCheckIn;
  if (checkIn < minCheckIn) checkIn = minCheckIn;

  let checkOut =
    typeof input.checkOut === "string" && isIsoDate(input.checkOut)
      ? input.checkOut
      : addDaysIso(checkIn, 1);
  if (checkOut <= checkIn) checkOut = addDaysIso(checkIn, 1);

  return {
    checkIn,
    checkOut,
    adults: clampInt(input.adults, 1, 12, 2),
    rooms: clampInt(input.rooms, 1, 6, 1),
  };
}

export function staySearchQuery(stay: StaySearchParams): string {
  const params = new URLSearchParams({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    adults: String(stay.adults),
    rooms: String(stay.rooms),
  });
  return params.toString();
}
