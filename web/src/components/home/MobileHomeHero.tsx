"use client";

import type { HomeHeroSlide } from "@/components/home/HomeHero";
import { useStaySearchOptional } from "@/components/site/PublicStaySearch";
import { CloudinaryMedia } from "@/components/media/CloudinaryMedia";
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
 * Clearance for PublicMobileNav (h-16 + safe-area).
 * MUST keep spaces around `+` — bare `4rem+env(...)` is invalid CSS and
 * browsers drop the whole calc, which pins absolute docks to the top edge.
 */
const TAB_BAR_CLEARANCE =
  "calc(4rem + env(safe-area-inset-bottom, 0px) + 0.75rem)";

type Props = {
  slides: HomeHeroSlide[];
  eyebrow: string;
  title: string;
  description?: string;
  secondaryHref: string;
  secondaryLabel: string;
  fromPriceBtn?: number | null;
  taxInclusive?: boolean;
  theme?: HeroTheme | null;
  intervalMs?: number;
};

/**
 * Phone-first homepage hero: full-viewport photo, copy + slim book dock stacked
 * above the public tab bar. Dock opens the shared stay-search sheet.
 */
export function MobileHomeHero({
  slides,
  eyebrow,
  title,
  description,
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
  const reduceMotion = useReducedMotion();
  const staySearch = useStaySearchOptional();
  const slideCount = safeSlides.length;
  const active = safeSlides[index];
  const activeIsVideo = active?.resourceType === "video";
  const supportLine = description?.trim();

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

  function openBook() {
    staySearch?.openStaySearch({
      fromPriceBtn: fromPriceBtn ?? null,
      taxInclusive: Boolean(taxInclusive),
    });
  }

  return (
    <section
      className="relative isolate flex h-[100dvh] min-h-[100svh] w-full flex-col overflow-hidden md:hidden"
      style={{ backgroundColor: theme.scrimBottom }}
    >
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

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%]"
        style={{
          background: `linear-gradient(to top, ${hexAlpha(theme.scrimBottom, 0.88)} 0%, ${hexAlpha(theme.scrimBottom, 0.35)} 52%, transparent 100%)`,
        }}
        aria-hidden
      />

      <div
        className="relative z-10 mt-auto flex w-full flex-col gap-3 px-5 pt-[max(4.75rem,calc(env(safe-area-inset-top,0px)+3.5rem))]"
        style={{ paddingBottom: TAB_BAR_CLEARANCE }}
      >
        <motion.div
          {...settle}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="min-w-0"
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: theme.eyebrow }}
          >
            {eyebrow}
          </p>
          <h1
            className="mt-2 max-w-[26ch] font-display text-[1.7rem] leading-[1.12] line-clamp-3 [text-wrap:balance]"
            style={{ color: theme.title }}
          >
            {title}
          </h1>
          {supportLine ? (
            <p
              className="mt-2 max-w-[34ch] text-[13px] leading-snug line-clamp-2"
              style={{ color: hexAlpha(theme.title, 0.78) }}
            >
              {supportLine}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Link
              href={secondaryHref}
              className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold backdrop-blur-md transition-opacity hover:opacity-95"
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
                className="flex items-center gap-0.5"
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
                    className="inline-flex min-h-11 min-w-11 items-center justify-center"
                  >
                    <span
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
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </motion.div>

        <button
          type="button"
          onClick={openBook}
          className="flex w-full shrink-0 items-center justify-between gap-3 rounded-xl border border-white/20 bg-sky-ink/95 px-3.5 py-3 text-left text-ivory shadow-[0_10px_32px_-14px_rgba(8,47,73,0.7)] backdrop-blur-md"
          aria-label="Open date search to book stay"
          aria-haspopup="dialog"
        >
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ivory/70">
              Book direct
            </span>
            <span className="mt-0.5 block truncate text-[13px] font-medium leading-snug">
              Check dates · {priceHint}
              {taxInclusive && fromPriceBtn != null && fromPriceBtn > 0
                ? " · inc. tax"
                : ""}
            </span>
          </span>
          <span className="inline-flex h-11 shrink-0 items-center rounded-lg bg-citrus px-4 text-sm font-semibold text-espresso">
            Book
          </span>
        </button>
      </div>
    </section>
  );
}
