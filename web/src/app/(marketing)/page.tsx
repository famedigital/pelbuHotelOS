import Link from "next/link";
import type { Metadata } from "next";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE_NAME} — hotel software for Bhutan`,
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

      <section className="mx-auto max-w-5xl px-6 py-24 md:px-10">
        <MarketingReveal>
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Modules
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-foreground md:text-4xl">
            Everything the hotel needs to run
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            The same product categories you see in international cloud PMS —
            wired for Bhutan operations.
          </p>
        </MarketingReveal>
        <div className="mt-14 space-y-0 border-t border-border">
          {MODULES.map((m, i) => (
            <MarketingReveal key={m.title} delay={0.04 * (i + 1)}>
              <div className="grid gap-3 border-b border-border py-8 md:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] md:gap-12">
                <h3 className="font-display text-xl text-foreground md:text-2xl">
                  {m.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                  {m.body}
                </p>
              </div>
            </MarketingReveal>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-secondary/50 px-6 py-24 md:px-10">
        <div className="mx-auto max-w-5xl">
          <MarketingReveal>
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              How it works
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight md:text-4xl">
              Onboard. Train. Go live.
            </h2>
          </MarketingReveal>
          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {HOW.map((h, i) => (
              <MarketingReveal key={h.step} delay={0.06 * (i + 1)}>
                <p className="font-mono text-xs tracking-[0.2em] text-primary">
                  {h.step}
                </p>
                <h3 className="mt-4 font-display text-2xl text-foreground">
                  {h.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {h.body}
                </p>
              </MarketingReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-24 md:px-10">
        <MarketingReveal>
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Who it is for
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-tight md:text-4xl">
            Built for how hotels actually run here
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Independent hotels, leased multi-location owners, and branded
            chains.
          </p>
        </MarketingReveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {SEGMENTS.map((s, i) => (
            <MarketingReveal key={s.href} delay={0.06 * (i + 1)}>
              <Link href={s.href} className={segmentClass(s.primary)}>
                <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                  {s.primary ? "Most common" : "Segment"}
                </p>
                <h3 className="mt-3 font-display text-xl text-foreground">
                  {s.label}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {s.blurb}
                </p>
              </Link>
            </MarketingReveal>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-accent/40 px-6 py-20 md:px-10">
        <div className="mx-auto max-w-5xl">
          <MarketingReveal>
            <h2 className="font-display text-2xl tracking-tight md:text-3xl">
              Why Innora
            </h2>
            <ul className="mt-8 grid gap-5 text-sm md:grid-cols-2">
              <li className="border-l-2 border-primary pl-4 text-muted-foreground">
                <span className="text-foreground">
                  Leased multi-hotel owners
                </span>{" "}
                — one login, many properties
              </li>
              <li className="border-l-2 border-primary pl-4 text-muted-foreground">
                <span className="text-foreground">BTN pricing</span> and bank
                AMC with local distributors
              </li>
              <li className="border-l-2 border-primary pl-4 text-muted-foreground">
                <span className="text-foreground">DOT / BAFRA / ISR</span>{" "}
                compliance tools inside the ERP
              </li>
              <li className="border-l-2 border-primary pl-4 text-muted-foreground">
                <span className="text-foreground">Training</span> in Bhutan
                business hours — conditions protect both sides
              </li>
            </ul>
          </MarketingReveal>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-24 md:px-10">
        <MarketingReveal>
          <h2 className="font-display text-3xl tracking-tight text-foreground md:text-4xl">
            See Innora on your hotels
          </h2>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Request a walkthrough, or review packages in BTN before you commit.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="inline-flex h-12 items-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-90"
            >
              Request a demo
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center rounded-full border border-border bg-card px-7 text-sm font-medium transition hover:bg-secondary"
            >
              Pricing
            </Link>
          </div>
        </MarketingReveal>
      </section>
    </>
  );
}

function segmentClass(primary?: boolean) {
  return primary
    ? "group block rounded-2xl border border-primary/40 bg-accent/50 p-6 transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
    : "group block rounded-2xl border border-border bg-card p-6 transition duration-300 hover:-translate-y-0.5 hover:shadow-md";
}
