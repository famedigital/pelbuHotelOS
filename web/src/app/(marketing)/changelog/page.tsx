import type { Metadata } from "next";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";

export const metadata: Metadata = {
  title: "Changelog",
  robots: { index: true, follow: true },
};

const ENTRIES = [
  {
    date: "2026-09-15",
    title: "Hotel OS platform launch prep",
    body: "Marketing site, pricing, conditions, partner and admin portals for Bhutan channel.",
  },
];

export default function ChangelogPage() {
  return (
    <div className="pt-24">
      <div className="mx-auto max-w-2xl px-6 py-12 md:px-10">
        <MarketingReveal>
          <h1 className="font-display text-3xl">Changelog</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Product evolves on a schedule. Custom one-off requests stay out of
            fair-use support.
          </p>
        </MarketingReveal>
        <ul className="mt-10 space-y-8">
          {ENTRIES.map((e, i) => (
            <MarketingReveal key={e.date} delay={0.06 * (i + 1)}>
              <li className="border-b border-[var(--ink-rule)] pb-6">
                <p className="text-xs text-[var(--muted)]">{e.date}</p>
                <h2 className="mt-1 font-display text-xl">{e.title}</h2>
                <p className="mt-2 text-sm">{e.body}</p>
              </li>
            </MarketingReveal>
          ))}
        </ul>
      </div>
    </div>
  );
}
