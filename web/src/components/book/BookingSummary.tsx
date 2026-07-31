"use client";

import { Card } from "@/components/ui/card";
import { formatBtn } from "@/lib/pricing";
import { CheckIcon } from "lucide-react";

type Props = {
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  rooms: number;
  selectedName: string | null;
  perNightBtn?: number | null;
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

const ASSURANCES = [
  "Direct rate — no OTA markup",
  "Rooms held while the desk confirms",
  "Pay a token to lock the stay",
] as const;

export function BookingSummary({
  checkIn,
  checkOut,
  nights,
  adults,
  rooms,
  selectedName,
  perNightBtn,
  totalBtn,
  currency,
}: Props) {
  const nightsLabel = `${nights} night${nights === 1 ? "" : "s"}`;
  const roomsLabel = `${rooms} room${rooms === 1 ? "" : "s"}`;

  return (
    <Card
      className="gap-0 overflow-hidden py-0 lg:sticky lg:top-20"
      aria-label="Booking summary"
    >
      <div className="border-b border-border bg-frost-2/60 px-5 py-4">
        <p className="text-sm font-semibold text-foreground">Your stay</p>
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {fmtHuman(checkIn)} → {fmtHuman(checkOut)}
        </p>
      </div>

      <dl className="space-y-2.5 px-5 py-4 text-sm">
        <Row label="Nights" value={nightsLabel} />
        <Row label="Guests" value={String(adults)} />
        <Row label="Rooms" value={roomsLabel} />
        <Row label="Room type" value={selectedName ?? "Not selected yet"} />
        {perNightBtn != null ? (
          <Row label="Per night" value={formatBtn(perNightBtn)} />
        ) : null}
      </dl>

      <div className="border-t border-border px-5 py-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">
              Estimated total ({currency})
            </p>
            <p className="mt-1 font-display text-2xl leading-none tabular-nums text-foreground">
              {totalBtn == null ? "On request" : formatBtn(totalBtn)}
            </p>
          </div>
          {totalBtn != null ? (
            <p className="text-right text-[11px] leading-4 text-muted-foreground">
              {nightsLabel}
              <br />
              {roomsLabel}
            </p>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
          Final invoice and any applicable GST are confirmed by the desk before
          payment.
        </p>
      </div>

      <ul className="space-y-1.5 border-t border-border bg-frost-1 px-5 py-4">
        {ASSURANCES.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-xs text-muted-foreground"
          >
            <CheckIcon
              className="mt-0.5 size-3.5 shrink-0 text-mint-600"
              aria-hidden
            />
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
