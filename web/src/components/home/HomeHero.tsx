"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { type HeroSlide } from "@/lib/brand";
import { useEffect, useState } from "react";

export type HomeHeroSlide = HeroSlide & { src: string };

type Props = {
  slides: HomeHeroSlide[];
  logoSrc?: string | null;
  intervalMs?: number;
};

/** Full-bleed hero: brand signal, one line, one CTA. No logo stack, no brass chrome. */
export function HomeHero({ slides, intervalMs = 7000 }: Props) {
  const safeSlides = slides.filter((s) => s.src);
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (safeSlides.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % safeSlides.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [safeSlides.length, intervalMs]);

  const settle = reduceMotion
    ? { initial: false as const, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
      };

  return (
    <section className="relative min-h-[92svh] overflow-hidden bg-ink">
      {safeSlides.length > 0 ? (
        <div className="absolute inset-0" aria-hidden>
          {safeSlides.map((slide, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={slide.publicId}
              src={slide.src}
              alt={slide.alt}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
              width={1920}
              height={1080}
              fetchPriority={i === 0 ? "high" : "low"}
            />
          ))}
        </div>
      ) : null}

      <div
        className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/25"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-[92svh] max-w-[1120px] flex-col justify-end px-5 pb-16 pt-28 md:px-8 md:pb-20">
        <motion.p
          className="text-[13px] text-ivory/55"
          {...settle}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          Olakha, Thimphu
        </motion.p>

        <motion.h1
          className="mt-3 max-w-xl font-display text-4xl leading-[1.1] text-ivory md:text-5xl lg:text-[3.5rem]"
          {...settle}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
        >
          Stay. Dine. Gather.
        </motion.h1>

        <motion.p
          className="mt-4 max-w-md text-[15px] leading-relaxed text-ivory/70"
          {...settle}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
        >
          A modern 3-star hotel — rooms, cafe, restaurant, spa, and meeting under
          one roof.
        </motion.p>

        <motion.div
          className="mt-8 flex flex-wrap items-center gap-3"
          {...settle}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
        >
          <Link
            href="/book"
            className="inline-flex h-11 items-center rounded-md bg-ivory px-5 text-sm font-medium text-ink hover:bg-ivory/90"
          >
            Book a stay
          </Link>
          <Link
            href="/rooms"
            className="inline-flex h-11 items-center px-2 text-sm text-ivory/70 hover:text-ivory"
          >
            View rooms
          </Link>
        </motion.div>

        {safeSlides.length > 1 ? (
          <div
            className="mt-10 flex gap-1.5"
            role="tablist"
            aria-label="Hero photos"
          >
            {safeSlides.map((slide, i) => (
              <button
                key={slide.publicId}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={slide.label}
                onClick={() => setIndex(i)}
                className={`h-1 w-6 rounded-full transition-colors ${
                  i === index ? "bg-ivory" : "bg-ivory/25 hover:bg-ivory/45"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
