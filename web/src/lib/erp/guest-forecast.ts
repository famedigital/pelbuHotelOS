import { thimphuDateOffset, thimphuToday } from "@/lib/erp-lists";
import { bookingCommitsInventory } from "@/lib/inventory-availability";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type GuestForecastDay = {
  date: string;
  /** Bookings arriving this day (held live / confirmed / checked-in). */
  arrivals: number;
  /** Bookings departing this day. */
  departures: number;
  /** Rooms occupied overnight (check_in ≤ date < check_out). */
  rooms: number;
  /** Guest heads (adults + children) overnight. */
  guests: number;
};

export type GuestForecastTotals = {
  arrivals: number;
  departures: number;
  peakRooms: number;
  peakGuests: number;
  avgRooms: number;
  avgGuests: number;
  /** Sum of occupied rooms across nights (room-nights). */
  roomNights: number;
  /** Sum of overnight guest heads across nights. */
  guestNights: number;
  /** totalRooms × nights in the period (0 if no inventory). */
  availableRoomNights: number;
  /** roomNights / availableRoomNights × 100 (0–100+ if overbooked). */
  occupancyPct: number;
};

/** One calendar month inside the rolling multi-month horizon. */
export type GuestForecastMonth = {
  monthYm: string;
  days: number;
  arrivals: number;
  departures: number;
  peakRooms: number;
  peakGuests: number;
  avgRooms: number;
  avgGuests: number;
  roomNights: number;
  guestNights: number;
  availableRoomNights: number;
  occupancyPct: number;
};

export type GuestForecast = {
  businessDate: string;
  /** Selected calendar month `YYYY-MM` for the monthly bar / totals. */
  monthYm: string;
  /** Physical room units on the property (capacity denominator). */
  totalRooms: number;
  weekly: GuestForecastDay[];
  monthly: GuestForecastDay[];
  /** Six calendar months starting at `monthYm`. */
  horizon: GuestForecastMonth[];
  weekTotals: GuestForecastTotals;
  monthTotals: GuestForecastTotals;
  horizonTotals: GuestForecastTotals;
};

