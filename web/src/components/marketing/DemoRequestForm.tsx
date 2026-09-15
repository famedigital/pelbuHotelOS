"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitSalesLead } from "@/app/actions/sales-leads";
import { BlurFade } from "@/components/ui/blur-fade";

export function DemoRequestForm() {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <BlurFade delay={0.05} inView>
        <p className="mt-8 rounded-2xl border border-primary/30 bg-secondary p-4 text-sm">
          Thank you — we received your request and will follow up.
        </p>
      </BlurFade>
    );
  }

  return (
    <BlurFade delay={0.1} inView>
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const res = await submitSalesLead(fd);
            if (res.ok) setDone(true);
            else setError(res.error ?? "Something went wrong");
          });
        }}
      >
        <label className="block text-sm">
          Your name
          <input
            name="name"
            required
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Phone (WhatsApp preferred)
          <input
            name="phone"
            required
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Email (optional)
          <input
            name="email"
            type="email"
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Segment
          <select
            name="segment"
            required
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
            defaultValue="leased"
          >
            <option value="leased">Leased portfolio (many hotels)</option>
            <option value="independent">Independent (one hotel)</option>
            <option value="chain">Chain / brand</option>
          </select>
        </label>
        <label className="block text-sm">
          Approx. rooms (total)
          <input
            name="rooms"
            type="number"
            min={1}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Dzongkhag / location
          <input
            name="dzongkhag"
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Notes
          <textarea
            name="notes"
            rows={3}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-cta text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Sending…" : "Submit"}
        </button>
        <p className="text-xs text-muted-foreground">
          Service starts after fees and{" "}
          <Link href="/conditions" className="underline">
            conditions
          </Link>{" "}
          acceptance.
        </p>
      </form>
    </BlurFade>
  );
}
