"use client";

import { HeroBookingSearch } from "@/components/home/HeroBookingSearch";
import { MobileHomeHero } from "@/components/home/MobileHomeHero";
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

/** Desktop cinematic hero; phones use the separate photo-first MobileHomeHero. */
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

  function renderDesktopMedia(slide: HomeHeroSlide, i: number) {
    const isVideo = slide.resourceType === "video";
    const kenBurns = !isVideo && !reduceMotion;
    const fx = slide.focalX ?? 0.5;
    const fy = slide.focalY ?? 0.5;
    const objectPosition = `${fx * 100}% ${fy * 100}%`;
    // Mount active + first (LCP) + neighbors only — cuts carousel bandwidth.
    const near =
      i === 0 ||
      i === index ||
      i === (index + 1) % Math.max(slideCount, 1) ||
      i === (index - 1 + slideCount) % Math.max(slideCount, 1);
    if (!near) return null;

    return (
      <div
        key={`desktop-${slide.publicId}-${i}`}
        className={cn(
          "absolute inset-0 transition-opacity duration-[1400ms] ease-out",
          i === index ? "opacity-100" : "opacity-0",
        )}
      >
        <CloudinaryMedia
          publicId={slide.publicId}
          src={slide.src}
          alt=""
          resourceType={slide.resourceType ?? "image"}
          posterPublicId={slide.posterPublicId}
          fill
          priority={i === 0}
          quality={i === 0 ? 90 : 75}
          disableBlur
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
    <>
      <MobileHomeHero
        slides={safeSlides}
        eyebrow={eyebrow}
        title={title}
        description={description}
        secondaryHref={secondaryHref}
        secondaryLabel={secondaryLabel}
        fromPriceBtn={fromPriceBtn}
        taxInclusive={taxInclusive}
        theme={theme}
        intervalMs={intervalMs}
      />

      <section
        className="relative isolate hidden min-h-svh overflow-hidden md:block"
        style={{ backgroundColor: theme.scrimBottom }}
      >
        <div className="absolute inset-0" aria-hidden>
          {safeSlides.map((slide, i) => renderDesktopMedia(slide, i))}
        </div>

        <div
          className="absolute inset-0"
          style={{ backgroundImage: heroScrimGradient(theme) }}
          aria-hidden
        />

        <div className="relative mx-auto flex min-h-svh max-w-[1200px] flex-col justify-end px-8 pb-20 pt-32">
          <motion.div
            className="max-w-3xl"
            {...settle}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-[0.24em]"
              style={{ color: theme.eyebrow }}
            >
              {eyebrow}
            </p>

            <h1
              className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl lg:text-7xl"
              style={{ color: theme.title }}
            >
              {title}
            </h1>

            <p
              className="mt-5 max-w-lg line-clamp-3 text-base leading-relaxed"
              style={{ color: hexAlpha(theme.body, 0.82) }}
            >
              {description}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/book"
                className="inline-flex h-12 items-center rounded-md bg-ember px-6 text-sm font-semibold text-white transition-all hover:bg-ember-deep motion-safe:hover:-translate-y-0.5"
              >
                Book a stay
              </Link>
              <Link
                href={secondaryHref}
                className="inline-flex h-12 items-center rounded-md border px-5 text-sm font-semibold backdrop-blur-md transition-opacity hover:opacity-95"
                style={{
                  color: theme.button,
                  borderColor: hexAlpha(theme.button, 0.5),
                  backgroundColor: hexAlpha(theme.button, 0.14),
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
                          i === index ? "w-10" : "w-5 hover:opacity-80",
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
                    className="text-xs font-medium tracking-wide"
                    style={{ color: hexAlpha(theme.body, 0.72) }}
                    aria-live="polite"
                  >
                    {safeSlides[index]?.label}
                  </p>
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>
      </section>

      <div className="relative z-10 -mt-8 hidden px-8 md:block">
        <div className="mx-auto max-w-[1200px]">
          <HeroBookingSearch
            variant="bar"
            fromPriceBtn={fromPriceBtn}
            taxInclusive={taxInclusive}
          />
        </div>
      </div>
    </>
  );
}
