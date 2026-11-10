import Link from "next/link";
import type { Metadata } from "next";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { PricingPackages } from "@/components/marketing/PricingPackages";
import { ProductFrame } from "@/components/marketing/ProductFrame";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Innora packages in BTN — Classic through Chain. Front office, folio, POS, multi-property. Clear onboarding and desk training.",
  robots: { index: true, follow: true },
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-16 pt-28 md:px-10">
      <h1 className="font-display text-4xl tracking-tight md:text-5xl">
        Packages in BTN, from Classic through Chain
      </h1>
      <MarketingReveal>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Front office, folio, POS, DOT assessment, rota, daily printouts, and a
          booking site on the hotel’s own domain. Service starts after
          onboarding, training fees, and{" "}
          <Link href="/conditions" className="text-primary">
            conditions
          </Link>
          .
        </p>
      </MarketingReveal>
      <div className="mt-10">
        <PricingPackages />
      </div>
      <figure className="mt-16">
        <figcaption className="mb-4 max-w-xl text-muted-foreground">
          The manager board that Classic and the packages above open onto.
        </figcaption>
        <ProductFrame url="app.innorahotel.com">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={MARKETING_MEDIA.screenDesk.src}
            alt={MARKETING_MEDIA.screenDesk.alt}
            className="h-auto w-full"
          />
        </ProductFrame>
      </figure>
      <Link
        href="/demo"
        className="mt-10 inline-flex h-12 items-center rounded-full bg-cta px-8 text-sm font-semibold"
      >
        Book a demo
      </Link>
    </div>
  );
}
