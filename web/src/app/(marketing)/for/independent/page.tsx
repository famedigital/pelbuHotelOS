import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Independent hotels",
  description: "Hotel OS for single-property hotels in Bhutan — desk, folio, night audit.",
  robots: { index: true, follow: true },
};

export default function IndependentPage() {
  return (
    <div className="pt-24">
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <h1 className="font-display text-4xl">Independent hotels</h1>
        <p className="mt-4 text-lg text-[var(--muted)]">
          One building, one desk team. Classic or Plus package — clear
          onboarding, training for your staff, and conditions that keep support
          usable.
        </p>
        <div className="mt-10 flex gap-3">
          <Link
            href="/demo"
            className="rounded-md bg-[var(--sky-600)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Request demo
          </Link>
          <Link href="/pricing" className="rounded-md border px-5 py-2.5 text-sm">
            Pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
