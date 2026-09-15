"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitSalesLead } from "@/app/actions/sales-leads";
import { BlurFade } from "@/components/ui/blur-fade";
import { ShimmerButton } from "@/components/ui/shimmer-button";

export default function DemoPage() {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="pt-24">
      <div className="mx-auto max-w-lg px-6 py-12 md:px-10">
        <BlurFade inView>
          <h1 className="font-display text-4xl">Request an Innora demo</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Tell us how many hotels you run and what modules you need (desk,
            folio, POS, multi-property). We or your local distributor will
            contact you. Service starts after fees and{" "}
            <Link href="/conditions" className="underline">
              conditions
            </Link>{" "}
            acceptance.
          </p>
        </BlurFade>

        {done ? (
          <BlurFade delay={0.05} inView>
            <p className="mt-8 rounded-md border border-[var(--mint-500)] bg-[var(--mint-100)] p-4 text-sm">
              Thank you — we received your request and will follow up.
            </p>
          </BlurFade>
        ) : (
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
                  className="mt-1 w-full rounded-md border border-[var(--ink-rule)] px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Phone (WhatsApp preferred)
                <input
                  name="phone"
                  required
                  className="mt-1 w-full rounded-md border border-[var(--ink-rule)] px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Email (optional)
                <input
                  name="email"
                  type="email"
                  className="mt-1 w-full rounded-md border border-[var(--ink-rule)] px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Segment
                <select
                  name="segment"
                  required
                  className="mt-1 w-full rounded-md border border-[var(--ink-rule)] px-3 py-2"
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
                  className="mt-1 w-full rounded-md border border-[var(--ink-rule)] px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Dzongkhag / location
                <input
                  name="dzongkhag"
                  className="mt-1 w-full rounded-md border border-[var(--ink-rule)] px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Notes
                <textarea
                  name="notes"
                  rows={3}
                  className="mt-1 w-full rounded-md border border-[var(--ink-rule)] px-3 py-2"
                />
              </label>
              {error ? (
                <p className="text-sm text-[var(--maroon)]">{error}</p>
              ) : null}
              <ShimmerButton
                type="submit"
                disabled={pending}
                background="var(--sky-600)"
                shimmerColor="#ffffff"
                borderRadius="0.375rem"
                className="h-11 w-full text-sm font-semibold border-transparent disabled:opacity-60"
              >
                {pending ? "Sending…" : "Submit"}
              </ShimmerButton>
            </form>
          </BlurFade>
        )}
      </div>
    </div>
  );
}
