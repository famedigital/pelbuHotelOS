"use client";

import {
  createServiceRequest,
  type ServiceKind,
  type ServiceRequestState,
} from "@/app/actions/service-requests";
import { useActionState, useMemo, useState } from "react";

const initial: ServiceRequestState = { ok: false };

function fieldClassName() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-gold";
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function CopyReference({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex min-h-11 items-center rounded-sm border border-espresso/25 px-4 text-sm font-medium text-espresso transition-colors hover:border-gold"
      aria-label={copied ? "Reference copied" : "Copy reference"}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

type Props = {
  kind: ServiceKind;
};

const SPA_PACKAGES = [
  "Massage 60 min",
  "Massage 90 min",
  "Steam session",
  "Treatment package — desk will advise",
] as const;

export function ServiceRequestForm({ kind }: Props) {
  const [state, action, pending] = useActionState(createServiceRequest, initial);
  const [chargeToRoom, setChargeToRoom] = useState(false);
  const minDate = useMemo(() => todayIso(), []);
  const isMeeting = kind === "meeting";

  if (state.ok && state.requestId) {
    return (
      <div
        className="border border-espresso/10 bg-white px-6 py-8 sm:px-8"
        role="status"
        aria-live="polite"
      >
        <p className="text-xs tracking-[0.25em] text-gold uppercase">
          Request received
        </p>
        <h2 className="mt-3 text-2xl text-espresso">
          {isMeeting
            ? "Thank you — your meeting enquiry is in."
            : "Thank you — your spa request is in."}
        </h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          {isMeeting
            ? "Our desk has the details and will confirm the hall, setup, and any catering within business hours."
            : "Our desk has been alerted and will confirm the slot with the therapist. In-house guests can settle on the room folio."}
        </p>

        <ol className="mt-6 space-y-3 text-sm text-muted">
          <li className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-espresso/20 text-xs text-espresso"
            >
              1
            </span>
            <span>
              {isMeeting
                ? "We check hall availability against your date and guest count."
                : "We check the calendar and therapist availability for your slot."}
            </span>
          </li>
          <li className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-espresso/20 text-xs text-espresso"
            >
              2
            </span>
            <span>
              {isMeeting
                ? "We confirm layout, duration, and any catering or AV notes."
                : "We confirm the treatment, rate, and start time."}
            </span>
          </li>
          <li className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-espresso/20 text-xs text-espresso"
            >
              3
            </span>
            <span>
              Keep this reference — quote it when you call or email to follow up.
            </span>
          </li>
        </ol>

        <div className="mt-6 space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            Your reference
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm text-espresso break-all">
              {state.requestId}
            </p>
            <CopyReference value={state.requestId} />
          </div>
        </div>

        <a
          href="/book"
          className="mt-8 inline-flex min-h-11 items-center rounded-sm bg-espresso px-5 text-sm font-medium text-ivory"
        >
          {isMeeting ? "Reserve rooms for delegates" : "Book a stay"}
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="kind" value={kind} />

      {state.error ? (
        <p
          className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium tracking-wide text-espresso">
          {isMeeting ? "Meeting details" : "Spa details"}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-muted">
            Preferred date
            <input
              type="date"
              name="preferred_on"
              required
              min={minDate}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-muted">
            Preferred time <span className="text-espresso/40">(optional)</span>
            <input
              type="time"
              name="preferred_time"
              className={fieldClassName()}
            />
          </label>
        </div>

        {isMeeting ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-muted">
              Attendees
              <input
                type="number"
                name="party_size"
                required
                min={1}
                max={25}
                defaultValue={8}
                className={fieldClassName()}
              />
              <span className="mt-1 block text-xs text-espresso/50">
                Up to 25 guests in the hall.
              </span>
            </label>
            <label className="block text-sm text-muted">
              Duration (hours)
              <input
                type="number"
                name="duration_hours"
                required
                min={1}
                max={12}
                step={0.5}
                defaultValue={2}
                className={fieldClassName()}
              />
              <span className="mt-1 block text-xs text-espresso/50">
                Half-hour steps, 1–12 hours.
              </span>
            </label>
          </div>
        ) : (
          <>
            <label className="block text-sm text-muted">
              Guests
              <input
                type="number"
                name="party_size"
                required
                min={1}
                max={6}
                defaultValue={1}
                className={fieldClassName()}
              />
              <span className="mt-1 block text-xs text-espresso/50">
                Treatments are booked per guest.
              </span>
            </label>
            <label className="block text-sm text-muted">
              Package
              <select name="package_name" className={fieldClassName()} defaultValue="">
                <option value="">Select — rates confirmed by desk</option>
                {SPA_PACKAGES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-espresso/50">
                Unsure? Pick the closest fit and add detail in notes.
              </span>
            </label>
          </>
        )}

        {!isMeeting ? (
          <>
            <label className="flex items-start gap-3 text-sm text-espresso">
              <input
                type="checkbox"
                name="charge_to_room"
                className="mt-1"
                checked={chargeToRoom}
                onChange={(e) => setChargeToRoom(e.target.checked)}
              />
              <span>
                Charge to my room folio
                <span className="block text-muted">
                  Tick this if you are an in-house guest and want to settle at
                  checkout.
                </span>
              </span>
            </label>
            {chargeToRoom ? (
              <label className="block text-sm text-muted">
                Room number or booking reference
                <input
                  type="text"
                  name="room_or_booking_ref"
                  required
                  maxLength={120}
                  className={fieldClassName()}
                />
              </label>
            ) : (
              <input type="hidden" name="room_or_booking_ref" value="" />
            )}
          </>
        ) : null}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium tracking-wide text-espresso">
          Contact
        </legend>
        <label className="block text-sm text-muted">
          Full name
          <input
            type="text"
            name="contact_name"
            required
            maxLength={120}
            autoComplete="name"
            className={fieldClassName()}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-muted">
            Phone
            <input
              type="tel"
              name="contact_phone"
              required
              autoComplete="tel"
              placeholder="+975 …"
              maxLength={24}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-muted">
            Email <span className="text-espresso/40">(optional)</span>
            <input
              type="email"
              name="contact_email"
              autoComplete="email"
              maxLength={160}
              className={fieldClassName()}
            />
          </label>
        </div>
        <label className="block text-sm text-muted">
          Notes
          <span className="block text-espresso/40">
            {isMeeting
              ? "AV needs, catering, seating style, delegate names…"
              : "Preferences, pressure, injuries, therapist notes…"}
          </span>
          <textarea
            name="notes"
            rows={3}
            maxLength={800}
            className={fieldClassName()}
          />
        </label>
      </fieldset>

      <div className="space-y-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-gold px-6 text-sm font-medium text-espresso disabled:opacity-60 sm:w-auto"
        >
          {pending
            ? "Sending…"
            : isMeeting
              ? "Send meeting enquiry"
              : "Request spa slot"}
        </button>
        <p className="text-xs text-muted leading-relaxed">
          {isMeeting
            ? "We reply within business hours with availability and a confirmed quote. No payment is taken in this form."
            : "No payment is taken here. We confirm the slot and rate with the desk, then settle on the day or on your folio."}
        </p>
      </div>
    </form>
  );
}
