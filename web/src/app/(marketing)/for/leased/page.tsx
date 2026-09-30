import Link from "next/link";
import type { Metadata } from "next";
import { MarketingPageBanner } from "@/components/marketing/MarketingPageBanner";
import { CATALOG_PACKAGES, ONE_TIME_FEES, formatBtn } from "@/lib/pricing-catalog";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";

export const metadata: Metadata = {
  title: "Leased hotel portfolios",
  description:
    "One owner, many leased hotels across Bhutan — one Innora account with a property switcher.",
  robots: { index: true, follow: true },
};

export default function Page() {
  const portfolio = CATALOG_PACKAGES.find((pkg) => pkg.code === "portfolio");

  return (
    <>
      <MarketingPageBanner
        media={MARKETING_MEDIA.segmentLeased}
        title="One owner. Many leased hotels."
        description="Each hotel keeps its own rooms, rates, folios, and night audit."
      />
      <div className="mx-auto max-w-6xl px-6 py-16 md:px-10">
        <p className="max-w-xl text-lg leading-relaxed">
          One owner, many hotels. The books do not mix.
        </p>
        {portfolio ? (
          <p className="mt-6 max-w-xl text-base text-muted-foreground">
            {formatBtn(portfolio.msrpBtnMo)} a month per property, plus the
            portfolio fee of {formatBtn(ONE_TIME_FEES.portfolioFeeMoBtn)} a month.
          </p>
        ) : null}
        <div className="mt-10 flex flex-wrap gap-6">
          <Link
            href="/demo"
            className="inline-flex h-12 items-center rounded-full bg-cta px-8 text-sm font-semibold"
          >
            Book a demo
          </Link>
          <Link href="/pricing" className="self-center text-primary">
            See pricing
          </Link>
        </div>
      </div>
    </>
  );
}
