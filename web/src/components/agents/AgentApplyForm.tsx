"use client";

import {
  createAgentApplication,
  type AgentApplyState,
} from "@/app/actions/agents";
import { useActionState, useState } from "react";

const initial: AgentApplyState = { ok: false };

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

export function AgentApplyForm() {
  const [state, action, pending] = useActionState(createAgentApplication, initial);

  if (state.ok && state.agentId) {
    return (
      <div
        className="border border-espresso/10 bg-white px-6 py-8 sm:px-8"
        role="status"
        aria-live="polite"
      >
        <p className="text-xs tracking-[0.25em] text-gold uppercase">
          Application received
        </p>
        <h2 className="mt-3 text-2xl text-espresso">
          Thank you — your partner request is in.
        </h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Our desk has been notified and will review your license and market. We
          typically reply within a few working days.
        </p>

        <ol className="mt-6 space-y-3 text-sm text-muted">
          <li className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-espresso/20 text-xs text-espresso"
            >
              1
            </span>
            <span>We verify your trade license and confirm your market.</span>
          </li>
          <li className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-espresso/20 text-xs text-espresso"
            >
              2
            </span>
            <span>
              On approval we set your rate tier, enable guide and driver beds, and
              open MoU credit terms if you requested them.
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
            <p className="font-mono text-sm text-espresso break-all">{state.agentId}</p>
            <CopyReference value={state.agentId} />
          </div>
        </div>

        <a
          href="/book"
          className="mt-8 inline-flex min-h-11 items-center rounded-sm bg-espresso px-5 text-sm font-medium text-ivory"
        >
          Book a guest meanwhile
        </a>
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

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium tracking-wide text-espresso">
          Company
        </legend>
        <label className="block text-sm text-muted">
          Company or agency name
          <input
            type="text"
            name="company_name"
            required
            maxLength={160}
            autoComplete="organization"
            className={fieldClassName()}
          />
        </label>
        <label className="block text-sm text-muted">
          Primary market
          <select name="market" required defaultValue="bhutan" className={fieldClassName()}>
            <option value="bhutan">Bhutan</option>
            <option value="jaigaon">Jaigaon</option>
            <option value="india">India</option>
          </select>
        </label>
        <label className="block text-sm text-muted">
          License document link{" "}
          <span className="text-espresso/40">(Drive or Cloudinary URL — optional now)</span>
          <input
            type="url"
            name="license_url"
            placeholder="https://"
            maxLength={500}
            className={fieldClassName()}
          />
        </label>
        <label className="flex items-start gap-3 text-sm text-espresso">
          <input type="checkbox" name="wants_mou" className="mt-1" />
          <span>
            I want MoU / credit terms after approval
            <span className="block text-muted">
              Tick this if you expect monthly settlement.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium tracking-wide text-espresso">
          Contact
        </legend>
        <label className="block text-sm text-muted">
          Contact person
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
            Typical monthly room nights, destinations, existing hotel partners…
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
          {pending ? "Submitting…" : "Submit application"}
        </button>
        <p className="text-xs text-muted leading-relaxed">
          By submitting you confirm the details are accurate. We will contact you on
          the phone or email above.
        </p>
      </div>
    </form>
  );
}
