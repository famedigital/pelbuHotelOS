"use client";

import Link from "next/link";
import { InnoraLogo } from "@/components/marketing/InnoraLogo";
import { BlurFade } from "@/components/ui/blur-fade";
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
    <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden bg-background px-6 pb-16 pt-28 md:px-10 md:pb-24">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 90% 70% at 80% 0%, oklch(0.92 0.06 163) 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 10% 90%, oklch(0.94 0.04 236) 0%, transparent 50%), linear-gradient(180deg, oklch(0.99 0.01 244) 0%, oklch(0.97 0.02 200) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute -right-24 top-20 size-[28rem] rounded-full opacity-40 blur-3xl"
        style={{ background: "oklch(0.85 0.12 149)" }}
      />

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <BlurFade delay={0.04} inView>
          <InnoraLogo showTagline size="xl" wordmarkClassName="text-foreground" />
        </BlurFade>
        <BlurFade delay={0.14} inView>
          <h1 className="mt-10 max-w-2xl font-display text-3xl font-medium leading-[1.15] tracking-tight text-foreground md:text-5xl">
            Run the desk properly — one hotel or many.
          </h1>
        </BlurFade>
        <BlurFade delay={0.24} inView>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
            Front office, folio, POS, and multi-property control built for Bhutan
            hotels — with BTN pricing and local support.
          </p>
        </BlurFade>
        <BlurFade delay={0.34} inView>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/demo"
              className="inline-flex h-12 items-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-90"
            >
              Request a demo
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center rounded-full border border-border bg-card/80 px-7 text-sm font-medium text-foreground backdrop-blur transition hover:bg-card"
            >
              See pricing
            </Link>
          </div>
        </BlurFade>
      </div>

      <div className="relative z-10 mx-auto mt-16 w-full max-w-5xl border-t border-border/80 pt-5">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          {PROOF.map((item) => (
            <span
              key={item}
              className={cn(
                "text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase",
              )}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
