"use client";

import Link from "next/link";
import { BhoLogo } from "@/components/marketing/BhoLogo";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { BlurFade } from "@/components/ui/blur-fade";
import { Marquee } from "@/components/ui/marquee";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { cn } from "@/lib/utils";

const PROOF = [
  "Front office",
  "Folio & night audit",
  "POS / F&B",
  "Multi-property",
  "BTN pricing",
  "DOT / BAFRA-ready",
];

export function MarketingHero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden bg-[var(--sky-ink)] px-6 pb-16 pt-28 md:px-10 md:pb-24">
      <div
        className="pointer-events-none absolute inset-0 opacity-55"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 90% 65% at 72% 18%, #0284c7 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 15% 80%, #0c4a6e 0%, transparent 60%), linear-gradient(180deg, transparent 35%, #061e2e 100%)",
        }}
      />
      <AnimatedGridPattern
        numSquares={28}
        maxOpacity={0.18}
        duration={3.2}
        className="inset-0 h-full w-full text-sky-100/35 [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]"
      />

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <BlurFade delay={0.05} inView>
          <BhoLogo
            variant="light"
            showFullName
            size="xl"
            wordmarkClassName="text-white"
            className="text-white/75"
          />
        </BlurFade>
        <BlurFade delay={0.18} inView>
          <h1 className="mt-8 max-w-3xl text-xl font-medium leading-snug text-white/95 md:text-3xl">
            Cloud hotel OS for Bhutan — desk, folio, POS, multi-property.
          </h1>
        </BlurFade>
        <BlurFade delay={0.28} inView>
          <p className="mt-4 max-w-xl text-base text-white/70 md:text-lg">
            Run front office the way international PMS systems do, with
            operations built for Bhutan hotels.
          </p>
        </BlurFade>
        <BlurFade delay={0.38} inView>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/demo" className="inline-flex">
              <ShimmerButton
                type="button"
                background="var(--citrus-500)"
                shimmerColor="#082f49"
                borderRadius="0.375rem"
                className="h-11 px-5 text-sm font-semibold text-[var(--sky-ink)] border-transparent"
              >
                Request a demo
              </ShimmerButton>
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center rounded-md border border-white/30 px-5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              See pricing
            </Link>
          </div>
        </BlurFade>
      </div>

      <div className="relative z-10 mx-auto mt-14 w-full max-w-5xl border-t border-white/10 pt-4">
        <Marquee pauseOnHover className="[--duration:28s] [--gap:2rem] p-0">
          {PROOF.map((item) => (
            <span
              key={item}
              className={cn(
                "text-xs font-semibold tracking-[0.18em] text-white/55 uppercase",
              )}
            >
              {item}
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
