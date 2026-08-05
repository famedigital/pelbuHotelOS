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
    // Hold on video slides so the clip can play; photos keep rotating.
    if (slideCount < 2 || paused || activeIsVideo || reduceMotion) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % slideCount);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [slideCount, intervalMs, paused, activeIsVideo, reduceMotion]);

  // Browsers throttle timers in background tabs, which leaves the hero frozen
  // on one frame when the guest comes back. Restart the rotation on return.
  useEffect(() => {
    const onVisibility = () => setPaused(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const settle = reduceMotion
    ? { initial: false as const, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

  // `svh` rather than `vh`: on mobile Safari and Chrome, `100vh` is the
  // viewport with the browser chrome retracted, so a full-height hero gets
  // clipped behind the address bar until you scroll.
  return (
    <section
      className="relative isolate min-h-svh overflow-hidden"
      style={{ backgroundColor: theme.scrimBottom }}
    >
      <div className="absolute inset-0" aria-hidden>
        {safeSlides.map((slide, i) => {
          const isVideo = slide.resourceType === "video";
          return (
            <div
              key={`${slide.publicId}-${i}`}
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
                sizes="100vw"
                cinematic={isVideo}
                active={i === index}
                imgClassName={cn(
                  "object-cover",
                  // Slow drift on photo frames only — video already moves.
                  !isVideo &&
                    !reduceMotion &&
                    "transition-transform duration-[9000ms] ease-linear",
                  !isVideo &&
                    !reduceMotion &&
                    (i === index ? "scale-110" : "scale-100"),
                )}
              />
            </div>
          );
        })}
      </div>

      {/* Overlay colours come from Front Public → home hero theme. */}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: heroScrimGradient(theme) }}
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-svh max-w-[1200px] flex-col justify-end px-5 pb-10 pt-24 md:px-8 md:pb-16 md:pt-32">
        {/* Mobile: booking box first (higher conversion); desktop: copy left, box right. */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-end lg:gap-12">
          <motion.div
            className="order-2 min-w-0 lg:order-1"
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
              className="mt-2 max-w-3xl font-display text-3xl leading-[1.08] sm:text-4xl md:mt-4 md:text-6xl"
              style={{ color: theme.title }}
            >
              {title}
            </h1>

            <p
              className="mt-3 max-w-lg line-clamp-2 text-[15px] leading-relaxed md:mt-5 md:line-clamp-3 md:text-base"
              style={{ color: hexAlpha(theme.body, 0.82) }}
            >
              {description}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-4 md:mt-6">
              <Link
                href={secondaryHref}
                className="inline-flex h-11 items-center rounded-xl border px-5 text-sm font-semibold backdrop-blur-md transition-opacity hover:opacity-95"
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
            className="order-1 w-full lg:order-2 lg:self-end"
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
