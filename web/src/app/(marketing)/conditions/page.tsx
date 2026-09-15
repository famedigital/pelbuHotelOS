import Link from "next/link";
import type { Metadata } from "next";
import { MarketingPageBanner } from "@/components/marketing/MarketingPageBanner";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { CONDITION_RULES, CONDITIONS_VERSION, SUPPORT_HOURS } from "@/lib/conditions";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";

export const metadata: Metadata = {
  title: "Service conditions",
  description:
    "Innora client conditions — payment, fair-use support, authorised contacts, and no-abuse rules.",
  robots: { index: true, follow: true },
};

export default function ConditionsPage() {
  return (
    <>
      <MarketingPageBanner
        media={MARKETING_MEDIA.howOnboard}
        title="Service conditions"
        description={`Version ${CONDITIONS_VERSION}. Accept before go-live. Support hours: ${SUPPORT_HOURS}.`}
      />
      <div className="mx-auto max-w-3xl px-6 py-14 md:px-10">
        <ol className="space-y-8">
          {CONDITION_RULES.map((rule, i) => (
            <MarketingReveal key={rule.title} delay={0.04 * (i + 1)}>
              <li className="border-b border-border pb-8">
                <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                  {i + 1}. {rule.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {rule.body}
                </p>
              </li>
            </MarketingReveal>
          ))}
        </ol>
        <MarketingReveal delay={0.2}>
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
