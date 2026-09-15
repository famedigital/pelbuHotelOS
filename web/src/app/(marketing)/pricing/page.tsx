import Link from "next/link";
import type { Metadata } from "next";
import { MarketingPageBanner } from "@/components/marketing/MarketingPageBanner";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { PricingPackages } from "@/components/marketing/PricingPackages";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Innora packages in BTN — Classic through Chain. Front office, folio, POS, multi-property. Clear onboarding and desk training.",
  robots: { index: true, follow: true },
};

export default function PricingPage() {
  return (
    <>
      <MarketingPageBanner
        media={MARKETING_MEDIA.heroLobby}
        title="Innora pricing"
        description="Packages cover the full hotel OS — reservations, folio, POS, and multi-property. Prices in BTN."
      />
      <div className="mx-auto max-w-5xl px-6 py-14 md:px-10">
        <MarketingReveal>
          <p className="max-w-2xl text-muted-foreground">
            Service starts after onboarding, training fees, and{" "}
            <Link href="/conditions" className="underline underline-offset-2">
              conditions
            </Link>
            .
          </p>
        </MarketingReveal>
        <div className="mt-10">
          <PricingPackages />
        </div>
        <div className="mt-16 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={MARKETING_MEDIA.staffDesk.src}
            alt={MARKETING_MEDIA.staffDesk.alt}
            className="aspect-[21/9] w-full object-cover"
            loading="lazy"
          />
        </div>
      </div>
    </>
  );
}
