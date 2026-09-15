import Link from "next/link";
import type { Metadata } from "next";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";

export const metadata: Metadata = {
  title: "Hotel chains",
  description: "Hotel OS for branded multi-property groups in Bhutan.",
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <div className="pt-24">
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <MarketingReveal>
        <h1 className="font-display text-4xl">
          Chains & brands
        </h1>
        <p className="mt-4 text-lg text-[var(--muted)]">
          Shared standards across properties with room to grow. Chain package starts from a clear floor price — custom quote for larger groups.
        </p>
        <div className="mt-10 flex gap-3">
          <Link
            href="/demo"
            className="rounded-md bg-[var(--sky-600)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--sky-700)]"
          >
            Talk to us
          </Link>
          <Link href="/pricing" className="rounded-md border px-5 py-2.5 text-sm transition hover:bg-white">
            See Chain package
          </Link>
        </div>
        </MarketingReveal>
      </div>
    </div>
  );
}
