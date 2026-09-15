import Link from "next/link";
import type { Metadata } from "next";
import { MarketingPageBanner } from "@/components/marketing/MarketingPageBanner";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";

export const metadata: Metadata = {
  title: "Hotel chains",
  description:
    "Innora for branded multi-property groups in Bhutan — shared standards, separate desks.",
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <>
      <MarketingPageBanner
        media={MARKETING_MEDIA.segmentChain}
        title="Chains & brands"
        description="Shared operating standards across properties with room to grow — each hotel keeps its own rooms, rates, and folios."
      />
      <div className="mx-auto max-w-3xl px-6 py-14 md:px-10">
        <MarketingReveal>
          <div className="overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={MARKETING_MEDIA.howTrain.src}
              alt={MARKETING_MEDIA.howTrain.alt}
              className="aspect-[16/9] w-full object-cover"
              loading="lazy"
            />
          </div>
          <p className="mt-8 text-muted-foreground">
            Chain package starts from a clear floor price — custom quote for
            larger groups.
          </p>
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
              See Chain package
            </Link>
          </div>
        </MarketingReveal>
      </div>
    </>
  );
}
