import Link from "next/link";
import {
  CATALOG_PACKAGES,
  ONE_TIME_FEES,
  type CatalogPackage,
} from "@/lib/pricing-catalog";
import { cn } from "@/lib/utils";

function BtnTicker({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span className="text-sm font-sans font-medium text-muted-foreground">BTN</span>
      <span className="font-display tracking-tight text-foreground">
        {value.toLocaleString("en-BT")}
      </span>
    </span>
  );
}

function PackageCard({ pkg }: { pkg: CatalogPackage }) {
  const featured = pkg.code === "portfolio" || pkg.code === "plus";
  return (
    <article
      className={cn(
        "border bg-card p-6 md:p-8",
        featured ? "border-primary" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl">{pkg.name}</h2>
          <p className="text-sm text-muted-foreground">
            Rooms {pkg.roomMin}
            {pkg.roomMax ? `–${pkg.roomMax}` : "+"}
            {pkg.code === "portfolio"
              ? ` · + BTN ${ONE_TIME_FEES.portfolioFeeMoBtn.toLocaleString("en-BT")}/mo portfolio fee`
              : null}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl text-primary">
            <BtnTicker value={pkg.msrpBtnMo} />
            <span className="text-base font-sans text-muted-foreground">/mo</span>
          </p>
          <p className="text-sm text-muted-foreground">
            or BTN {pkg.msrpBtnYear.toLocaleString("en-BT")}/year
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-primary">Includes</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {pkg.includes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-medium">Not included</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {pkg.notIncluded.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

export function PricingPackages() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 rounded-lg border border-border bg-secondary p-6 md:grid-cols-3">
        <div>
          <p className="text-sm font-medium">Onboarding</p>
          <p className="mt-1 font-display text-2xl">
            <BtnTicker value={ONE_TIME_FEES.onboardingBtn} />
          </p>
          <p className="text-xs text-muted-foreground">One-time per property</p>
        </div>
        <div>
          <p className="text-sm font-medium">Staff training</p>
          <p className="mt-1 font-display text-2xl">
            <BtnTicker value={ONE_TIME_FEES.trainingBtn} />
          </p>
          <p className="text-xs text-muted-foreground">
            Up to {ONE_TIME_FEES.trainingSeatsIncluded} staff; BTN{" "}
            {ONE_TIME_FEES.extraTraineeBtn.toLocaleString("en-BT")} each extra
          </p>
        </div>
        <div>
          <p className="text-sm font-medium">Extra leased property</p>
          <p className="mt-1 font-display text-2xl">
            <BtnTicker value={ONE_TIME_FEES.extraPortfolioPropertySetupBtn} />
          </p>
          <p className="text-xs text-muted-foreground">
            Setup under same owner (not full onboarding again)
          </p>
        </div>
      </div>

      {CATALOG_PACKAGES.map((pkg) => (
        <PackageCard key={pkg.code} pkg={pkg} />
      ))}

      <p className="text-sm text-muted-foreground">
        Fair-use support ≈ {ONE_TIME_FEES.fairUseHoursMo} hours/month after
        training; then BTN {ONE_TIME_FEES.billableSupportHourBtn.toLocaleString("en-BT")}
        /hour. Distributors may quote at or above catalog MSRP.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/demo"
          className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Request demo
        </Link>
        <Link
          href="/conditions"
          className="inline-flex h-11 items-center rounded-md border border-border px-5 text-sm"
        >
          Read conditions
        </Link>
      </div>
    </div>
  );
}
