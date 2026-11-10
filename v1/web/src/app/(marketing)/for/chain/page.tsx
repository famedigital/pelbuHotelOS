import Link from "next/link";
import type { Metadata } from "next";
import { MarketingPageBanner } from "@/components/marketing/MarketingPageBanner";
import { CATALOG_PACKAGES, formatBtn } from "@/lib/pricing-catalog";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";

export const metadata: Metadata = {
  title: "Hotel chains",
  description:
    "Innora for branded multi-property groups in Bhutan — shared standards, separate desks.",
  robots: { index: true, follow: true },
};

export default function Page() {
  const chain = CATALOG_PACKAGES.find((pkg) => pkg.code === "chain");

  return (
    <>
      <MarketingPageBanner
        media={MARKETING_MEDIA.segmentChain}
        title="Shared standards. Separate books."
        description="Each hotel keeps its own rooms, rates, and folios."
      />
      <div className="mx-auto max-w-6xl px-6 py-16 md:px-10">
        <p className="max-w-xl text-lg leading-relaxed">
          A chain runs one way of working, and each property still closes its
          own night.
        </p>
        {chain ? (
          <p className="mt-6 max-w-xl text-base text-muted-foreground">
            Floor price {formatBtn(chain.msrpBtnMo)} a month. Larger groups are
            a custom quote above that.
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
