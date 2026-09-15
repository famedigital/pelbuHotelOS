"use client";

import Link from "next/link";
import { BorderBeam } from "@/components/ui/border-beam";
import { BlurFade } from "@/components/ui/blur-fade";
import { NumberTicker } from "@/components/ui/number-ticker";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import {
  CATALOG_PACKAGES,
  ONE_TIME_FEES,
  type CatalogPackage,
} from "@/lib/pricing-catalog";
import { cn } from "@/lib/utils";

function BtnTicker({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span className="text-sm font-sans font-medium text-[var(--muted)]">BTN</span>
      <NumberTicker value={value} className="font-display tracking-tight text-[var(--sky-ink)]" />
    </span>
  );
}

function PackageCard({ pkg, index }: { pkg: CatalogPackage; index: number }) {
  const featured = pkg.code === "portfolio" || pkg.code === "plus";
  return (
    <BlurFade delay={0.05 * index} inView>
      <article
        className={cn(
          "relative overflow-hidden border bg-white p-6 md:p-8",
          featured
            ? "border-[var(--citrus-500)]"
            : "border-[var(--ink-rule)]",
        )}
      >
        {featured ? (
          <BorderBeam
            size={80}
            duration={8}
            colorFrom="#f59e0b"
            colorTo="#0284c7"
            borderWidth={1.5}
          />
        ) : null}
        <div className="relative flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-[var(--sky-ink)]">{pkg.name}</h2>
            <p className="text-sm text-[var(--muted)]">
              Rooms {pkg.roomMin}
              {pkg.roomMax ? `–${pkg.roomMax}` : "+"}
              {pkg.code === "portfolio"
                ? ` · + BTN ${ONE_TIME_FEES.portfolioFeeMoBtn.toLocaleString("en-BT")}/mo portfolio fee`
                : null}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl text-[var(--sky-700)]">
              <BtnTicker value={pkg.msrpBtnMo} />
              <span className="text-base font-sans text-[var(--muted)]">/mo</span>
            </p>
            <p className="text-sm text-[var(--muted)]">
              or BTN {pkg.msrpBtnYear.toLocaleString("en-BT")}/year
            </p>
          </div>
        </div>
        <div className="relative mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--mint-600)]">
              Includes
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {pkg.includes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--maroon)]">
              Not included
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
              {pkg.notIncluded.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </article>
    </BlurFade>
  );
}

export function PricingPackages() {
  return (
    <div className="space-y-8">
      <BlurFade inView>
        <div className="relative overflow-hidden grid gap-4 rounded-lg border border-[var(--citrus-500)] bg-[var(--citrus-100)] p-6 md:grid-cols-3">
          <BorderBeam size={70} duration={10} colorFrom="#f59e0b" colorTo="#0284c7" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wide">Onboarding</p>
            <p className="mt-1 font-display text-2xl">
              <BtnTicker value={ONE_TIME_FEES.onboardingBtn} />
            </p>
            <p className="text-xs text-[var(--muted)]">One-time per property</p>
          </div>
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wide">Staff training</p>
            <p className="mt-1 font-display text-2xl">
              <BtnTicker value={ONE_TIME_FEES.trainingBtn} />
            </p>
            <p className="text-xs text-[var(--muted)]">
              Up to {ONE_TIME_FEES.trainingSeatsIncluded} staff; BTN{" "}
              {ONE_TIME_FEES.extraTraineeBtn.toLocaleString("en-BT")} each extra
            </p>
          </div>
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wide">
              Extra leased property
            </p>
            <p className="mt-1 font-display text-2xl">
              <BtnTicker value={ONE_TIME_FEES.extraPortfolioPropertySetupBtn} />
            </p>
            <p className="text-xs text-[var(--muted)]">
              Setup under same owner (not full onboarding again)
            </p>
          </div>
        </div>
      </BlurFade>

      {CATALOG_PACKAGES.map((pkg, i) => (
        <PackageCard key={pkg.code} pkg={pkg} index={i} />
      ))}

      <BlurFade delay={0.1} inView>
        <p className="text-sm text-[var(--muted)]">
          Fair-use support ≈ {ONE_TIME_FEES.fairUseHoursMo} hours/month after
          training; then BTN {ONE_TIME_FEES.billableSupportHourBtn.toLocaleString("en-BT")}
          /hour. Distributors may quote at or above catalog MSRP.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/demo" className="inline-flex">
            <ShimmerButton
              type="button"
              background="var(--sky-600)"
              shimmerColor="#ffffff"
              borderRadius="0.375rem"
              className="h-11 px-5 text-sm font-semibold border-transparent"
            >
              Request demo
            </ShimmerButton>
          </Link>
          <Link
            href="/conditions"
            className="inline-flex h-11 items-center rounded-md border border-[var(--ink-rule)] px-5 text-sm"
          >
            Read conditions
          </Link>
        </div>
      </BlurFade>
    </div>
  );
}
