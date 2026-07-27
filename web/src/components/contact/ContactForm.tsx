"use client";

import { createEnquiry, type EnquiryState } from "@/app/actions/enquiries";
import { useActionState, useState } from "react";

const initial: EnquiryState = { ok: false };

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

export function ContactForm() {
  const [state, action, pending] = useActionState(createEnquiry, initial);
  const [topic, setTopic] = useState<string>("general");

  if (state.ok && state.enquiryId) {
    return (
      <div
        className="border border-espresso/10 bg-white px-6 py-8 sm:px-8"
        role="status"
        aria-live="polite"
      >
        <p className="text-xs tracking-[0.25em] text-gold uppercase">Message sent</p>
        <h2 className="mt-3 text-2xl text-espresso">The desk has your enquiry.</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          We reply by phone, WhatsApp, or email — usually within desk hours. Keep
          this reference handy when you follow up.
        </p>

        <ol className="mt-6 space-y-3 text-sm text-muted">
          <li className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-espresso/20 text-xs text-espresso"
            >
              1
            </span>
            <span>A front-desk agent reviews your message and topic.</span>
          </li>
          <li className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-espresso/20 text-xs text-espresso"
            >
              2
            </span>
            <span>
              We reach back on the phone or email you gave — pick up if a Bhutan
              number rings.
            </span>
          </li>
          <li className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-espresso/20 text-xs text-espresso"
            >
              3
            </span>
            <span>Quote this reference if you call or write again about the same matter.</span>
          </li>
        </ol>

        <div className="mt-6 space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Reference</p>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm text-espresso break-all">{state.enquiryId}</p>
            <CopyReference value={state.enquiryId} />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="/book"
            className="inline-flex min-h-11 items-center rounded-sm bg-espresso px-5 text-sm font-medium text-ivory"
          >
            Book a stay
          </a>
          <a
            href="/order"
            className="inline-flex min-h-11 items-center rounded-sm border border-espresso/25 px-5 text-sm font-medium text-espresso"
          >
            Order food
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

      <label className="block text-sm text-muted">
        Topic
        <select
          name="topic"
          required
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className={fieldClassName()}
        >
          <option value="general">General</option>
          <option value="rooms">Rooms / stay</option>
          <option value="dining">Cafe / dining</option>
          <option value="spa">Spa &amp; steam</option>
          <option value="meeting">Meeting hall</option>
          <option value="agents">Agent / trade partnership</option>
          <option value="other">Other</option>
        </select>
      </label>

      {topic === "agents" ? (
        <p className="border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-espresso">
          For license review, rate tiers, and credit terms, apply directly at{" "}
          <a
            href="/agents"
            className="font-medium text-gold underline-offset-4 hover:underline"
          >
            /agents
          </a>{" "}
          — it is faster than a general message. Use this form only if your
          question is not covered there.
        </p>
      ) : null}

      <div className="space-y-4">
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
            <span className="block text-espresso/40">
              We call or WhatsApp this number.
            </span>
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
          Message
          <textarea
            name="message"
            required
            rows={5}
            maxLength={2000}
            minLength={10}
            placeholder="Tell us dates, number of guests, or what you need help with…"
            className={fieldClassName()}
          />
        </label>
      </div>

      <div className="space-y-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-gold px-6 text-sm font-medium text-espresso disabled:opacity-60 sm:w-auto"
        >
          {pending ? "Sending…" : "Send message"}
        </button>
        <p className="text-xs text-muted leading-relaxed">
          The desk replies during opening hours. For a booking today, use{" "}
          <a
            href="/book"
            className="text-gold underline-offset-4 hover:underline"
          >
            /book
          </a>{" "}
          instead.
        </p>
      </div>
    </form>
  );
}
