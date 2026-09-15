import Link from "next/link";
import type { Metadata } from "next";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { PricingPackages } from "@/components/marketing/PricingPackages";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Innora packages in BTN — Classic through Chain. Front office, folio, POS, multi-property. Clear onboarding and desk training.",
  robots: { index: true, follow: true },
};

export default function PricingPage() {
  return (
    <div className="pt-24">
      <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
        <MarketingReveal>
          <h1 className="font-display text-4xl tracking-tight text-foreground">
            Innora pricing
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Packages cover the full hotel OS: reservations, folio, POS, and
            multi-property. Prices in BTN. Service starts after onboarding,
            training fees, and{" "}
            <Link href="/conditions" className="underline underline-offset-2">
              conditions
            </Link>
            .
          </p>
        </MarketingReveal>
        <div className="mt-10">
          <PricingPackages />
        </div>
      </div>
    </div>
  );
}
