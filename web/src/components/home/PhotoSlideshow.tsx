"use client";

import { CloudinaryMedia } from "@/components/media/CloudinaryMedia";
import type { CloudinaryResourceType } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export type SlideshowPhoto = {
  publicId?: string | null;
  src?: string | null;
  alt: string;
  resourceType?: CloudinaryResourceType;
  posterPublicId?: string | null;
};

/**
 * Edge-to-edge media rail. Slides horizontally on a timer, pauses on hover and
 * when the tab is hidden, and accepts a swipe on touch. Used for the outlet
 * sections where the picture is the full bleed of the section — no padding,
 * no rounded frame.
 */
export function PhotoSlideshow({
  photos,
  className,
  intervalMs = 5200,
  sizes = "(max-width: 1024px) 100vw, 50vw",
  priority,
}: {
  photos: SlideshowPhoto[];
  className?: string;
  intervalMs?: number;
  sizes?: string;
  priority?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const swipeStart = useRef<number | null>(null);
  const count = photos.length;
  const activeIsVideo = photos[index]?.resourceType === "video";

  useEffect(() => {
    if (count < 2 || paused || activeIsVideo || reduceMotion) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [count, intervalMs, paused, activeIsVideo, reduceMotion]);

  useEffect(() => {
    const onVisibility = () => setPaused(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (count === 0) return null;

  function step(direction: 1 | -1) {
    setIndex((current) => (current + direction + count) % count);
  }

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse") return;
        swipeStart.current = event.clientX;
      }}
      onPointerUp={(event) => {
        const start = swipeStart.current;
        swipeStart.current = null;
        if (start == null) return;
        const delta = event.clientX - start;
        if (Math.abs(delta) > 48) step(delta < 0 ? 1 : -1);
      }}
    >
      <div
        className={cn(
          "flex h-full w-full",
          !reduceMotion &&
            "transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        )}
        style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
      >
        {photos.map((photo, i) => (
          <div
            key={`${photo.publicId ?? photo.src ?? i}`}
            className="relative h-full w-full shrink-0 grow-0 basis-full"
          >
            <CloudinaryMedia
              publicId={photo.publicId}
              src={photo.src}
              alt={photo.alt}
              resourceType={photo.resourceType ?? "image"}
              posterPublicId={photo.posterPublicId}
              fill
              sizes={sizes}
              priority={priority && i === 0}
              cinematic={photo.resourceType === "video"}
              active={i === index}
              imgClassName="object-cover"
            />
          </div>
        ))}
      </div>

      {count > 1 ? (
        <div
          className="absolute bottom-4 left-4 flex gap-1.5 md:bottom-6 md:left-6"
          role="tablist"
          aria-label="Photos"
        >
          {photos.map((photo, i) => (
            <button
              key={`dot-${photo.publicId ?? photo.src ?? i}`}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={photo.alt}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full backdrop-blur transition-all duration-300",
                i === index
                  ? "w-8 bg-white"
                  : "w-4 bg-white/45 hover:bg-white/70",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
