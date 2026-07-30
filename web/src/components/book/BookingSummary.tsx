"use client";

import { formatBtn } from "@/lib/pricing";

type Props = {
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  rooms: number;
  selectedName: string | null;
  totalBtn: number | null;
  currency: "BTN";
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Locale-independent so server and client render identical markup. */
function fmtHuman(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${WEEKDAYS[d.getUTCDay()]} ${day} ${MONTHS[d.getUTCMonth()]}`;
}

export function BookingSummary({
  checkIn,
  checkOut,
  nights,
  adults,
  rooms,
  selectedName,
  totalBtn,
  currency,
}: Props) {
  return (
    <aside className="sticky top-6 space-y-4 border-t border-border pt-5 md:border-t-0 md:pt-0">
      <p className="text-sm font-medium text-ink">Your stay</p>
      <dl className="space-y-2 text-sm">
        <Row label="Check-in" value={fmtHuman(checkIn)} />
        <Row label="Check-out" value={fmtHuman(checkOut)} />
        <Row label="Nights" value={String(nights)} />
        <Row label="Guests" value={String(adults)} />
        <Row label="Rooms" value={String(rooms)} />
        {selectedName ? <Row label="Room" value={selectedName} /> : null}
      </dl>
      <div className="border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">Estimated total ({currency})</p>
        <p className="mt-1 font-display text-2xl tabular-nums text-ink">
          {totalBtn == null ? "On request" : formatBtn(totalBtn)}
        </p>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}
