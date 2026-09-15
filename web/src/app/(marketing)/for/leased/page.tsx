import Link from "next/link";
import type { Metadata } from "next";
import { MarketingPageBanner } from "@/components/marketing/MarketingPageBanner";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";

export const metadata: Metadata = {
  title: "Leased hotel portfolios",
  description:
    "One owner, many leased hotels across Bhutan — one Innora account with a property switcher.",
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <>
      <MarketingPageBanner
        media={MARKETING_MEDIA.segmentLeased}
        eyebrow="Most common in Bhutan"
        title="One owner. Many leased hotels."
        description="Operate hotels in different locations under different trade names — without mixing folios, rates, or staff."
      />
      <div className="mx-auto max-w-3xl px-6 py-14 md:px-10">
        <MarketingReveal>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Separate rates, rooms, and night audit per property</li>
            <li>Cheaper setup for each extra location under the same owner</li>
            <li>Portfolio package pricing on the pricing page</li>
          </ul>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={MARKETING_MEDIA.howLive.src}
              alt={MARKETING_MEDIA.howLive.alt}
              className="aspect-[4/3] w-full rounded-2xl object-cover"
              loading="lazy"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={MARKETING_MEDIA.staffDesk.src}
              alt={MARKETING_MEDIA.staffDesk.alt}
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
              Portfolio pricing
            </Link>
          </div>
        </MarketingReveal>
      </div>
    </>
  );
}
