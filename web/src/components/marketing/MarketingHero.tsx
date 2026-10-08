import Link from "next/link";
import { InnoraLogo } from "@/components/marketing/InnoraLogo";
import { ProductFrame } from "@/components/marketing/ProductFrame";
import { RackStill } from "@/components/marketing/product-stills";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";

const LABELS = [
  "Front office",
  "Folio",
  "POS",
  "Web booking",
  "DOT assessment",
  "HR and rota",
  "Daily prints",
  "Phone, tablet, laptop",
];

export function MarketingHero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={MARKETING_MEDIA.heroLobby.src}
        alt={MARKETING_MEDIA.heroLobby.alt}
        className="absolute inset-0 h-full w-full object-cover object-[center_22%]"
        fetchPriority="high"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.22 0.03 260 / 0.28) 0%, oklch(0.16 0.03 260 / 0.78) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-end gap-10 px-6 pb-16 pt-28 md:grid-cols-[1fr_1.05fr] md:px-10 md:pb-20">
        <div>
          <InnoraLogo
            variant="light"
            showTagline
            size="xl"
            className="text-white/80"
            wordmarkClassName="text-white"
          />
          <h1 className="mt-8 max-w-xl font-display text-3xl font-medium leading-[1.12] tracking-tight text-white md:text-5xl">
            The operating system for Bhutan hotels
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/80 md:text-lg">
            Desk, folio, POS, and every property you run. Priced in BTN.
            Supported here.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/demo"
              className="inline-flex h-12 items-center rounded-full bg-cta px-8 text-sm font-semibold shadow-lg transition"
            >
              Book a demo
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center rounded-full border border-white/35 bg-white/10 px-8 text-sm font-medium text-white transition hover:bg-white/20"
            >
              See pricing
            </Link>
          </div>
          <div className="mt-8 flex max-w-lg flex-wrap gap-x-4 gap-y-2">
            {LABELS.map((item) => (
              <span
                key={item}
                className="text-[11px] font-medium tracking-wide text-white/70"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
        <ProductFrame url="app.innorahotel.com/erp/calendar">
          <RackStill />
        </ProductFrame>
      </div>
    </section>
  );
}
