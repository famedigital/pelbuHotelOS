import Link from "next/link";
import type { Metadata } from "next";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { CONDITION_RULES, CONDITIONS_VERSION, SUPPORT_HOURS } from "@/lib/conditions";

export const metadata: Metadata = {
  title: "Service conditions",
  description:
    "Innora client conditions — payment, fair-use support, authorised contacts, and no-abuse rules.",
  robots: { index: true, follow: true },
};

export default function ConditionsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 pb-16 pt-28 md:px-10">
      <h1 className="font-display text-4xl tracking-tight">Service conditions</h1>
      <p className="mt-4 text-base text-muted-foreground">
        Version {CONDITIONS_VERSION}. Accept before go-live. Support hours:{" "}
        {SUPPORT_HOURS}.
      </p>
      <ol className="mt-12 space-y-8">
        {CONDITION_RULES.map((rule, i) => (
          <MarketingReveal key={rule.title} delay={0.04 * (i + 1)}>
            <li className="border-b border-border pb-8">
              <p className="font-medium">
                {i + 1}. {rule.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {rule.body}
              </p>
            </li>
          </MarketingReveal>
        ))}
      </ol>
      <div className="mt-10 flex flex-wrap gap-6">
        <Link
          href="/demo"
          className="inline-flex h-12 items-center rounded-full bg-cta px-8 text-sm font-semibold"
        >
          Book a demo
        </Link>
        <Link href="/pricing" className="self-center text-primary">
          Pricing
        </Link>
      </div>
    </div>
  );
}
