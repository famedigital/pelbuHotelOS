import Link from "next/link";
import { InnoraLogo } from "@/components/marketing/InnoraLogo";
import { ProductFrame } from "@/components/marketing/ProductFrame";
import { RackStill } from "@/components/marketing/product-stills";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";
import { ArrowRight, Sparkles, KeyRound } from "lucide-react";

const LABELS = [
  "Front Office StayView",
  "Dynamic Folio Split",
  "Dining Till POS",
  "OTA Channel Sync",
  "DOT Star Assessment",
  "HR & Biometric Rota",
  "Gapless DRC Invoicing",
  "Laptop, Tablet & Phone",
];

export function MarketingHero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden">
      {/* Authentic Bhutanese Lobby Image Backdrop */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={MARKETING_MEDIA.heroLobby.src}
        alt={MARKETING_MEDIA.heroLobby.alt}
        className="absolute inset-0 h-full w-full object-cover object-[center_24%]"
        fetchPriority="high"
      />
      {/* High-Contrast Twilight Gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(6, 11, 20, 0.42) 0%, rgba(6, 11, 20, 0.88) 75%, rgba(6, 11, 20, 0.98) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-end gap-10 px-6 pb-16 pt-32 md:grid-cols-[1fr_1.1fr] md:px-10 md:pb-20">
        <div>
          {/* Top Status Pill */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-3.5 py-1 text-xs font-semibold text-amber-300 backdrop-blur-md">
            <Sparkles className="size-3.5" />
            <span>DRC Tax Invoicing & BAFRA Compliant · Priced in BTN</span>
          </div>

          <InnoraLogo
            variant="light"
            showTagline
            size="xl"
            className="text-white/80"
            wordmarkClassName="text-white"
          />

          <h1 className="mt-6 max-w-xl font-display text-3xl font-medium leading-[1.12] tracking-tight text-white md:text-5xl">
            The operating system for Bhutan hotels
          </h1>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/85 md:text-lg">
            Front desk stayview, dynamic folios, F&B point of sale, travel agent
            city ledgers, and DOT star classification compliance. Built in Bhutan,
            priced in BTN, supported locally.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/demo"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground shadow-xl transition-all duration-200 hover:bg-primary/90 active:scale-[0.98]"
            >
              <span>Book a Live Demo</span>
              <ArrowRight className="size-4" />
            </Link>

            <Link
              href="/login"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20 active:scale-[0.98]"
            >
              <KeyRound className="size-4 text-amber-300" />
              <span>Portal Sign In</span>
            </Link>
          </div>

          {/* Feature Badges */}
          <div className="mt-8 flex max-w-lg flex-wrap gap-x-4 gap-y-2 border-t border-white/10 pt-4">
            {LABELS.map((item) => (
              <span
                key={item}
                className="text-[11px] font-medium tracking-wide text-white/70"
              >
                ✓ {item}
              </span>
            ))}
          </div>
        </div>

        {/* Live Product Frame Preview */}
        <div className="relative">
          <div
            className="pointer-events-none absolute -inset-2 rounded-3xl blur-2xl opacity-30"
            style={{
              background:
                "radial-gradient(circle, #059669 0%, #d97706 100%)",
            }}
            aria-hidden
          />
          <div className="relative overflow-hidden rounded-2xl border border-white/20 shadow-2xl backdrop-blur-xl">
            <ProductFrame url="app.innorahotel.com/erp/stayview">
              <RackStill />
            </ProductFrame>
          </div>
        </div>
      </div>
    </section>
  );
}
