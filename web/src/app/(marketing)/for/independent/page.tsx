import Link from "next/link";
import type { Metadata } from "next";
import { MarketingPageBanner } from "@/components/marketing/MarketingPageBanner";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";

export const metadata: Metadata = {
  title: "Independent hotels",
  description:
    "Innora for single-property hotels in Bhutan — front desk, folio, night audit, and POS.",
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <>
      <MarketingPageBanner
        media={MARKETING_MEDIA.segmentIndependent}
        title="Independent hotels"
        description="One building, one desk team — reservations, folio, night audit, and optional POS without spreadsheet chaos."
      />
      <div className="mx-auto max-w-3xl px-6 py-14 md:px-10">
        <MarketingReveal>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Front office: arrivals, departures, stay view</li>
            <li>Folio posting and night audit close</li>
            <li>Training so the desk can run day one</li>
          </ul>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={MARKETING_MEDIA.roomGuest.src}
              alt={MARKETING_MEDIA.roomGuest.alt}
              className="aspect-[4/3] w-full rounded-2xl object-cover"
              loading="lazy"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={MARKETING_MEDIA.housekeeping.src}
              alt={MARKETING_MEDIA.housekeeping.alt}
              className="aspect-[4/3] w-full rounded-2xl object-cover"
              loading="lazy"
            />
          </div>
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
    </>
  );
}
