import Link from "next/link";
import type { Metadata } from "next";
import {
  CATALOG_PACKAGES,
  ONE_TIME_FEES,
  formatBtn,
} from "@/lib/pricing-catalog";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Hotel OS packages in BTN — Classic, Plus, Pro, Portfolio, Chain — plus onboarding and training fees.",
  robots: { index: true, follow: true },
};

export default function PricingPage() {
  return (
    <div className="pt-24">
      <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
        <h1 className="font-display text-4xl text-[var(--sky-ink)]">Pricing</h1>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">
          Clear packages in BTN. Service starts only after onboarding and
          training fees are received and you accept our{" "}
          <Link href="/conditions" className="underline">
            conditions
          </Link>
          .
        </p>

        <div className="mt-8 grid gap-4 rounded-lg border border-[var(--citrus-500)] bg-[var(--citrus-100)] p-6 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide">
              Onboarding
            </p>
            <p className="mt-1 font-display text-2xl">
              {formatBtn(ONE_TIME_FEES.onboardingBtn)}
            </p>
            <p className="text-xs text-[var(--muted)]">One-time per property</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide">
              Staff training
            </p>
            <p className="mt-1 font-display text-2xl">
              {formatBtn(ONE_TIME_FEES.trainingBtn)}
            </p>
            <p className="text-xs text-[var(--muted)]">
              Up to {ONE_TIME_FEES.trainingSeatsIncluded} staff;{" "}
              {formatBtn(ONE_TIME_FEES.extraTraineeBtn)} each extra
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide">
              Extra leased property
            </p>
            <p className="mt-1 font-display text-2xl">
              {formatBtn(ONE_TIME_FEES.extraPortfolioPropertySetupBtn)}
            </p>
            <p className="text-xs text-[var(--muted)]">
              Setup under same owner (not full onboarding again)
            </p>
          </div>
        </div>

        <div className="mt-12 space-y-8">
          {CATALOG_PACKAGES.map((pkg) => (
            <article
              key={pkg.code}
              className="border border-[var(--ink-rule)] bg-white p-6 md:p-8"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl">{pkg.name}</h2>
                  <p className="text-sm text-[var(--muted)]">
                    Rooms {pkg.roomMin}
                    {pkg.roomMax ? `–${pkg.roomMax}` : "+"}
                    {pkg.code === "portfolio"
                      ? ` · + ${formatBtn(ONE_TIME_FEES.portfolioFeeMoBtn)}/mo portfolio fee`
                      : null}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-3xl text-[var(--sky-700)]">
                    {formatBtn(pkg.msrpBtnMo)}
                    <span className="text-base font-sans text-[var(--muted)]">
                      /mo
                    </span>
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    or {formatBtn(pkg.msrpBtnYear)}/year
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
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
          ))}
        </div>

        <p className="mt-10 text-sm text-[var(--muted)]">
          Fair-use support ≈ {ONE_TIME_FEES.fairUseHoursMo} hours/month after
          training; then {formatBtn(ONE_TIME_FEES.billableSupportHourBtn)}/hour.
          Distributors may quote at or above catalog MSRP.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/demo"
            className="rounded-md bg-[var(--sky-600)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--sky-700)]"
          >
            Request demo
          </Link>
          <Link
            href="/conditions"
            className="rounded-md border border-[var(--ink-rule)] px-5 py-2.5 text-sm"
          >
            Read conditions
          </Link>
        </div>
      </div>
    </div>
  );
}
