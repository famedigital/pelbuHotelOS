"use client";

import { HeroBookingSearch } from "@/components/home/HeroBookingSearch";
import { CloudinaryMedia } from "@/components/media/CloudinaryMedia";
import { type HeroSlide } from "@/lib/brand";
import type { CloudinaryResourceType } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

export type HomeHeroSlide = HeroSlide & {
  src?: string;
  resourceType?: CloudinaryResourceType;
  posterPublicId?: string | null;
};

export type HeroProduct = {
  href: string;
  label: string;
  hint: string;
};

type Props = {
  slides: HomeHeroSlide[];
  eyebrow: string;
  title: string;
  description: string;
  secondaryHref: string;
  secondaryLabel: string;
  products: HeroProduct[];
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
  products,
  intervalMs = 6500,
}: Props) {
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
    <section className="relative isolate min-h-svh overflow-hidden bg-sky-900">
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

      {/* Dark at the very top, fully clear by the midpoint: the glass nav sits
          on the dark end so it stays legible, and the photograph is untouched
          through the middle of the frame. From the midpoint down it ramps back
          into ink so the eyebrow, headline and buttons keep contrast on bright
          slides. The top half is mint-ink so the glass chrome reads green
          rather than fighting a blue scrim underneath it; the bottom half stays
          sky-ink. The two never blend — they meet at 50% at zero alpha, which
          is also why there is no visible band where they join. */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-mint-ink/75 via-transparent via-50% to-sky-ink/90"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-svh max-w-[1200px] flex-col justify-end px-5 pb-14 pt-24 md:px-8 md:pb-20 md:pt-32">
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-end lg:gap-12">
          <motion.div
            className="min-w-0"
            {...settle}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-citrus-soft">
              {eyebrow}
            </p>

            <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.05] text-white md:text-6xl">
              {title}
            </h1>

            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/80 md:text-base">
              {description}
            </p>
          </motion.div>

          {/* Single widget: under copy on mobile, right column on desktop. */}
          <motion.div
            className="w-full lg:row-span-2 lg:self-end"
            {...settle}
            transition={{ duration: 0.55, ease: "easeOut", delay: 0.12 }}
          >
            <HeroBookingSearch />
          </motion.div>

          <motion.div
            className="min-w-0 lg:col-start-1"
            {...settle}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.18 }}
          >
            <Link
              href={secondaryHref}
              className="inline-flex h-11 items-center rounded-xl border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              {secondaryLabel}
            </Link>

            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
              {products.map((product) => (
                <li key={product.href + product.label}>
                  <Link
                    href={product.href}
                    className="group inline-flex items-baseline gap-2 py-1 text-sm text-white transition-colors hover:text-citrus-soft"
                  >
                    <span className="font-semibold underline-offset-4 group-hover:underline">
                      {product.label}
                    </span>
                    <span className="text-xs text-white/55 group-hover:text-white/75">
                      {product.hint}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {slideCount > 1 ? (
              <div className="mt-8 flex items-center gap-4">
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
                        i === index
                          ? "w-10 bg-gradient-to-r from-citrus-soft to-citrus"
                          : "w-5 bg-white/30 hover:bg-white/50",
                      )}
                    />
                  ))}
                </div>
                <p
                  className="text-xs font-medium tracking-wide text-white/70"
                  aria-live="polite"
                >
                  {safeSlides[index]?.label}
                </p>
              </div>
            ) : null}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
