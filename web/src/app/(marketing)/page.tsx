import Link from "next/link";
import type { Metadata } from "next";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { SITE_DESCRIPTION, SITE_FULL_NAME, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE_NAME} — ${SITE_FULL_NAME}`,
  description: SITE_DESCRIPTION,
  robots: { index: true, follow: true },
};

const MODULES: Array<{ title: string; body: string }> = [
  {
    title: "Front office & reservations",
    body: "Arrivals, departures, room assignment, and stay view — the desk workflow hotels expect from a cloud PMS.",
  },
  {
    title: "Folio & night audit",
    body: "Guest folios, charges, payments, and night audit close so daily revenue posts cleanly.",
  },
  {
    title: "POS / F&B",
    body: "Outlet orders that post to the room folio or settle at the counter — restaurant, café, and bar.",
  },
  {
    title: "Multi-property / portfolio",
    body: "One owner account, separate properties. Switch hotels without mixing rates, staff, or folios.",
  },
  {
    title: "Reporting & compliance",
    body: "Operational reports plus DOT / BAFRA-ready tooling inside the ERP — factual checklists, not slogans.",
  },
];

const HOW: Array<{ step: string; title: string; body: string }> = [
  {
    step: "01",
    title: "Onboard",
    body: "Property setup, rooms, rates, and staff access — with your distributor or Fame Digital.",
  },
  {
    step: "02",
    title: "Train",
    body: "Desk training in Bhutan business hours so the team can run check-in, folio, and night audit.",
  },
  {
    step: "03",
    title: "Go live",
    body: "Service starts after onboarding fees and conditions acceptance. Support stays fair-use.",
  },
];

const SEGMENTS: Array<{
  href: string;
  label: string;
  blurb: string;
  primary?: boolean;
}> = [
  {
    href: "/for/leased",
    label: "Leased portfolios",
    blurb:
      "One owner, many hotels in different places — the most common Bhutan reality.",
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
    blurb: "Shared standards across properties, with room to grow.",
  },
];

export default function MarketingHomePage() {
  return (
    <>
      <MarketingHero />

      <section className="mx-auto max-w-5xl px-6 py-20 md:px-10">
        <MarketingReveal>
          <h2 className="font-display text-3xl text-[var(--sky-ink)] md:text-4xl">
            Modules that run the hotel
          </h2>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">
            The same product categories you see in international cloud PMS —
            wired for Bhutan operations.
          </p>
        </MarketingReveal>
        <div className="mt-12 space-y-0 border-t border-[var(--ink-rule)]">
          {MODULES.map((m, i) => (
            <MarketingReveal key={m.title} delay={0.05 * (i + 1)}>
              <div className="grid gap-3 border-b border-[var(--ink-rule)] py-7 md:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] md:gap-10">
                <h3 className="font-display text-xl text-[var(--sky-ink)]">
                  {m.title}
                </h3>
                <p className="text-sm leading-relaxed text-[var(--muted)] md:text-base">
                  {m.body}
                </p>
              </div>
            </MarketingReveal>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--ink-rule)] bg-[var(--frost-1)] px-6 py-20 md:px-10">
        <div className="mx-auto max-w-5xl">
          <MarketingReveal>
            <h2 className="font-display text-3xl text-[var(--sky-ink)] md:text-4xl">
              How it works
            </h2>
            <p className="mt-3 max-w-2xl text-[var(--muted)]">
              Onboard, train, go live — clear steps before the desk depends on
              the system.
            </p>
          </MarketingReveal>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {HOW.map((h, i) => (
              <MarketingReveal key={h.step} delay={0.08 * (i + 1)}>
                <p className="font-mono text-xs tracking-[0.2em] text-[var(--sky-600)]">
                  {h.step}
                </p>
                <h3 className="mt-3 font-display text-2xl text-[var(--sky-ink)]">
                  {h.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                  {h.body}
                </p>
              </MarketingReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20 md:px-10">
        <MarketingReveal>
          <h2 className="font-display text-3xl text-[var(--sky-ink)] md:text-4xl">
            Who BHO is for
          </h2>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">
            Independent hotels, leased multi-location owners, and branded
            chains — pick your situation.
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
            <h2 className="font-display text-2xl md:text-3xl">Why BHO</h2>
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
                Training in Bhutan business hours — conditions protect both
                sides
              </li>
            </ul>
          </MarketingReveal>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20 md:px-10">
        <MarketingReveal>
          <h2 className="font-display text-3xl text-[var(--sky-ink)] md:text-4xl">
            See BHO on your hotels
          </h2>
          <p className="mt-3 max-w-xl text-[var(--muted)]">
            Request a walkthrough, or review packages in BTN before you commit.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="rounded-md bg-[var(--sky-600)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--sky-700)]"
            >
              Request a demo
            </Link>
            <Link
              href="/pricing"
              className="rounded-md border border-[var(--ink-rule)] px-5 py-2.5 text-sm transition hover:bg-white"
            >
              Pricing
            </Link>
          </div>
        </MarketingReveal>
      </section>
    </>
  );
}
