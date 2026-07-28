"use client";

import { createBooking, type BookingActionState } from "@/app/actions/bookings";
import { StayDatesField } from "@/components/ui/StayDatesField";
import { useActionState, useMemo, useState } from "react";

const initial: BookingActionState = { ok: false };

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fieldClassName() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-gold";
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

export function BookingForm() {
  const [state, action, pending] = useActionState(createBooking, initial);
  const minCheckIn = useMemo(() => todayIso(), []);

  if (state.ok && state.bookingId) {
    return (
      <div
        className="border border-espresso/10 bg-white px-6 py-8 sm:px-8"
        role="status"
        aria-live="polite"
      >
        <p className="text-xs tracking-[0.25em] text-gold uppercase">Rooms held</p>
        <h2 className="mt-3 text-2xl text-espresso">Pay the token to confirm.</h2>

        <ol className="mt-6 space-y-3 text-sm text-muted">
          <li className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-espresso/20 text-xs text-espresso"
            >
              1
            </span>
            <span>
              Your dates are held
              {state.tokenAmount != null
                ? ` · token ${state.tokenAmount.toLocaleString("en-BT")} BTN`
                : ""}
              . Transfer using the pay link below.
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
              The desk confirms once token money arrives. Quote your reference in
              bank remarks.
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
              Unpaid holds expire automatically
              {state.holdExpiresAt
                ? ` (${new Date(state.holdExpiresAt).toLocaleString("en-BT", {
                    timeZone: "Asia/Thimphu",
                  })})`
                : ""}
              .
            </span>
          </li>
        </ol>

        <div className="mt-6 space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Reference</p>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm text-espresso break-all">{state.bookingId}</p>
            <CopyReference value={state.bookingId} />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {state.paymentUrl ? (
            <a
              href={state.paymentUrl}
              className="inline-flex min-h-11 items-center rounded-sm bg-espresso px-5 text-sm font-medium text-ivory"
            >
              Pay token
            </a>
          ) : null}
          <a
            href="/rooms"
            className="inline-flex min-h-11 items-center rounded-sm border border-espresso/25 px-5 text-sm font-medium text-espresso"
          >
            Back to rooms
          </a>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6" noValidate>
      {state.error ? (
        <p
          className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <div className="space-y-4">
        <StayDatesField minCheckIn={minCheckIn} defaultMode="dates" />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-muted">
            Adults
            <input
              type="number"
              name="adults"
              required
              min={1}
              max={12}
              defaultValue={2}
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-muted">
            Rooms
            <input
              type="number"
              name="rooms"
              required
              min={1}
              max={6}
              defaultValue={1}
              className={fieldClassName()}
            />
          </label>
        </div>
      </div>

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
            autoComplete="name"
            maxLength={120}
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
          Guide number <span className="text-espresso/40">(if traveling with a guide)</span>
          <input
            type="text"
            name="guide_number"
            maxLength={64}
            className={fieldClassName()}
          />
        </label>
        <label className="block text-sm text-muted">
          Notes
          <textarea
            name="notes"
            rows={3}
            maxLength={800}
            placeholder="Arrival time, room preference, dietary needs…"
            className={fieldClassName()}
          />
        </label>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-gold px-6 text-sm font-medium text-espresso disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Sending…" : "Request booking"}
      </button>
    </form>
  );
}
