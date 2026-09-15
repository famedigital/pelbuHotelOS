import type { Metadata } from "next";
import { MarketingPageBanner } from "@/components/marketing/MarketingPageBanner";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";

export const metadata: Metadata = {
  title: "Changelog",
  robots: { index: true, follow: true },
};

const ENTRIES = [
  {
    date: "2026-09-16",
    title: "Image-led Innora site",
    body: "Bhutanese hospitality photography across marketing pages — no software UI mockups.",
  },
  {
    date: "2026-09-16",
    title: "Innora public site",
    body: "Innora naming, Ocean Breeze + Mews hybrid, and design-to-code marketing narrative.",
  },
  {
    date: "2026-09-15",
    title: "BHO public site rebrand",
    body: "Earlier BHO naming — superseded by Innora.",
  },
  {
    date: "2026-09-15",
    title: "Platform launch prep",
    body: "Marketing site, pricing, conditions, partner and admin portals for Bhutan channel.",
  },
];

export default function ChangelogPage() {
  return (
    <>
      <MarketingPageBanner
        media={MARKETING_MEDIA.kitchenPass}
        title="Changelog"
        description="Product evolves on a schedule. Custom one-off requests stay out of fair-use support."
      />
      <div className="mx-auto max-w-2xl px-6 py-14 md:px-10">
        <ul className="space-y-8">
          {ENTRIES.map((e, i) => (
            <MarketingReveal key={e.date + e.title} delay={0.06 * (i + 1)}>
              <li className="border-b border-border pb-8">
                <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                  {e.date}
                </p>
                <h2 className="mt-2 font-display text-xl">{e.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{e.body}</p>
              </li>
            </MarketingReveal>
          ))}
        </ul>
      </div>
    </>
  );
}
