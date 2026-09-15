import Link from "next/link";
import type { Metadata } from "next";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE_NAME} — hotel software for Bhutan`,
  description: SITE_DESCRIPTION,
  robots: { index: true, follow: true },
};

const PROOF = [
  "Front office",
  "Folio & night audit",
  "POS / F&B",
  "Multi-property",
  "BTN pricing",
  "DOT / BAFRA-ready",
];

const MODULES: Array<{
  title: string;
  body: string;
  media: (typeof MARKETING_MEDIA)[keyof typeof MARKETING_MEDIA];
}> = [
  {
    title: "Front desk that runs cleanly",
    body: "Arrivals, room assignment, and guest profiles — hotel-code login so each property stays isolated.",
    media: MARKETING_MEDIA.staffDesk,
  },
  {
    title: "Rooms & folio in one place",
    body: "Stay view, charges, payments, and night audit close without spreadsheet handoffs.",
    media: MARKETING_MEDIA.roomGuest,
  },
  {
    title: "POS that posts to the room",
    body: "Restaurant and outlet orders settle to the folio or the counter — F&B built for hotels.",
    media: MARKETING_MEDIA.foodFnb,
  },
  {
    title: "Ops the team can trust",
    body: "Housekeeping status, training, and fair-use support in Bhutan business hours.",
    media: MARKETING_MEDIA.housekeeping,
  },
];

const HOW: Array<{ step: string; title: string; body: string }> = [
  {
    step: "01",
    title: "Onboard",
    body: "Property setup, rooms, rates, and owner credentials — with your distributor or Fame Digital.",
  },
  {
    step: "02",
    title: "Train",
    body: "Desk training so check-in, folio, and night audit are muscle memory before go-live.",
  },
  {
    step: "03",
    title: "Go live",
    body: "Service starts after fees and conditions. Multi-property owners switch hotels without mixing data.",
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
    blurb: "One owner, many hotels — the most common Bhutan reality.",
    primary: true,
  },
  {
    href: "/for/independent",
    label: "Independent",
    blurb: "One building, clear desk, night audit without chaos.",
  },
  {
    href: "/for/chain",
    label: "Chains",
    blurb: "Shared standards across properties, room to grow.",
  },
];

export default function MarketingHomePage() {
  return (
    <>
      <MarketingHero />

      <section className="border-b border-border bg-background px-6 py-6 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-10 gap-y-2">
          {PROOF.map((item) => (
            <span
              key={item}
              className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase"
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24 md:px-10">
        <MarketingReveal>
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Platform
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl tracking-tight md:text-4xl">
            Everything your hotel needs to run — in one system
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Built like an international cloud PMS, shaped for Bhutan: BTN
            pricing, multi-property owners, and desk workflows that beat
            spreadsheet PMS workarounds.
          </p>
        </MarketingReveal>

        <div className="mt-16 space-y-20">
          {MODULES.map((m, i) => (
            <MarketingReveal key={m.title} delay={0.05 * (i + 1)}>
              <div
                className={`grid items-center gap-10 md:grid-cols-2 md:gap-14 ${
                  i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div className="overflow-hidden rounded-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.media.src}
                    alt={m.media.alt}
                    className="aspect-[4/3] h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div>
                  <h3 className="font-display text-2xl tracking-tight md:text-3xl">
                    {m.title}
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                    {m.body}
                  </p>
                </div>
              </div>
            </MarketingReveal>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-secondary px-6 py-24 md:px-10">
        <div className="mx-auto max-w-6xl">
          <MarketingReveal>
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              How it works
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight md:text-4xl">
              Onboard. Train. Go live.
            </h2>
          </MarketingReveal>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {HOW.map((h, i) => (
              <MarketingReveal key={h.step} delay={0.06 * (i + 1)}>
                <p className="font-mono text-xs tracking-[0.2em] text-primary">
                  {h.step}
                </p>
                <h3 className="mt-4 font-display text-2xl">{h.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {h.body}
                </p>
              </MarketingReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24 md:px-10">
        <MarketingReveal>
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Who it is for
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-tight md:text-4xl">
            Independent, leased, or chain
          </h2>
        </MarketingReveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {SEGMENTS.map((s, i) => (
            <MarketingReveal key={s.href} delay={0.06 * (i + 1)}>
              <Link
                href={s.href}
                className={
                  s.primary
                    ? "block rounded-2xl border border-primary/30 bg-secondary p-6 transition hover:-translate-y-0.5 hover:shadow-md"
                    : "block rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-md"
                }
              >
                <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                  {s.primary ? "Most common" : "Segment"}
                </p>
                <h3 className="mt-3 font-display text-xl">{s.label}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.blurb}</p>
              </Link>
            </MarketingReveal>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-secondary/80 px-6 py-20 md:px-10">
        <div className="mx-auto max-w-6xl">
          <MarketingReveal>
            <h2 className="font-display text-2xl tracking-tight md:text-3xl">
              Why Innora
            </h2>
            <ul className="mt-8 grid gap-5 text-sm md:grid-cols-2">
              <li className="border-l-2 border-primary pl-4 text-muted-foreground">
                <span className="text-foreground">Hotel-code multi-tenant</span>{" "}
                — each property isolated, owners switch cleanly
              </li>
              <li className="border-l-2 border-primary pl-4 text-muted-foreground">
                <span className="text-foreground">BTN pricing</span> and local
                distributors — not USD-only SaaS
              </li>
              <li className="border-l-2 border-primary pl-4 text-muted-foreground">
                <span className="text-foreground">Desk + folio + POS</span> in
                one product, not bolted modules
              </li>
              <li className="border-l-2 border-primary pl-4 text-muted-foreground">
                <span className="text-foreground">DOT / BAFRA-ready</span>{" "}
                tooling inside the ERP
              </li>
            </ul>
          </MarketingReveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24 md:px-10">
        <MarketingReveal>
          <h2 className="font-display text-3xl tracking-tight md:text-4xl">
            See Innora on your hotels
          </h2>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Book a walkthrough, or review packages in BTN before you commit.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="inline-flex h-12 items-center rounded-full bg-cta px-8 text-sm font-semibold transition"
            >
              Book a demo
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center rounded-full border border-border bg-card px-8 text-sm font-medium transition hover:bg-secondary"
            >
              Pricing
            </Link>
          </div>
        </MarketingReveal>
      </section>
    </>
  );
}
