import Link from "next/link";
import type { Metadata } from "next";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";

export const metadata: Metadata = {
  title: "Hotel chains",
  description:
    "Innora for branded multi-property groups in Bhutan — shared standards, separate desks.",
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <div className="pt-24">
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <MarketingReveal>
          <h1 className="font-display text-4xl tracking-tight">
            Chains & brands
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Shared operating standards across properties with room to grow. Each
            hotel keeps its own rooms, rates, and folios; the group gets one
            owner view. Chain package starts from a clear floor price — custom
            quote for larger groups.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="inline-flex h-11 items-center rounded-full bg-cta px-6 text-sm font-semibold"
            >
              Book a demo
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center rounded-full border border-border bg-card px-6 text-sm"
            >
              See Chain package
            </Link>
          </div>
        </MarketingReveal>
      </div>
    </div>
  );
}
