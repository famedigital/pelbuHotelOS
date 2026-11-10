import type { Metadata } from "next";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";

export const metadata: Metadata = {
  title: "Changelog",
  robots: { index: true, follow: true },
};

const ENTRIES = [
  {
    date: "2026-08-10",
    title: "Front desk, folio, and night audit",
    body: "Arrivals, check-in, the guest bill, and the close of the business date on one desk.",
  },
  {
    date: "2026-08-10",
    title: "Agent credit",
    body: "Stays that are not paid online sit on the agent’s city ledger.",
  },
  {
    date: "2026-08-10",
    title: "DOT assessment",
    body: "Hotel classification checklist for Trade, DOT, and BFDA, with scores and a print pack.",
  },
] as const;

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 pb-16 pt-28 md:px-10">
      <h1 className="font-display text-4xl tracking-tight">Changelog</h1>
      <p className="mt-4 text-base text-muted-foreground">
        What is on the desk. Custom one-off requests stay out of fair-use support.
      </p>
      <ul className="mt-12">
        {ENTRIES.map((entry, i) => (
          <MarketingReveal key={entry.title} delay={0.06 * (i + 1)}>
            <li className="border-b border-border py-8">
              <p className="text-sm text-primary">{entry.date}</p>
              <h2 className="mt-2 font-display text-xl">{entry.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{entry.body}</p>
            </li>
          </MarketingReveal>
        ))}
      </ul>
    </div>
  );
}
