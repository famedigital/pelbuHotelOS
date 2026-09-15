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
    <div className="pt-24">
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <MarketingReveal>
          <h1 className="font-display text-4xl">Service conditions</h1>
          <p className="mt-3 text-[var(--muted)]">
            Version {CONDITIONS_VERSION}. You must accept these before go-live.
            Support hours: {SUPPORT_HOURS}.
          </p>
        </MarketingReveal>
        <ol className="mt-10 space-y-8">
          {CONDITION_RULES.map((rule, i) => (
            <MarketingReveal key={rule.title} delay={0.04 * (i + 1)}>
              <li className="border-b border-[var(--ink-rule)] pb-8">
                <p className="text-xs font-semibold tracking-wider text-[var(--sky-600)] uppercase">
                  {i + 1}. {rule.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed">{rule.body}</p>
              </li>
            </MarketingReveal>
          ))}
        </ol>
        <MarketingReveal delay={0.2}>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="rounded-md bg-[var(--sky-600)] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Request demo
            </Link>
            <Link href="/pricing" className="rounded-md border px-5 py-2.5 text-sm">
              Back to pricing
            </Link>
          </div>
        </MarketingReveal>
      </div>
    </div>
  );
}
