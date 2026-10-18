/**
 * Offline FO Ask parser — "3 rooms 22 oct 3n" → qty / dates / nights.
 * Gemini is optional sugar; this path must work without a key.
 */

export type ParsedAskQuery = {
  rooms: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  raw: string;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function addDaysYmd(iso: string, days: number): string {
  const [ys, ms, ds] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(ys, ms - 1, ds));
  dt.setUTCDate(dt.getUTCDate() + days);
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function todayYmd(now = new Date()): string {
  return ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function parseDayMonth(
  day: number,
  monthToken: string,
  yearHint: number | null,
  now: Date,
): string | null {
  const month = MONTHS[monthToken.toLowerCase()];
  if (!month || day < 1 || day > 31) return null;
  let year = yearHint ?? now.getFullYear();
  let iso = ymd(year, month, day);
  // If no year and date already passed this year, roll to next year.
  if (yearHint == null && iso < todayYmd(now)) {
    year += 1;
    iso = ymd(year, month, day);
  }
  return iso;
}

/**
 * Parse free-text availability asks.
 * Examples: `3 rooms 22 oct 3n`, `2 dbl 15 nov 2 nights`, `tonight 1 room`
 */
export function parseAskQuery(
  raw: string,
  now: Date = new Date(),
): ParsedAskQuery | null {
  const text = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return null;

  let rooms = 1;
  const roomsMatch =
    text.match(/\b(\d+)\s*(?:rooms?|rms?|dbl|twin|suites?)\b/) ??
    text.match(/\b(\d+)\s*r\b/);
  if (roomsMatch) {
    rooms = Math.min(Math.max(Number(roomsMatch[1]), 1), 20);
  }

  let nights = 1;
  const nightsMatch =
    text.match(/\b(\d+)\s*(?:nights?|nts?|n)\b/) ??
    text.match(/\b(\d+)n\b/);
  if (nightsMatch) {
    nights = Math.min(Math.max(Number(nightsMatch[1]), 1), 60);
  }

  let checkIn: string | null = null;

  if (/\btonight\b/.test(text) || /\btoday\b/.test(text)) {
    checkIn = todayYmd(now);
  } else if (/\btomorrow\b/.test(text)) {
    checkIn = addDaysYmd(todayYmd(now), 1);
  }

  // ISO date
  if (!checkIn) {
    const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (iso) {
      checkIn = `${iso[1]}-${iso[2]}-${iso[3]}`;
    }
  }

  // 22 oct / 22 october / 22/10 / 22-10
  if (!checkIn) {
    const dm = text.match(
      /\b(\d{1,2})\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s*(20\d{2}))?\b/,
    );
    if (dm) {
      checkIn = parseDayMonth(
        Number(dm[1]),
        dm[2],
        dm[3] ? Number(dm[3]) : null,
        now,
      );
    }
  }

  if (!checkIn) {
    const slash = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](20\d{2}))?\b/);
    if (slash) {
      const d = Number(slash[1]);
      const m = Number(slash[2]);
      const y = slash[3] ? Number(slash[3]) : now.getFullYear();
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        let iso = ymd(y, m, d);
        if (!slash[3] && iso < todayYmd(now)) {
          iso = ymd(y + 1, m, d);
        }
        checkIn = iso;
      }
    }
  }

  if (!checkIn) return null;

  const checkOut = addDaysYmd(checkIn, nights);
  return { rooms, checkIn, checkOut, nights, raw: raw.trim() };
}
