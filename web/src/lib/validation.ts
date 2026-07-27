const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,18}$/;

export function trimRequired(value: FormDataEntryValue | null, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new Error(`${label} is required.`);
  }
  return text;
}

export function optionalTrim(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

export function parsePositiveInt(
  value: FormDataEntryValue | null,
  label: string,
  max: number,
): number {
  const n = Number(typeof value === "string" ? value : NaN);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new Error(`${label} must be between 1 and ${max}.`);
  }
  return n;
}

export function assertPhone(phone: string): void {
  if (!PHONE_RE.test(phone)) {
    throw new Error("Enter a valid phone number (include country code if outside Bhutan).");
  }
}

export function assertOptionalEmail(email: string | null): void {
  if (email && !EMAIL_RE.test(email)) {
    throw new Error("Enter a valid email address.");
  }
}

export function assertStayDates(checkIn: string, checkOut: string): void {
  const inDate = parseIsoDate(checkIn, "Check-in");
  const outDate = parseIsoDate(checkOut, "Check-out");
  const today = startOfTodayThimphu();

  if (inDate < today) {
    throw new Error("Check-in cannot be in the past.");
  }
  if (outDate <= inDate) {
    throw new Error("Check-out must be after check-in.");
  }

  const maxNights = 60;
  const nights =
    (outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24);
  if (nights > maxNights) {
    throw new Error(`Stays longer than ${maxNights} nights need the front desk.`);
  }
}

export function assertOnOrAfterToday(value: string, label: string): void {
  const date = parseIsoDate(value, label);
  if (date < startOfTodayThimphu()) {
    throw new Error(`${label} cannot be in the past.`);
  }
}

function parseIsoDate(value: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be a valid date.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date.`);
  }
  return date;
}

/** Calendar date in Asia/Thimphu (property timezone). */
function startOfTodayThimphu(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Thimphu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Could not resolve today’s date.");
  }
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}
