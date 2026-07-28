"use client";

import {
  createFastBooking,
  type FastBookState,
} from "@/app/actions/fast-book";
import { useActionState, useMemo } from "react";

export type FastBookRoomType = {
  id: string;
  code: string;
  name: string;
  inventory_kind: string;
  unit_count: number;
};

export type FastBookAgent = {
  id: string;
  company_name: string;
  market: string;
  status: string;
};

const initial: FastBookState = { ok: false };

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fieldClassName() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20";
}

type Props = {
  roomTypes: FastBookRoomType[];
  agents: FastBookAgent[];
};

export function FastBookForm({ roomTypes, agents }: Props) {
  const [state, action, pending] = useActionState(createFastBooking, initial);
  const minCheckIn = useMemo(() => todayIso(), []);

  const guestTypes = roomTypes.filter((r) => r.inventory_kind === "sellable_guest");
  const guideTypes = roomTypes.filter((r) => r.inventory_kind === "guide_comp");
  const driverTypes = roomTypes.filter((r) => r.inventory_kind === "driver_comp");

  if (state.ok && state.bookingId) {
    return (
      <div
        className="border border-espresso/10 bg-white px-6 py-10"
        role="status"
        aria-live="polite"
      >
        <p className="text-[11px] font-semibold tracking-[0.28em] text-gold uppercase">
          Saved
        </p>
        <h2 className="mt-3 text-3xl text-espresso">Booking confirmed</h2>
        <p className="mt-2 text-sm text-muted">
          Reference{" "}
          <span className="font-mono text-espresso">{state.bookingId}</span>
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="/erp/fast-book"
            className="inline-flex min-h-11 items-center rounded-sm bg-gold px-5 text-sm font-medium text-espresso transition-opacity hover:opacity-90"
          >
            Book another
          </a>
          <a
            href="/erp"
            className="inline-flex min-h-11 items-center rounded-sm border border-espresso/20 px-5 text-sm text-espresso transition-colors hover:border-espresso/40 hover:bg-espresso/[0.03]"
          >
            Back to inbox
          </a>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-8 border border-espresso/10 bg-white px-6 py-8">
      {state.error ? (
        <p
          className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Stay
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-espresso">
            Check-in
            <input
              type="date"
              name="check_in"
              required
              min={minCheckIn}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            Check-out
            <input
              type="date"
              name="check_out"
              required
              min={minCheckIn}
              className={fieldClassName()}
            />
          </label>
        </div>
        <label className="block text-sm text-espresso">
          Adults
          <input
            type="number"
            name="adults"
            required
            min={1}
            max={24}
            defaultValue={2}
            inputMode="numeric"
            className={fieldClassName()}
          />
        </label>
      </fieldset>

      <fieldset className="space-y-4">
        <div className="flex items-baseline justify-between">
          <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
            Guest rooms
          </legend>
          <p className="text-xs text-muted">Quantity per type</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {guestTypes.map((rt) => (
            <label key={rt.id} className="block text-sm text-espresso">
              {rt.name}
              <span className="ml-1 text-xs text-muted">({rt.unit_count})</span>
              <input
                type="number"
                name={`qty_${rt.code}`}
                min={0}
                max={rt.unit_count}
                defaultValue={0}
                inputMode="numeric"
                className={fieldClassName()}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <div className="flex items-baseline justify-between">
          <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
            Guide / driver beds
          </legend>
          <p className="text-xs text-muted">Complimentary</p>
        </div>
        <p className="text-xs text-muted">
          Complimentary inventory — does not distort guest ADR.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[...guideTypes, ...driverTypes].map((rt) => (
            <label key={rt.id} className="block text-sm text-espresso">
              {rt.name}
              <span className="ml-1 text-xs text-muted">({rt.unit_count})</span>
              <input
                type="number"
                name={`qty_${rt.code}`}
                min={0}
                max={rt.unit_count}
                defaultValue={0}
                inputMode="numeric"
                className={fieldClassName()}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Booked by
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-espresso">
            Role
            <select
              name="source"
              required
              defaultValue="reservation"
              className={fieldClassName()}
            >
              <option value="owner">Owner</option>
              <option value="reservation">Reservation</option>
              <option value="agent">Agent</option>
              <option value="mou_agent">MoU agent</option>
            </select>
          </label>
          <label className="block text-sm text-espresso">
            Agent
            <select name="agent_id" className={fieldClassName()} defaultValue="">
              <option value="">— Walk-in / none —</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.company_name} ({a.market}
                  {a.status === "demo" ? ", demo" : ""})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-espresso sm:col-span-2">
            Guide number
            <input
              type="text"
              name="guide_number"
              placeholder="Required for agent bookings"
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            Payment
            <select
              name="payment_mode"
              defaultValue="cash"
              className={fieldClassName()}
            >
              <option value="cash">Cash</option>
              <option value="prepaid">Prepaid</option>
              <option value="partial">Partial</option>
              <option value="on_credit">On credit</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Guest contact
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-espresso sm:col-span-2">
            Guest / lead name
            <input
              type="text"
              name="contact_name"
              required
              autoComplete="off"
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            Phone
            <input
              type="tel"
              name="contact_phone"
              required
              inputMode="tel"
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            Email
            <input
              type="email"
              name="contact_email"
              inputMode="email"
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso sm:col-span-2">
            Notes
            <textarea name="notes" rows={3} className={fieldClassName()} />
          </label>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-espresso px-6 text-sm font-medium text-ivory transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save booking"}
      </button>
    </form>
  );
}
