"use client";

import {
  postGuestLaundrySlip,
  type LaundrySlipLine,
} from "@/app/actions/erp-laundry-slip";
import type { LaundryCatalogItem } from "@/lib/laundry";
import { formatBtn } from "@/lib/pricing";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

type SlipRow = {
  catalogItemId: string;
  section: string;
  name: string;
  price: number;
  qty: number;
};

function rowsFromCatalog(catalog: LaundryCatalogItem[]): SlipRow[] {
  return catalog
    .filter((item) => item.is_active)
    .slice()
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    )
    .map((item) => ({
      catalogItemId: item.id,
      section: item.category || "Laundry",
      name: item.name,
      price: Number(item.price_btn),
      qty: 0,
    }));
}

export function GuestLaundrySlip({
  bookings,
  catalog,
  lockStay = false,
  emptyHint = "Add laundry prices on the Pricing tab.",
  onPosted,
}: {
  bookings: {
    id: string;
    contactName: string;
    rooms: { id: string; label: string }[];
  }[];
  catalog: LaundryCatalogItem[];
  /** Stay bill already knows the guest. The department form still picks one. */
  lockStay?: boolean;
  emptyHint?: string;
  onPosted?: () => void;
}) {
  const base = useMemo(() => rowsFromCatalog(catalog), [catalog]);
  const [lines, setLines] = useState(base);
  const [bookingId, setBookingId] = useState(bookings[0]?.id ?? "");
  const [roomUnitId, setRoomUnitId] = useState(bookings[0]?.rooms[0]?.id ?? "");
  const [speed, setSpeed] = useState("same_day");
  const [state, action, pending] = useActionState(postGuestLaundrySlip, { ok: false });
  const stay = bookings.find((booking) => booking.id === bookingId) ?? bookings[0];
  const factor = speed === "express" ? 2 : speed === "overnight" ? 1.5 : 1;
  const amount = useMemo(
    () =>
      lines.reduce((sum, line) => sum + line.price * line.qty * factor, 0),
    [lines, factor],
  );
  const service = Math.round(amount * 0.1 * 100) / 100;
  const total = Math.round((amount + service) * 100) / 100;
  const payload: LaundrySlipLine[] = lines
    .filter((line) => line.qty > 0)
    .map((line) => ({ catalogItemId: line.catalogItemId, qty: line.qty }));
  const onPostedRef = useRef(onPosted);
  onPostedRef.current = onPosted;
  const seenSlip = useRef("");

  useEffect(() => {
    setLines(rowsFromCatalog(catalog));
  }, [catalog]);

  useEffect(() => {
    if (!state.ok || !state.printUrl || seenSlip.current === state.printUrl) return;
    seenSlip.current = state.printUrl;
    onPostedRef.current?.();
  }, [state.ok, state.printUrl]);

  useEffect(() => {
    const next = stay?.rooms[0]?.id ?? "";
    setRoomUnitId((current) =>
      stay?.rooms.some((room) => room.id === current) ? current : next,
    );
  }, [stay]);

  if (base.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyHint}</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="lines" value={JSON.stringify(payload)} />
      <input type="hidden" name="speed" value={speed} />
      <div className="flex flex-wrap gap-2">
        {lockStay ? (
          <>
            <input type="hidden" name="booking_id" value={stay?.id ?? ""} />
            <p className="flex h-9 items-center text-sm font-medium">
              {stay?.contactName || "Guest"}
            </p>
          </>
        ) : (
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
        )}
        {(stay?.rooms.length ?? 0) > 1 ? (
          <select
            name="room_unit_id"
            value={roomUnitId}
            onChange={(event) => setRoomUnitId(event.target.value)}
            className="h-9 rounded-md border px-2 text-sm"
            aria-label="Room"
          >
            {(stay?.rooms ?? []).map((room) => (
              <option key={room.id} value={room.id}>
                {room.label}
              </option>
            ))}
          </select>
        ) : (
          <input type="hidden" name="room_unit_id" value={roomUnitId} />
        )}
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
            <th>Price</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={line.catalogItemId} className="border-t">
              <td className="py-1">
                {line.section} {line.name}
              </td>
              <td className="tabular-nums">{formatBtn(line.price)}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  value={line.qty}
                  aria-label={`${line.name} quantity`}
                  className="h-8 w-16 rounded-md border px-2"
                  onChange={(event) => {
                    const qty = Math.max(0, Math.floor(Number(event.target.value) || 0));
                    setLines((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, qty } : item,
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
        {pending ? "Posting…" : "Post to folio"}
      </button>
    </form>
  );
}
