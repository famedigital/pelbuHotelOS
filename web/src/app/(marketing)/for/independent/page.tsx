import Link from "next/link";
import type { Metadata } from "next";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";

export const metadata: Metadata = {
  title: "Independent hotels",
  description:
    "Innora for single-property hotels in Bhutan — front desk, folio, night audit, and POS.",
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <div className="pt-24">
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <MarketingReveal>
          <h1 className="font-display text-4xl tracking-tight">
            Independent hotels
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            One building, one desk team. Innora gives you reservations, room
            assignment, guest folios, night audit, and optional POS — without
            spreadsheet chaos. Classic or Plus package, with onboarding and
            staff training before go-live.
          </p>
          <ul className="mt-8 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Front office: arrivals, departures, stay view</li>
            <li>Folio posting and night audit close</li>
            <li>Training so the desk can run day one</li>
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="inline-flex h-11 items-center rounded-full bg-cta px-6 text-sm font-semibold"
            >
              Book a demo
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center rounded-full border border-border bg-card px-6 text-sm"
            >
              Pricing
            </Link>
          </div>
        </MarketingReveal>
      </div>
    </div>
  );
}
