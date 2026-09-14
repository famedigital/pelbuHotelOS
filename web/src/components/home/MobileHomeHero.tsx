"use client";

import type { HomeHeroSlide } from "@/components/home/HomeHero";
import { HeroBookingSearch } from "@/components/home/HeroBookingSearch";
import { CloudinaryMedia } from "@/components/media/CloudinaryMedia";
import {
  DEFAULT_HERO_THEME,
  hexAlpha,
  type HeroTheme,
} from "@/lib/hero-theme";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

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
 * Phone-first homepage hero: full-bleed photo + copy, then a real booking
 * search dock under the fold (same fields as desktop).
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

  const settle = reduceMotion
    ? { initial: false as const, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="md:hidden">
      <section
        className="relative isolate flex min-h-[100svh] w-full flex-col overflow-hidden"
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
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%]"
          style={{
            background: `linear-gradient(to top, ${hexAlpha(theme.scrimBottom, 0.9)} 0%, ${hexAlpha(theme.scrimBottom, 0.4)} 55%, transparent 100%)`,
          }}
          aria-hidden
        />

        <div className="relative z-10 mt-auto flex w-full flex-col gap-3 px-5 pb-8 pt-[max(4.75rem,calc(env(safe-area-inset-top,0px)+3.5rem))]">
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
              className="mt-2 max-w-[26ch] font-display text-[1.85rem] font-semibold leading-[1.1] tracking-tight line-clamp-3 [text-wrap:balance]"
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
                href="/book"
                className="inline-flex min-h-11 items-center rounded-md bg-ember px-4 text-sm font-semibold text-white transition-transform hover:bg-ember-deep motion-safe:hover:-translate-y-0.5"
              >
                Book now
              </Link>
              <Link
                href={secondaryHref}
                className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-semibold backdrop-blur-md transition-opacity hover:opacity-95"
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
        </div>
      </section>

      <div className="relative z-20 -mt-5 px-4 pb-6">
        <HeroBookingSearch
          variant="card"
          idPrefix="mhero"
          fromPriceBtn={fromPriceBtn}
          taxInclusive={taxInclusive}
          className="border-cedar-rule shadow-[0_18px_48px_-24px_rgba(18,26,23,0.4)]"
        />
      </div>
    </div>
  );
}
