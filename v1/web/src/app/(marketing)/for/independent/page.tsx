import Link from "next/link";
import type { Metadata } from "next";
import { MarketingPageBanner } from "@/components/marketing/MarketingPageBanner";
import { CATALOG_PACKAGES, formatBtn } from "@/lib/pricing-catalog";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";

export const metadata: Metadata = {
  title: "Independent hotels",
  description:
    "Innora for single-property hotels in Bhutan — front desk, folio, night audit, and POS.",
  robots: { index: true, follow: true },
};

export default function Page() {
  const classic = CATALOG_PACKAGES.find((pkg) => pkg.code === "classic");
  const plus = CATALOG_PACKAGES.find((pkg) => pkg.code === "plus");

  return (
    <>
      <MarketingPageBanner
        media={MARKETING_MEDIA.segmentIndependent}
        title="One building. One desk."
        description="Front office, the folio, the housekeeping board, and night audit."
      />
      <div className="mx-auto max-w-6xl px-6 py-16 md:px-10">
        <p className="max-w-xl text-lg leading-relaxed">
          Classic includes the front office, the folio, the housekeeping board,
          and night audit.
          {plus ? " Point of sale starts on Plus." : null}
        </p>
        {classic ? (
          <p className="mt-6 max-w-xl text-base text-muted-foreground">
            Classic, {formatBtn(classic.msrpBtnMo)} a month
            {classic.roomMax ? `, up to ${classic.roomMax} rooms` : ""}.
            {plus ? ` Plus, ${formatBtn(plus.msrpBtnMo)} a month, adds POS.` : ""}
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
