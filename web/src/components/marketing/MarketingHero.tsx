"use client";

import Link from "next/link";
import { InnoraLogo } from "@/components/marketing/InnoraLogo";
import { BlurFade } from "@/components/ui/blur-fade";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";

export function MarketingHero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden">
      {/* Full-bleed hero plane */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={MARKETING_MEDIA.heroLobby.src}
        alt={MARKETING_MEDIA.heroLobby.alt}
        className="absolute inset-0 h-full w-full object-cover"
        fetchPriority="high"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.22 0.03 260 / 0.25) 0%, oklch(0.18 0.03 260 / 0.55) 45%, oklch(0.16 0.03 260 / 0.82) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-16 pt-28 md:px-10 md:pb-24">
        <BlurFade delay={0.04} inView>
          <InnoraLogo
            variant="light"
            showTagline
            size="xl"
            className="text-white/80"
            wordmarkClassName="text-white"
          />
        </BlurFade>
        <BlurFade delay={0.14} inView>
          <h1 className="mt-10 max-w-2xl font-display text-3xl font-medium leading-[1.12] tracking-tight text-white md:text-5xl">
            The operating system for Bhutan hotels
          </h1>
        </BlurFade>
        <BlurFade delay={0.24} inView>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/80 md:text-lg">
            Desk, folio, POS, and multi-property — one cloud system with BTN
            pricing and local support.
          </p>
        </BlurFade>
        <BlurFade delay={0.34} inView>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/demo"
              className="inline-flex h-12 items-center rounded-full bg-cta px-8 text-sm font-semibold shadow-lg transition"
            >
              Book a demo
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center rounded-full border border-white/35 bg-white/10 px-8 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
            >
              See pricing
            </Link>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
