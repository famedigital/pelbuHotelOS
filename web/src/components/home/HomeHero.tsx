"use client";

import { HeroBookingSearch } from "@/components/home/HeroBookingSearch";
import { CloudinaryMedia } from "@/components/media/CloudinaryMedia";
import { type HeroSlide } from "@/lib/brand";
import type { CloudinaryResourceType } from "@/lib/cloudinary";
import {
  DEFAULT_HERO_THEME,
  heroScrimGradient,
  hexAlpha,
  type HeroTheme,
} from "@/lib/hero-theme";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

export type HomeHeroSlide = HeroSlide & {
  src?: string;
  resourceType?: CloudinaryResourceType;
  posterPublicId?: string | null;
  /** Pre-resolved portrait mobile URL when dual art-direction is used. */
  mobileSrc?: string;
  mobilePublicId?: string;
  /** 0–1 focus for desktop crop (object-position). */
  focalX?: number;
  focalY?: number;
  /** 0–1 focus for mobile tall frame. */
  mobileFocalX?: number;
  mobileFocalY?: number;
};

type Props = {
  slides: HomeHeroSlide[];
  eyebrow: string;
  title: string;
  description: string;
  secondaryHref: string;
  secondaryLabel: string;
  /** Lowest room-only rack for the current season — shown on the search card. */
  fromPriceBtn?: number | null;
  taxInclusive?: boolean;
  /** From Front Public → home hero colours. */
  theme?: HeroTheme | null;
  intervalMs?: number;
};

/** Cinematic homepage hero with Airbnb-style stay search on the conversion side. */
export function HomeHero({
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
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const slideCount = safeSlides.length;
  const active = safeSlides[index];
  const activeIsVideo = active?.resourceType === "video";

  useEffect(() => {
    if (slideCount < 2 || paused || activeIsVideo || reduceMotion) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % slideCount);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [slideCount, intervalMs, paused, activeIsVideo, reduceMotion]);

  useEffect(() => {
    const onVisibility = () => setPaused(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const settle = reduceMotion
    ? { initial: false as const, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

  function renderMedia(
    slide: HomeHeroSlide,
    i: number,
    mode: "desktop" | "mobile",
  ) {
    const isVideo = slide.resourceType === "video";
    const publicId =
      mode === "mobile" && slide.mobilePublicId
        ? slide.mobilePublicId
        : slide.publicId;
    const src =
      mode === "mobile" && slide.mobileSrc
        ? slide.mobileSrc
        : slide.src;
    // Light pan only — heavy scale-110 forced low-res zoom and looked soft.
    const kenBurns =
      !isVideo && !reduceMotion && mode === "desktop";

    const fx =
      mode === "mobile"
        ? (slide.mobileFocalX ?? slide.focalX ?? 0.5)
        : (slide.focalX ?? 0.5);
    const fy =
      mode === "mobile"
        ? (slide.mobileFocalY ?? slide.focalY ?? 0.42)
        : (slide.focalY ?? 0.5);
    const objectPosition = `${fx * 100}% ${fy * 100}%`;

    return (
      <div
        key={`${mode}-${slide.publicId}-${i}`}
        className={cn(
          "absolute inset-0 transition-opacity duration-[1400ms] ease-out",
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
          quality={mode === "mobile" ? 92 : 95}
          disableBlur
          /* Full viewport CSS size — next/image multiplies by DPR for dense srcset. */
          sizes="100vw"
          cinematic={isVideo}
          active={i === index}
          objectPosition={objectPosition}
          imgClassName={cn(
            "object-cover",
            kenBurns && "transition-transform duration-[12000ms] ease-linear",
            kenBurns && (i === index ? "scale-[1.04]" : "scale-100"),
          )}
        />
      </div>
    );
  }

  return (
    <section
      className="relative isolate min-h-svh overflow-hidden"
      style={{ backgroundColor: theme.scrimBottom }}
    >
      {/* Desktop landscape hero stack */}
      <div className="absolute inset-0 hidden md:block" aria-hidden>
        {safeSlides.map((slide, i) => renderMedia(slide, i, "desktop"))}
      </div>
      {/* Mobile portrait hero stack */}
      <div className="absolute inset-0 md:hidden" aria-hidden>
        {safeSlides.map((slide, i) => renderMedia(slide, i, "mobile"))}
      </div>

      <div
        className="absolute inset-0"
        style={{ backgroundImage: heroScrimGradient(theme) }}
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-svh max-w-[1200px] flex-col justify-end px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-24 sm:pb-10 md:px-8 md:pb-16 md:pt-32">
        <div className="grid gap-3 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-end lg:gap-12">
          <motion.div
            className="order-1 min-w-0 lg:order-1"
            {...settle}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.24em] sm:text-xs"
              style={{ color: theme.eyebrow }}
            >
              {eyebrow}
            </p>

            <h1
              className="mt-1.5 max-w-3xl font-display text-[1.65rem] leading-[1.08] sm:mt-2 sm:text-4xl md:mt-4 md:text-6xl"
              style={{ color: theme.title }}
            >
              {title}
            </h1>

            <p
              className="mt-3 hidden max-w-lg line-clamp-3 text-base leading-relaxed md:mt-5 md:block"
              style={{ color: hexAlpha(theme.body, 0.82) }}
            >
              {description}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-4 sm:gap-4 md:mt-6">
              <Link
                href={secondaryHref}
                className="inline-flex h-9 items-center rounded-xl border px-4 text-xs font-semibold backdrop-blur-md transition-opacity hover:opacity-95 sm:h-11 sm:px-5 sm:text-sm"
                style={{
                  color: theme.button,
                  borderColor: hexAlpha(theme.button, 0.5),
                  backgroundColor: hexAlpha(theme.button, 0.14),
                  boxShadow: `inset 0 1px 0 0 ${hexAlpha(theme.button, 0.28)}, 0 8px 24px -12px ${hexAlpha(theme.scrimBottom, 0.55)}`,
                }}
              >
                {secondaryLabel}
              </Link>

              {slideCount > 1 ? (
                <div className="flex items-center gap-3">
                  <div
                    className="flex gap-1.5"
                    role="tablist"
                    aria-label="Hero media"
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                  >
                    {safeSlides.map((slide, i) => (
                      <button
                        key={`${slide.publicId}-dot-${i}`}
                        type="button"
                        role="tab"
                        aria-selected={i === index}
                        aria-label={slide.label}
                        onClick={() => setIndex(i)}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          i === index ? "w-8 sm:w-10" : "w-4 sm:w-5 hover:opacity-80",
                        )}
                        style={{
                          backgroundColor:
                            i === index
                              ? theme.accent
                              : hexAlpha(theme.button, 0.35),
                        }}
                      />
                    ))}
                  </div>
                  <p
                    className="hidden text-xs font-medium tracking-wide sm:block"
                    style={{ color: hexAlpha(theme.body, 0.72) }}
                    aria-live="polite"
                  >
                    {safeSlides[index]?.label}
                  </p>
                </div>
              ) : null}
            </div>
          </motion.div>

          <motion.div
            className="order-2 w-full lg:self-end"
            {...settle}
            transition={{ duration: 0.55, ease: "easeOut", delay: 0.08 }}
          >
            <HeroBookingSearch
              fromPriceBtn={fromPriceBtn}
              taxInclusive={taxInclusive}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
