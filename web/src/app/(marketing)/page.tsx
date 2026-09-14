import Link from "next/link";
import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE_NAME} — Hotel ERP for Bhutan`,
  description:
    "Front desk, folio, POS, and multi-property control for independent hotels, chains, and leased portfolios across Bhutan.",
  robots: { index: true, follow: true },
};

const SEGMENTS: Array<{
  href: string;
  label: string;
  blurb: string;
  primary?: boolean;
}> = [
  {
    href: "/for/leased",
    label: "Leased portfolios",
    blurb: "One owner, many hotels in different places — the most common Bhutan reality.",
    primary: true,
  },
  {
    href: "/for/independent",
    label: "Independent",
    blurb: "One building, clear desk, night audit without spreadsheet chaos.",
  },
  {
    href: "/for/chain",
    label: "Chains",
    blurb: "Same standards across properties, with room to grow.",
  },
];

export default function MarketingHomePage() {
  return (
    <>
      <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden bg-[var(--sky-ink)] px-6 pb-16 pt-28 md:px-10 md:pb-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 60% at 70% 20%, #0284c7 0%, transparent 55%), linear-gradient(180deg, transparent 40%, #082f49 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative z-10 mx-auto w-full max-w-5xl animate-[fadeIn_0.8s_ease-out]">
          <p className="text-xs font-semibold tracking-[0.25em] text-[var(--citrus-soft)] uppercase">
            {SITE_NAME}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.1] text-white md:text-6xl">
            Hotel software for Bhutan hoteliers.
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/80 md:text-lg">
            Run the desk properly — whether you have one hotel or many leased
            locations under one owner.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="rounded-md bg-[var(--citrus-500)] px-5 py-2.5 text-sm font-semibold text-[var(--sky-ink)] transition hover:bg-[var(--citrus-soft)]"
            >
              Request a demo
            </Link>
            <Link
              href="/pricing"
              className="rounded-md border border-white/30 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20 md:px-10">
        <h2 className="font-display text-3xl text-[var(--sky-ink)] md:text-4xl">
          Built for how hotels actually run here
        </h2>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">
          Pick your situation. We price in BTN, train your desk, and require
          clear conditions so support stays fair for everyone.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {SEGMENTS.map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              className={`group block border p-6 transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                s.primary
                  ? "border-[var(--citrus-500)] bg-[var(--citrus-100)]"
                  : "border-[var(--ink-rule)] bg-white"
              }`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <p className="text-xs font-semibold tracking-wider text-[var(--sky-600)] uppercase">
                {s.primary ? "Most common" : "Segment"}
              </p>
              <h3 className="mt-2 font-display text-xl group-hover:text-[var(--sky-700)]">
                {s.label}
              </h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{s.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--ink-rule)] bg-[var(--frost-1)] px-6 py-16 md:px-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-2xl md:text-3xl">Why Hotel OS</h2>
          <ul className="mt-6 grid gap-4 text-sm md:grid-cols-2">
            <li className="border-l-2 border-[var(--mint-500)] pl-4">
              Leased multi-hotel owners — one login, many properties
            </li>
            <li className="border-l-2 border-[var(--mint-500)] pl-4">
              BTN pricing and bank AMC with local distributors
            </li>
            <li className="border-l-2 border-[var(--mint-500)] pl-4">
              DOT / BAFRA / ISR compliance tools inside the ERP
            </li>
            <li className="border-l-2 border-[var(--mint-500)] pl-4">
              Training in Bhutan business hours — conditions protect both sides
            </li>
          </ul>
        </div>
      </section>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
