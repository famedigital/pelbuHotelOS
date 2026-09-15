import Link from "next/link";
import type { Metadata } from "next";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";

export const metadata: Metadata = {
  title: "Leased hotel portfolios",
  description:
    "One owner, many leased hotels across Bhutan — one BHO account with a property switcher.",
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <div className="pt-24">
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <MarketingReveal>
          <p className="text-xs font-semibold tracking-[0.2em] text-[var(--citrus-600)] uppercase">
            Most common in Bhutan
          </p>
          <h1 className="mt-3 font-display text-4xl">
            One owner. Many leased hotels.
          </h1>
          <p className="mt-4 text-lg text-[var(--muted)]">
            You lease or operate hotels in different locations — often under
            different trade names. BHO gives you one owner account and a desk
            for each property. Switch location without mixing folios, rates, or
            staff.
          </p>
          <ul className="mt-8 list-disc space-y-2 pl-5 text-sm">
            <li>Separate rates, rooms, and night audit per property</li>
            <li>Cheaper setup for each extra location under the same owner</li>
            <li>Portfolio package pricing on the pricing page</li>
          </ul>
          <div className="mt-10 flex gap-3">
            <Link
              href="/demo"
              className="rounded-md bg-[var(--sky-600)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--sky-700)]"
            >
              Request demo
            </Link>
            <Link
              href="/pricing"
              className="rounded-md border px-5 py-2.5 text-sm transition hover:bg-white"
            >
              Portfolio pricing
            </Link>
          </div>
        </MarketingReveal>
      </div>
    </div>
  );
}
