import Link from "next/link";
import type { Metadata } from "next";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE_NAME} — Hotel ERP for Bhutan`,
  description:
    "Front desk, folio, POS, and multi-property control for independent hotels, chains, and leased portfolios across Bhutan.",
  robots: { index: true, follow: true },
};

const SEGMENTS: Array<{
  href: string;
  label: string;
  blurb: string;
  primary?: boolean;
}> = [
  {
    href: "/for/leased",
    label: "Leased portfolios",
    blurb: "One owner, many hotels in different places — the most common Bhutan reality.",
    primary: true,
  },
  {
    href: "/for/independent",
    label: "Independent",
    blurb: "One building, clear desk, night audit without spreadsheet chaos.",
  },
  {
    href: "/for/chain",
    label: "Chains",
    blurb: "Same standards across properties, with room to grow.",
  },
];

export default function MarketingHomePage() {
  return (
    <>
      <MarketingHero />

      <section className="mx-auto max-w-5xl px-6 py-20 md:px-10">
        <MarketingReveal>
          <h2 className="font-display text-3xl text-[var(--sky-ink)] md:text-4xl">
            Built for how hotels actually run here
          </h2>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">
            Pick your situation. We price in BTN, train your desk, and require
            clear conditions so support stays fair for everyone.
          </p>
        </MarketingReveal>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {SEGMENTS.map((s, i) => (
            <MarketingReveal key={s.href} delay={0.08 * (i + 1)}>
              <Link
                href={s.href}
                className={`group block border p-6 transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                  s.primary
                    ? "border-[var(--citrus-500)] bg-[var(--citrus-100)]"
                    : "border-[var(--ink-rule)] bg-white"
                }`}
              >
                <p className="text-xs font-semibold tracking-wider text-[var(--sky-600)] uppercase">
                  {s.primary ? "Most common" : "Segment"}
                </p>
                <h3 className="mt-2 font-display text-xl group-hover:text-[var(--sky-700)]">
                  {s.label}
                </h3>
                <p className="mt-2 text-sm text-[var(--muted)]">{s.blurb}</p>
              </Link>
            </MarketingReveal>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--ink-rule)] bg-[var(--frost-1)] px-6 py-16 md:px-10">
        <div className="mx-auto max-w-5xl">
          <MarketingReveal>
            <h2 className="font-display text-2xl md:text-3xl">Why Hotel OS</h2>
            <ul className="mt-6 grid gap-4 text-sm md:grid-cols-2">
              <li className="border-l-2 border-[var(--mint-500)] pl-4">
                Leased multi-hotel owners — one login, many properties
              </li>
              <li className="border-l-2 border-[var(--mint-500)] pl-4">
                BTN pricing and bank AMC with local distributors
              </li>
              <li className="border-l-2 border-[var(--mint-500)] pl-4">
                DOT / BAFRA / ISR compliance tools inside the ERP
              </li>
              <li className="border-l-2 border-[var(--mint-500)] pl-4">
                Training in Bhutan business hours — conditions protect both sides
              </li>
            </ul>
          </MarketingReveal>
        </div>
      </section>
    </>
  );
}
