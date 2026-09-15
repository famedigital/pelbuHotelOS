import Link from "next/link";
import type { Metadata } from "next";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { PricingPackages } from "@/components/marketing/PricingPackages";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Innora packages in BTN — Classic, Plus, Pro, Portfolio, Chain — plus onboarding and desk training fees.",
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
            Packages cover front office, folio, POS, and multi-property modules.
            Prices are in BTN. Service starts only after onboarding and training
            fees are received and you accept our{" "}
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
