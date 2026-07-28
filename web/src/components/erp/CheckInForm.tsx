"use client";

import {
  confirmCheckIn,
  confirmCheckOut,
  type CheckInState,
  type CheckOutState,
} from "@/app/actions/erp-checkin";
import { useActionState } from "react";

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00`).getTime();
  const b = new Date(`${checkOut}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

export type CheckInBooking = {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  check_in: string;
  check_out: string;
  status: string;
  guide_number: string | null;
  payment_mode: string | null;
  adults: number;
  rooms: number;
  booking_rooms: { qty: number; inventory_kind: string; room_types?: { name: string; code: string } | null }[];
  booking_guests: {
    full_name: string;
    nationality: string | null;
    passport_or_cid: string | null;
    sdf_ref: string | null;
    sdf_doc_url: string | null;
  }[];
  booking_drivers: {
    full_name: string | null;
    phone: string | null;
    vehicle_no: string | null;
    license_no: string | null;
  }[];
};

function fieldClassName() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-gold";
}

const checkInInitial: CheckInState = { ok: false };
const checkOutInitial: CheckOutState = { ok: false };

export function CheckInForm({ booking }: { booking: CheckInBooking }) {
  const [state, action, pending] = useActionState(confirmCheckIn, checkInInitial);
  const guest = booking.booking_guests[0];
  const driver = booking.booking_drivers[0];
  const hasDriverBeds = booking.booking_rooms.some(
    (r) => r.inventory_kind === "driver_comp" && r.qty > 0,
  );

  if (state.ok && state.bookingId) {
    return (
      <div className="border border-espresso/10 bg-white px-6 py-8" role="status">
        <p className="text-xs tracking-[0.25em] text-gold uppercase">Checked in</p>
        <h2 className="mt-3 text-2xl text-espresso">Guest is in-house</h2>
        <p className="mt-2 text-sm text-muted">
          Folio opened
          {state.folioId ? (
            <>
              {" · "}
              <a
                href={`/erp/folios/${state.folioId}`}
                className="text-maroon underline-offset-4 hover:underline"
              >
                open folio
              </a>
            </>
          ) : null}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/erp/check-in"
            className="inline-flex min-h-11 items-center rounded-sm bg-gold px-5 text-sm font-medium text-espresso"
          >
            Next arrival
          </a>
          <a
            href="/erp/pos"
            className="inline-flex min-h-11 items-center rounded-sm border border-espresso/20 px-5 text-sm text-espresso"
          >
            POS
          </a>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-8 border border-espresso/10 bg-white px-6 py-8">
      <input type="hidden" name="booking_id" value={booking.id} />
      {state.error ? (
        <p className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="text-sm text-muted">
        <p className="font-medium text-espresso">
          {(booking.contact_name ?? "Guest")} · {booking.contact_phone ?? "—"}
        </p>
        <p>
          {booking.check_in} → {booking.check_out}{" "}
          <span className="ml-1 inline-flex items-center rounded-full border border-gold/40 bg-gold/5 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-gold">
            {nightsBetween(booking.check_in, booking.check_out)} nights
          </span>{" "}
          · {booking.adults} adults · {booking.rooms} rooms · {booking.status}
        </p>
        <ul className="mt-2 space-y-1">
          {booking.booking_rooms.map((r, i) => (
            <li key={`${r.inventory_kind}-${i}`}>
              {r.qty}× {r.room_types?.name ?? r.inventory_kind}
            </li>
          ))}
        </ul>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Guide & settlement
        </legend>
        <label className="block text-sm text-espresso">
          Guide number
          <input
            type="text"
            name="guide_number"
            required
            defaultValue={booking.guide_number ?? ""}
            className={fieldClassName()}
          />
        </label>
        <label className="block text-sm text-espresso">
          Payment mode
          <select
            name="payment_mode"
            required
            defaultValue={booking.payment_mode ?? "cash"}
            className={fieldClassName()}
          >
            <option value="cash">Cash</option>
            <option value="prepaid">Prepaid</option>
            <option value="partial">Partial</option>
            <option value="on_credit">On credit (agent)</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Guest SDF
        </legend>
        <label className="block text-sm text-espresso">
          Guest full name
          <input
            type="text"
            name="guest_name"
            required
            defaultValue={guest?.full_name ?? booking.contact_name ?? ""}
            className={fieldClassName()}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-espresso">
            Nationality
            <input
              type="text"
              name="nationality"
              defaultValue={guest?.nationality ?? ""}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            Passport / CID
            <input
              type="text"
              name="passport_or_cid"
              required
              defaultValue={guest?.passport_or_cid ?? ""}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            SDF reference
            <input
              type="text"
              name="sdf_ref"
              required
              defaultValue={guest?.sdf_ref ?? ""}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            SDF doc URL (optional)
            <input
              type="url"
              name="sdf_doc_url"
              defaultValue={guest?.sdf_doc_url ?? ""}
              placeholder="https://…"
              className={fieldClassName()}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Driver {hasDriverBeds ? "(required)" : "(optional)"}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-espresso">
            Driver name
            <input
              type="text"
              name="driver_name"
              required={hasDriverBeds}
              defaultValue={driver?.full_name ?? ""}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            Driver phone
            <input
              type="tel"
              name="driver_phone"
              defaultValue={driver?.phone ?? ""}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            Vehicle no
            <input
              type="text"
              name="vehicle_no"
              defaultValue={driver?.vehicle_no ?? ""}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            License no
            <input
              type="text"
              name="license_no"
              defaultValue={driver?.license_no ?? ""}
              className={fieldClassName()}
            />
          </label>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-sm bg-espresso px-6 text-sm font-medium text-ivory disabled:opacity-60"
      >
        {pending ? "Checking in…" : "Confirm check-in"}
      </button>
    </form>
  );
}

export function CheckOutForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(confirmCheckOut, checkOutInitial);

  if (state.ok) {
    return (
      <p className="border border-espresso/10 bg-white px-4 py-3 text-sm text-espresso" role="status">
        Checked out.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white px-6 py-6">
      <input type="hidden" name="booking_id" value={bookingId} />
      {state.error ? (
        <p className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon" role="alert">
          {state.error}
        </p>
      ) : null}
      <p className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
        Check out
      </p>
      <label className="flex items-center gap-2 text-sm text-espresso">
        <input type="checkbox" name="allow_balance" className="h-4 w-4" />
        Allow checkout with folio balance
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-sm border border-espresso/20 px-5 text-sm text-espresso disabled:opacity-60"
      >
        {pending ? "Checking out…" : "Confirm check-out"}
      </button>
    </form>
  );
}
