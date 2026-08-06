"use client";

import type { HomeHeroSlide } from "@/components/home/HomeHero";
import { HeroBookingSearch } from "@/components/home/HeroBookingSearch";
import { CloudinaryMedia } from "@/components/media/CloudinaryMedia";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DEFAULT_HERO_THEME,
  hexAlpha,
  type HeroTheme,
} from "@/lib/hero-theme";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Matches PublicMobileNav fixed height (h-16 + safe-area) so docks sit above the tab bar.
 * Keep in sync with `PublicMobileNav` + `BackToTop`.
 */
const TAB_BAR_OFFSET = "4rem+env(safe-area-inset-bottom)";

type Props = {
  slides: HomeHeroSlide[];
  eyebrow: string;
  title: string;
  secondaryHref: string;
  secondaryLabel: string;
  fromPriceBtn?: number | null;
  taxInclusive?: boolean;
  theme?: HeroTheme | null;
  intervalMs?: number;
};

/**
 * Phone-first homepage hero: true full-viewport photo, slim book dock above
 * public tabs. Header Book is suppressed on mobile hero so this dock + tab
 * Book remain the only primary book affordances.
 */
export function MobileHomeHero({
  slides,
  eyebrow,
  title,
  secondaryHref,
  secondaryLabel,
  fromPriceBtn,
  taxInclusive,
  theme: themeProp,
  intervalMs = 6500,
}: Props) {
  const theme = themeProp ?? DEFAULT_HERO_THEME;
  const safeSlides = slides.filter((slide) => slide.src || slide.publicId);
  const [index, setIndex] = useState(0);
  const [bookOpen, setBookOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const slideCount = safeSlides.length;
  const active = safeSlides[index];
  const activeIsVideo = active?.resourceType === "video";

  useEffect(() => {
    if (slideCount < 2 || activeIsVideo || reduceMotion) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % slideCount);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [slideCount, intervalMs, activeIsVideo, reduceMotion]);

  const priceHint =
    fromPriceBtn != null && fromPriceBtn > 0
      ? `From ${formatBtn(fromPriceBtn)}/nt`
      : "Live rates";

  const settle = reduceMotion
    ? { initial: false as const, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

  return (
    <section
      className="relative isolate h-[100dvh] min-h-[100svh] w-full overflow-hidden md:hidden"
      style={{ backgroundColor: theme.scrimBottom }}
    >
      {/* Full-viewport media */}
      <div className="absolute inset-0" aria-hidden>
        {safeSlides.map((slide, i) => {
          const isVideo = slide.resourceType === "video";
          const publicId = slide.mobilePublicId ?? slide.publicId;
          const src = slide.mobileSrc ?? slide.src;
          const fx = slide.mobileFocalX ?? slide.focalX ?? 0.5;
          const fy = slide.mobileFocalY ?? slide.focalY ?? 0.42;
          return (
            <div
              key={`m-${slide.publicId}-${i}`}
              className={cn(
                "absolute inset-0 transition-opacity duration-[1200ms] ease-out",
                i === index ? "opacity-100" : "opacity-0",
              )}
            >
              <CloudinaryMedia
                publicId={publicId}
                src={src}
                alt=""
                resourceType={slide.resourceType ?? "image"}
                posterPublicId={slide.posterPublicId}
                fill
                priority={i === 0}
                quality={92}
                disableBlur
                sizes="100vw"
                cinematic={isVideo}
                active={i === index}
                objectPosition={`${fx * 100}% ${fy * 100}%`}
                imgClassName="object-cover"
              />
            </div>
          );
        })}
      </div>

      {/* Light bottom scrim — photo stays dominant */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[36%]"
        style={{
          background: `linear-gradient(to top, ${hexAlpha(theme.scrimBottom, 0.82)} 0%, ${hexAlpha(theme.scrimBottom, 0.28)} 55%, transparent 100%)`,
        }}
        aria-hidden
      />

      {/* Title + rooms CTA — cleared for header, slim dock, tab bar */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col justify-end px-5"
        style={{
          paddingTop: "max(3rem, calc(env(safe-area-inset-top) + 2.75rem))",
          // Slim dock (~3.25rem) + gap + tab bar
          paddingBottom: `calc(${TAB_BAR_OFFSET} + 3.75rem)`,
        }}
      >
        <motion.div
          {...settle}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.24em]"
            style={{ color: theme.eyebrow }}
          >
            {eyebrow}
          </p>
          <h1
            className="mt-1.5 max-w-[20ch] font-display text-[1.65rem] leading-[1.08] line-clamp-2"
            style={{ color: theme.title }}
            title={title}
          >
            {title}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            <Link
              href={secondaryHref}
              className="inline-flex h-9 items-center rounded-lg border px-3.5 text-xs font-semibold backdrop-blur-md transition-opacity hover:opacity-95"
              style={{
                color: theme.button,
                borderColor: hexAlpha(theme.button, 0.5),
                backgroundColor: hexAlpha(theme.button, 0.14),
              }}
            >
              {secondaryLabel}
            </Link>
            {slideCount > 1 ? (
              <div
                className="flex gap-1.5"
                role="tablist"
                aria-label="Hero media"
              >
                {safeSlides.map((slide, i) => (
                  <button
                    key={`${slide.publicId}-mdot-${i}`}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={slide.label}
                    onClick={() => setIndex(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      i === index ? "w-7" : "w-3",
                    )}
                    style={{
                      backgroundColor:
                        i === index
                          ? theme.accent
                          : hexAlpha(theme.button, 0.4),
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </motion.div>
      </div>

      {/* Slim book dock above PublicMobileNav */}
      <div
        className="absolute inset-x-0 z-10 px-3"
        style={{
          bottom: `calc(${TAB_BAR_OFFSET} + 0.35rem)`,
        }}
      >
        <button
          type="button"
          onClick={() => setBookOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/20 bg-sky-ink/95 px-3.5 py-2.5 text-left text-ivory shadow-[0_10px_32px_-14px_rgba(8,47,73,0.7)] backdrop-blur-md"
          aria-label="Open date search to book stay"
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ivory/70">
              Book direct
            </span>
            <span className="mt-0.5 block truncate text-[13px] font-medium leading-snug">
              Check dates · {priceHint}
              {taxInclusive && fromPriceBtn != null && fromPriceBtn > 0
                ? " · tax"
                : ""}
            </span>
          </span>
          <span className="inline-flex h-10 shrink-0 items-center rounded-lg bg-citrus px-3.5 text-sm font-semibold text-espresso">
            Book
          </span>
        </button>
      </div>

      <Sheet open={bookOpen} onOpenChange={setBookOpen}>
        <SheetContent
          side="bottom"
          className="z-50 max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-bottom)))] rounded-t-2xl border-border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
        >
          <SheetHeader className="pb-1 text-left">
            <SheetTitle className="font-display text-xl">
              When are you staying?
            </SheetTitle>
          </SheetHeader>
          <HeroBookingSearch
            variant="sheet"
            idPrefix="mobile-hero"
            fromPriceBtn={fromPriceBtn}
            taxInclusive={taxInclusive}
          />
        </SheetContent>
      </Sheet>
    </section>
  );
}
