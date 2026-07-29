"use client";

import {
  postGuestServiceCharge,
  type GuestServiceState,
} from "@/app/actions/erp-pos";
import { useActionState } from "react";
import type { DeskBookingOption } from "@/components/erp/DeskPosForm";

const initial: GuestServiceState = { ok: false };

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00`).getTime();
  const b = new Date(`${checkOut}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

function fieldClassName() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20";
}

export function GuestServiceForm({ bookings }: { bookings: DeskBookingOption[] }) {
  const [state, action, pending] = useActionState(postGuestServiceCharge, initial);

  if (state.ok && state.folioId) {
    return (
      <div
        className="border border-espresso/10 bg-white px-5 py-6"
        role="status"
        aria-live="polite"
      >
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
          Posted
        </p>
        <p className="mt-2 text-sm text-espresso">
          Guest service charged to folio{" "}
          <a
            className="font-medium text-maroon underline-offset-4 hover:underline"
            href={`/erp/folios/${state.folioId}`}
          >
            {state.folioId.slice(0, 8)}
          </a>
          .
        </p>
        <a
          href="/erp/pos"
          className="mt-4 inline-flex min-h-11 items-center text-sm text-espresso underline-offset-4 hover:underline"
        >
          Post another
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5 border border-espresso/10 bg-white px-5 py-6">
      {state.error ? (
        <p
          className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <div className="border-b border-espresso/10 pb-3">
        <p className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Guest service
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Taxi, shop, or other charge to a folio.</p>
      </div>

      <label className="block text-sm text-espresso">
        Booking
        <select name="booking_id" required defaultValue="" className={fieldClassName()}>
          <option value="" disabled>
            Select booking
          </option>
          {bookings.map((b) => (
            <option key={b.id} value={b.id}>
              {(b.contact_name ?? "Guest")} Â· {b.check_in} → {b.check_out} Â·{" "}
              {nightsBetween(b.check_in, b.check_out)} nights
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm text-espresso">
          Kind
          <select name="service_kind" defaultValue="taxi" className={fieldClassName()}>
            <option value="taxi">Taxi</option>
            <option value="shop">Shop</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block text-sm text-espresso">
          Amount (Nu)
          <input
            type="number"
            name="amount_btn"
            required
            min={1}
            step="0.01"
            inputMode="decimal"
            className={fieldClassName()}
          />
        </label>
      </div>

      <label className="block text-sm text-espresso">
        Description
        <input
          type="text"
          name="description"
          required
          placeholder="Airport run / market errand"
          className={fieldClassName()}
        />
      </label>

      <label className="flex min-h-11 items-center gap-2.5 text-sm text-espresso">
        <input
          type="checkbox"
          name="gst_applicable"
          className="h-4 w-4 rounded-sm border-espresso/30 accent-maroon"
        />
        GST applicable (7%)
      </label>

      <label className="block text-sm text-espresso">
        Notes
        <input type="text" name="notes" className={fieldClassName()} />
      </label>

      <button
        type="submit"
        disabled={pending || bookings.length === 0}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-espresso px-5 text-sm font-medium text-ivory transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Posting…" : "Post to folio"}
      </button>
    </form>
  );
}