/** `YYYY-MM` → previous/next calendar month. */
export function shiftMonthYm(ym: string, delta: number): string {
  const [y, m] = ym.slice(0, 7).split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Parse `YYYY-MM`; invalid input falls back to the current business month. */
export function parseForecastMonthYm(
  raw: string | null | undefined,
  businessDate = thimphuToday(),
): string {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return raw;
  return businessDate.slice(0, 7);
}

export function formatForecastMonthLabel(ym: string): string {
  const d = new Date(`${ym.slice(0, 7)}-01T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return ym;
  return d.toLocaleDateString("en-BT", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

type BookingRow = {
  check_in: string;
  check_out: string;
  status: string;
  hold_expires_at: string | null;
  adults: number | null;
  children: number | null;
  rooms: number | null;
};

function eachDate(start: string, endExclusive: string): string[] {
  const out: string[] = [];
  let cursor = start;
  // Up to ~7 months of nights (6 mo + week overlap buffer).
  for (let i = 0; i < 220 && cursor < endExclusive; i += 1) {
    out.push(cursor);
    cursor = thimphuDateOffset(cursor, 1);
  }
  return out;
}

function monthEndExclusive(iso: string): string {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  const next =
    m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return next;
}

function emptyTotals(): GuestForecastTotals {
  return {
    arrivals: 0,
    departures: 0,
    peakRooms: 0,
    peakGuests: 0,
    avgRooms: 0,
    avgGuests: 0,
    roomNights: 0,
    guestNights: 0,
    availableRoomNights: 0,
    occupancyPct: 0,
  };
}

function totals(
  days: GuestForecastDay[],
  totalRooms: number,
): GuestForecastTotals {
  if (days.length === 0) return emptyTotals();
  let arrivals = 0;
  let departures = 0;
  let peakRooms = 0;
  let peakGuests = 0;
  let roomNights = 0;
  let guestNights = 0;
  for (const d of days) {
    arrivals += d.arrivals;
    departures += d.departures;
    roomNights += d.rooms;
    guestNights += d.guests;
    peakRooms = Math.max(peakRooms, d.rooms);
    peakGuests = Math.max(peakGuests, d.guests);
  }
  const availableRoomNights = totalRooms > 0 ? totalRooms * days.length : 0;
  const occupancyPct =
    availableRoomNights > 0
      ? Math.round((roomNights / availableRoomNights) * 1000) / 10
      : 0;
  return {
    arrivals,
    departures,
    peakRooms,
    peakGuests,
    avgRooms: Math.round((roomNights / days.length) * 10) / 10,
    avgGuests: Math.round((guestNights / days.length) * 10) / 10,
    roomNights,
    guestNights,
    availableRoomNights,
    occupancyPct,
  };
}

function buildDays(
  dates: string[],
  bookings: BookingRow[],
  now: Date,
): GuestForecastDay[] {
  return dates.map((date) => {
    let arrivals = 0;
    let departures = 0;
    let rooms = 0;
    let guests = 0;
    for (const b of bookings) {
      if (!bookingCommitsInventory(b, now)) continue;
      const roomQty = Math.max(0, Number(b.rooms ?? 1));
      const heads =
        Math.max(0, Number(b.adults ?? 0)) +
        Math.max(0, Number(b.children ?? 0));
      const pax = heads > 0 ? heads : roomQty;
      if (b.check_in === date) arrivals += 1;
      if (b.check_out === date) departures += 1;
      if (b.check_in <= date && date < b.check_out) {
        rooms += roomQty;
        guests += pax;
      }
    }
    return { date, arrivals, departures, rooms, guests };
  });
}

function buildHorizonMonths(
  startYm: string,
  months: number,
  dayMap: Map<string, GuestForecastDay>,
  totalRooms: number,
): GuestForecastMonth[] {
  const out: GuestForecastMonth[] = [];
  for (let i = 0; i < months; i += 1) {
    const ym = shiftMonthYm(startYm, i);
    const start = `${ym}-01`;
    const end = monthEndExclusive(start);
    const days = eachDate(start, end);
    let arrivals = 0;
    let departures = 0;
    let peakRooms = 0;
    let peakGuests = 0;
    let roomNights = 0;
    let guestNights = 0;
    for (const date of days) {
      const d = dayMap.get(date) ?? {
        date,
        arrivals: 0,
        departures: 0,
        rooms: 0,
        guests: 0,
      };
      arrivals += d.arrivals;
      departures += d.departures;
      roomNights += d.rooms;
      guestNights += d.guests;
      peakRooms = Math.max(peakRooms, d.rooms);
      peakGuests = Math.max(peakGuests, d.guests);
    }
    const n = days.length;
    const availableRoomNights = totalRooms > 0 ? totalRooms * n : 0;
    const occupancyPct =
      availableRoomNights > 0
        ? Math.round((roomNights / availableRoomNights) * 1000) / 10
        : 0;
    out.push({
      monthYm: ym,
      days: n,
      arrivals,
      departures,
      peakRooms,
      peakGuests,
      avgRooms: n > 0 ? Math.round((roomNights / n) * 10) / 10 : 0,
      avgGuests: n > 0 ? Math.round((guestNights / n) * 10) / 10 : 0,
      roomNights,
      guestNights,
      availableRoomNights,
      occupancyPct,
    });
  }
  return out;
}

function horizonToTotals(rows: GuestForecastMonth[]): GuestForecastTotals {
  if (rows.length === 0) return emptyTotals();
  let arrivals = 0;
  let departures = 0;
  let peakRooms = 0;
  let peakGuests = 0;
  let roomNights = 0;
  let guestNights = 0;
  let availableRoomNights = 0;
  let dayCount = 0;
  for (const m of rows) {
    arrivals += m.arrivals;
    departures += m.departures;
    peakRooms = Math.max(peakRooms, m.peakRooms);
    peakGuests = Math.max(peakGuests, m.peakGuests);
    roomNights += m.roomNights;
    guestNights += m.guestNights;
    availableRoomNights += m.availableRoomNights;
    dayCount += m.days;
  }
  const occupancyPct =
    availableRoomNights > 0
      ? Math.round((roomNights / availableRoomNights) * 1000) / 10
      : 0;
  return {
    arrivals,
    departures,
    peakRooms,
    peakGuests,
    avgRooms: dayCount > 0 ? Math.round((roomNights / dayCount) * 10) / 10 : 0,
    avgGuests:
      dayCount > 0 ? Math.round((guestNights / dayCount) * 10) / 10 : 0,
    roomNights,
    guestNights,
    availableRoomNights,
    occupancyPct,
  };
}

/**
 * Weekly (7-day), selected calendar-month, and 6-month guest / room forecast
 * from held + confirmed + in-house bookings.
 */
export async function loadGuestForecast(
  admin: Admin,
  propertyId: string,
  options?: { monthYm?: string | null },
): Promise<GuestForecast> {
  const businessDate = thimphuToday();
  const monthYm = parseForecastMonthYm(options?.monthYm, businessDate);
  const weekEnd = thimphuDateOffset(businessDate, 7);
  const monthStart = `${monthYm}-01`;
  const monthEnd = monthEndExclusive(monthStart);
  const horizonStart = monthStart;
  const horizonEnd = `${shiftMonthYm(monthYm, 6)}-01`;
  // Cover week (from today), selected month, and full 6-mo horizon in one pull.
  const rangeStart = [horizonStart, businessDate, monthStart].reduce((a, b) =>
    a < b ? a : b,
  );
  const rangeEnd = [horizonEnd, weekEnd, monthEnd].reduce((a, b) =>
    a > b ? a : b,
  );
  const now = new Date();

  const [{ data }, { count: unitCount }] = await Promise.all([
    admin
      .from("bookings")
      .select(
        "check_in, check_out, status, hold_expires_at, adults, children, rooms",
      )
      .eq("property_id", propertyId)
      .in("status", ["held", "confirmed", "checked_in"])
      .lt("check_in", rangeEnd)
      .gt("check_out", rangeStart)
      .limit(4000),
    admin
      .from("room_units")
      .select("*", { count: "exact", head: true })
      .eq("property_id", propertyId),
  ]);

  const totalRooms = unitCount ?? 0;
  const bookings = (data ?? []) as BookingRow[];
  const allDates = eachDate(rangeStart, rangeEnd);
  const allDays = buildDays(allDates, bookings, now);
  const dayMap = new Map(allDays.map((d) => [d.date, d]));

  const weeklyDates = eachDate(businessDate, weekEnd);
  const monthlyDates = eachDate(monthStart, monthEnd);
  const weekly = weeklyDates.map(
    (date) =>
      dayMap.get(date) ?? {
        date,
        arrivals: 0,
        departures: 0,
        rooms: 0,
        guests: 0,
      },
  );
  const monthly = monthlyDates.map(
    (date) =>
      dayMap.get(date) ?? {
        date,
        arrivals: 0,
        departures: 0,
        rooms: 0,
        guests: 0,
      },
  );
  const horizon = buildHorizonMonths(monthYm, 6, dayMap, totalRooms);

  return {
    businessDate,
    monthYm,
    totalRooms,
    weekly,
    monthly,
    horizon,
    weekTotals: totals(weekly, totalRooms),
    monthTotals: totals(monthly, totalRooms),
    horizonTotals: horizonToTotals(horizon),
  };
}
