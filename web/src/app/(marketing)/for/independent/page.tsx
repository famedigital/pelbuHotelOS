import Link from "next/link";
import type { Metadata } from "next";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";

export const metadata: Metadata = {
  title: "Independent hotels",
  description:
    "BHO for single-property hotels in Bhutan — front desk, folio, night audit, and POS.",
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <div className="pt-24">
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <MarketingReveal>
          <h1 className="font-display text-4xl">Independent hotels</h1>
          <p className="mt-4 text-lg text-[var(--muted)]">
            One building, one desk team. BHO gives you reservations, room
            assignment, guest folios, night audit, and optional POS — without
            spreadsheet chaos. Classic or Plus package, with onboarding and
            staff training before go-live.
          </p>
          <ul className="mt-8 list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
            <li>Front office: arrivals, departures, stay view</li>
            <li>Folio posting and night audit close</li>
            <li>Training so the desk can run day one</li>
          </ul>
          <div className="mt-10 flex gap-3">
            <Link
              href="/demo"
              className="rounded-md bg-[var(--sky-600)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--sky-700)]"
            >
              Request demo
            </Link>
            <Link
              href="/pricing"
              className="rounded-md border px-5 py-2.5 text-sm transition hover:bg-white"
            >
              Pricing
            </Link>
          </div>
        </MarketingReveal>
      </div>
    </div>
  );
}
