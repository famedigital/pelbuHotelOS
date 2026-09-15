import Link from "next/link";
import type { Metadata } from "next";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";

export const metadata: Metadata = {
  title: "Leased hotel portfolios",
  description:
    "One owner, many leased hotels across Bhutan — one Innora account with a property switcher.",
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <div className="pt-24">
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <MarketingReveal>
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Most common in Bhutan
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight">
            One owner. Many leased hotels.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            You lease or operate hotels in different locations — often under
            different trade names. Innora gives you one owner account and a desk
            for each property. Switch location without mixing folios, rates, or
            staff.
          </p>
          <ul className="mt-8 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Separate rates, rooms, and night audit per property</li>
            <li>Cheaper setup for each extra location under the same owner</li>
            <li>Portfolio package pricing on the pricing page</li>
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
            >
              Request demo
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center rounded-full border border-border bg-card px-6 text-sm"
            >
              Portfolio pricing
            </Link>
          </div>
        </MarketingReveal>
      </div>
    </div>
  );
}
