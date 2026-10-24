"use client";

import {
  postGuestLaundrySlip,
  type LaundrySlipLine,
} from "@/app/actions/erp-laundry-slip";
import type { LaundryCatalogItem } from "@/lib/laundry";
import { formatBtn } from "@/lib/pricing";
import { useActionState, useMemo, useState } from "react";

const CARD: LaundrySlipLine[] = [
  { section: "Men", name: "Shirt", wash: 150, press: 50, washQty: 0, pressQty: 0 },
  { section: "Women", name: "Shirt", wash: 150, press: 50, washQty: 0, pressQty: 0 },
];

export function GuestLaundrySlip({
  bookings,
  catalog,
}: {
  bookings: {
    id: string;
    contactName: string;
    rooms: { id: string; label: string }[];
  }[];
  catalog: LaundryCatalogItem[];
}) {
  const extras = catalog
    .filter((item) => item.is_active && !/shirt/i.test(item.name))
    .map((item) => {
      const press = /press/i.test(item.name);
      return {
        section: item.category || "Other",
        name: item.name,
        wash: press ? 0 : Number(item.price_btn),
        press: press ? Number(item.price_btn) : 0,
        washQty: 0,
        pressQty: 0,
      } satisfies LaundrySlipLine;
    });
  const base = [...CARD, ...extras];
  const [lines, setLines] = useState(base);
  const [bookingId, setBookingId] = useState(bookings[0]?.id ?? "");
  const [speed, setSpeed] = useState("same_day");
  const [state, action, pending] = useActionState(postGuestLaundrySlip, { ok: false });
  const stay = bookings.find((booking) => booking.id === bookingId) ?? bookings[0];
  const factor = speed === "express" ? 2 : speed === "overnight" ? 1.5 : 1;
  const amount = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + (line.wash * line.washQty + line.press * line.pressQty) * factor,
        0,
      ),
    [lines, factor],
  );
  const service = Math.round(amount * 0.1 * 100) / 100;
  const total = Math.round((amount + service) * 100) / 100;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <input type="hidden" name="speed" value={speed} />
      <div className="flex flex-wrap gap-2">
        <select
          name="booking_id"
          value={bookingId}
          onChange={(event) => setBookingId(event.target.value)}
          className="h-9 rounded-md border px-2 text-sm"
          aria-label="Guest"
        >
          {bookings.map((booking) => (
            <option key={booking.id} value={booking.id}>
              {booking.contactName}
            </option>
          ))}
        </select>
        <select name="room_unit_id" className="h-9 rounded-md border px-2 text-sm" aria-label="Room" defaultValue={stay?.rooms[0]?.id}>
          {(stay?.rooms ?? []).map((room) => (
            <option key={room.id} value={room.id}>
              {room.label}
            </option>
          ))}
        </select>
        <input type="hidden" name="guest_name" value={stay?.contactName ?? ""} />
        <select
          value={speed}
          onChange={(event) => setSpeed(event.target.value)}
          className="h-9 rounded-md border px-2 text-sm"
          aria-label="Speed"
        >
          <option value="same_day">Same day</option>
          <option value="overnight">Overnight +50%</option>
          <option value="express">Express +100%</option>
        </select>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th>Item</th>
            <th>Wash</th>
            <th>Qty</th>
            <th>Press only</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={`${line.section}-${line.name}`} className="border-t">
              <td className="py-1">
                {line.section} {line.name}
              </td>
              <td className="tabular-nums">{line.wash ? formatBtn(line.wash) : "—"}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  value={line.washQty}
                  aria-label={`${line.name} wash quantity`}
                  className="h-8 w-16 rounded-md border px-2"
                  onChange={(event) => {
                    const washQty = Number(event.target.value) || 0;
                    setLines((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, washQty } : item,
                      ),
                    );
                  }}
                />
              </td>
              <td className="tabular-nums">{line.press ? formatBtn(line.press) : "—"}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  value={line.pressQty}
                  aria-label={`${line.name} press quantity`}
                  className="h-8 w-16 rounded-md border px-2"
                  onChange={(event) => {
                    const pressQty = Number(event.target.value) || 0;
                    setLines((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, pressQty } : item,
                      ),
                    );
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-sm">
        {formatBtn(amount)} + service {formatBtn(service)} = {formatBtn(total)}. No GST.
      </p>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.printUrl ? (
        <a className="text-sm text-sky-800" href={state.printUrl} target="_blank" rel="noreferrer">
          Print the slip for signature
        </a>
      ) : null}
      <button type="submit" disabled={pending} className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground">
        Post to folio
      </button>
    </form>
  );
}
