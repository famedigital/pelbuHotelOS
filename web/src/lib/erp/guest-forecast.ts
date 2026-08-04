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
};

export type GuestForecast = {
  businessDate: string;
  weekly: GuestForecastDay[];
  monthly: GuestForecastDay[];
  weekTotals: GuestForecastTotals;
  monthTotals: GuestForecastTotals;
};

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
  for (let i = 0; i < 62 && cursor < endExclusive; i += 1) {
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

function totals(days: GuestForecastDay[]): GuestForecastTotals {
  if (days.length === 0) {
    return {
      arrivals: 0,
      departures: 0,
      peakRooms: 0,
      peakGuests: 0,
      avgRooms: 0,
      avgGuests: 0,
    };
  }
  let arrivals = 0;
  let departures = 0;
  let peakRooms = 0;
  let peakGuests = 0;
  let roomsSum = 0;
  let guestsSum = 0;
  for (const d of days) {
    arrivals += d.arrivals;
    departures += d.departures;
    roomsSum += d.rooms;
    guestsSum += d.guests;
    peakRooms = Math.max(peakRooms, d.rooms);
    peakGuests = Math.max(peakGuests, d.guests);
  }
  return {
    arrivals,
    departures,
    peakRooms,
    peakGuests,
    avgRooms: Math.round((roomsSum / days.length) * 10) / 10,
    avgGuests: Math.round((guestsSum / days.length) * 10) / 10,
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

/**
 * Weekly (7-day) and calendar-month guest / room forecast from held + confirmed
 * + in-house bookings for department dashboards.
 */
export async function loadGuestForecast(
  admin: Admin,
  propertyId: string,
): Promise<GuestForecast> {
  const businessDate = thimphuToday();
  const weekEnd = thimphuDateOffset(businessDate, 7);
  const monthStart = `${businessDate.slice(0, 7)}-01`;
  const monthEnd = monthEndExclusive(businessDate);
  const rangeStart = monthStart < businessDate ? monthStart : businessDate;
  const rangeEnd = monthEnd > weekEnd ? monthEnd : weekEnd;
  const now = new Date();

  const { data } = await admin
    .from("bookings")
    .select(
      "check_in, check_out, status, hold_expires_at, adults, children, rooms",
    )
    .eq("property_id", propertyId)
    .in("status", ["held", "confirmed", "checked_in"])
    .lt("check_in", rangeEnd)
    .gt("check_out", rangeStart)
    .limit(2000);

  const bookings = (data ?? []) as BookingRow[];
  const weeklyDates = eachDate(businessDate, weekEnd);
  const monthlyDates = eachDate(monthStart, monthEnd);
  const weekly = buildDays(weeklyDates, bookings, now);
  const monthly = buildDays(monthlyDates, bookings, now);

  return {
    businessDate,
    weekly,
    monthly,
    weekTotals: totals(weekly),
    monthTotals: totals(monthly),
  };
}
