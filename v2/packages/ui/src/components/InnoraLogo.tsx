import { motion, useReducedMotion } from "motion/react";
import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

export type LogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export interface InnoraLogoProps extends HTMLAttributes<HTMLDivElement> {
  size?: LogoSize | number;
  animated?: boolean;
  showText?: boolean;
  tagline?: string;
  variant?: "sovereign" | "aurora" | "monochrome" | "gold" | "titanium";
  interactive?: boolean;
  domain?: string;
  showDomain?: boolean;
  layout?: "horizontal" | "stacked";
}

const SIZE_MAP: Record<LogoSize, { box: number; icon: number; text: string; sub: string }> = {
  xs: { box: 26, icon: 16, text: "text-xs", sub: "text-[7px]" },
  sm: { box: 34, icon: 20, text: "text-sm", sub: "text-[8px]" },
  md: { box: 44, icon: 26, text: "text-base", sub: "text-[9px]" },
  lg: { box: 64, icon: 38, text: "text-xl", sub: "text-[11px]" },
  xl: { box: 88, icon: 54, text: "text-3xl", sub: "text-[12px]" },
  "2xl": { box: 120, icon: 76, text: "text-5xl", sub: "text-[14px]" },
};

export function InnoraLogo({
  size = "md",
  animated = true,
  showText = true,
  tagline = "HOTEL OS v2",
  variant = "sovereign",
  interactive = true,
  domain = "innorahotel.com",
  showDomain = false,
  layout = "horizontal",
  className,
  ...props
}: InnoraLogoProps) {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animated && !reduceMotion;

  const dims =
    typeof size === "number"
      ? {
          box: size,
          icon: Math.round(size * 0.62),
          text: size > 60 ? "text-2xl" : "text-base",
          sub: size > 60 ? "text-[11px]" : "text-[9px]",
        }
      : SIZE_MAP[size];

  const isStacked = layout === "stacked";

  return (
    <div
      className={cn(
        "group select-none",
        isStacked
          ? "flex flex-col items-center text-center gap-2"
          : "inline-flex items-center gap-3.5",
        interactive && "cursor-pointer",
        className
      )}
      {...props}
    >
      {/* ========================================================
          SOVEREIGN CREST EMBLEM (Faceted Glass Shield + Living Aurora)
          ======================================================== */}
      <div
        style={{ width: dims.box, height: dims.box }}
        className="relative flex shrink-0 items-center justify-center"
      >
        {/* Layer 1: Celestial Conic Aurora Halo (Rotating 360° Living Background) */}
        {shouldAnimate && (
          <motion.div
            animate={{
              rotate: [0, 360],
              scale: [0.95, 1.12, 0.95],
              opacity: [0.35, 0.65, 0.35],
            }}
            transition={{
              rotate: { duration: 16, repeat: Infinity, ease: "linear" },
              scale: { duration: 4.5, repeat: Infinity, ease: "easeInOut" },
              opacity: { duration: 4.5, repeat: Infinity, ease: "easeInOut" },
            }}
            className="pointer-events-none absolute -inset-1.5 -z-10 rounded-[34%] opacity-50 blur-lg transition-transform duration-500 group-hover:scale-125 group-hover:opacity-80"
            style={{
              background:
                variant === "gold"
                  ? "conic-gradient(from 0deg, #f59e0b, #d97706, #fbbf24, #b45309, #f59e0b)"
                  : "conic-gradient(from 0deg, #2563eb, #6366f1, #8b5cf6, #f59e0b, #10b981, #2563eb)",
            }}
          />
        )}

        {/* Layer 2: 3D Beveled Glass Chassis with Metallic Rim */}
        <div
          className={cn(
            "relative flex size-full items-center justify-center overflow-hidden rounded-[26%] border shadow-xl transition-all duration-300",
            interactive && "group-hover:-translate-y-0.5 group-hover:shadow-2xl group-active:scale-95",
            variant === "sovereign" &&
              "border-white/35 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 shadow-[0_8px_24px_-4px_rgba(37,99,235,0.35)]",
            variant === "aurora" &&
              "border-white/45 bg-gradient-to-br from-blue-600 via-indigo-700 to-violet-900 shadow-[0_8px_28px_-4px_rgba(99,102,241,0.45)]",
            variant === "gold" &&
              "border-amber-400/50 bg-gradient-to-br from-amber-950 via-slate-950 to-amber-900 shadow-[0_8px_28px_-4px_rgba(245,158,11,0.35)]",
            variant === "titanium" &&
              "border-white/30 bg-gradient-to-br from-zinc-800 via-zinc-900 to-slate-950 shadow-lg",
            variant === "monochrome" &&
              "border-white/20 bg-slate-900 shadow-none"
          )}
        >
          {/* Top Specular Rim Lighting Glint */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-white/30 via-white/10 to-transparent" />

          {/* Precision Sacred Himalayan Coronet Vector */}
          <svg
            width={dims.icon}
            height={dims.icon}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="relative z-10 transition-transform duration-300 group-hover:scale-105"
          >
            <defs>
              {/* Royal Himalayan Gold Gradient */}
              <linearGradient id="innoraGoldFacet" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="35%" stopColor="#f59e0b" />
                <stop offset="70%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>

              {/* Imperial Sapphire Facet */}
              <linearGradient id="innoraSapphireFacet" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#bfdbfe" />
                <stop offset="30%" stopColor="#60a5fa" />
                <stop offset="65%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#1e3a8a" />
              </linearGradient>

              {/* Crystalline Titanium Spine */}
              <linearGradient id="innoraTitaniumSpine" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="40%" stopColor="#e2e8f0" stopOpacity="0.9" />
                <stop offset="85%" stopColor="#94a3b8" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.95" />
              </linearGradient>

              {/* Laser Edge Beam Gradient */}
              <linearGradient id="laserBeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0" />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </linearGradient>

              {/* Zenith Flare Filters */}
              <filter id="zenithPhotonicFlare" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="glow1" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="glow2" />
                <feMerge>
                  <feMergeNode in="glow2" />
                  <feMergeNode in="glow1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Facet 1: Left Mountain Ridge / Sapphire Wing */}
            <motion.path
              d="M 50 16 L 20 68 C 17 73 21 79 27 77 L 50 66 Z"
              fill="url(#innoraSapphireFacet)"
              initial={shouldAnimate ? { opacity: 0, scale: 0.85 } : false}
              animate={shouldAnimate ? { opacity: 1, scale: 1 } : false}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Facet 2: Right Mountain Ridge / Golden Wing */}
            <motion.path
              d="M 50 16 L 80 68 C 83 73 79 79 73 77 L 50 66 Z"
              fill="url(#innoraGoldFacet)"
              initial={shouldAnimate ? { opacity: 0, scale: 0.85 } : false}
              animate={shouldAnimate ? { opacity: 1, scale: 1 } : false}
              transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Facet 3: Central Monolithic 'I' Keystone (Front Spine) */}
            <motion.path
              d="M 46 32 L 54 32 L 52.5 73 L 47.5 73 Z"
              fill="url(#innoraTitaniumSpine)"
              initial={shouldAnimate ? { scaleY: 0 } : false}
              animate={shouldAnimate ? { scaleY: 1 } : false}
              transition={{ duration: 0.7, delay: 0.3, ease: "backOut" }}
            />

            {/* Facet 4: Sacred Lotus Base Plinth */}
            <path
              d="M 28 77 C 38 72 44 68 50 68 C 56 68 62 72 72 77 C 62 81 56 83 50 83 C 44 83 38 81 28 77 Z"
              fill="url(#innoraGoldFacet)"
              opacity="0.85"
            />

            {/* Facet 5: Auspicious Keystone Jewels */}
            <circle cx="50" cy="74.5" r="3.2" fill="#ffffff" filter="drop-shadow(0 0 3px #fef08a)" />
            <circle cx="37" cy="76" r="2.2" fill="#93c5fd" />
            <circle cx="63" cy="76" r="2.2" fill="#fbbf24" />

            {/* Layer 3: Laser Contour Stroke Tracing (The Living Edge) */}
            {shouldAnimate && (
              <motion.path
                d="M 20 68 L 50 16 L 80 68 L 73 77 L 50 66 L 27 77 Z"
                fill="none"
                stroke="url(#laserBeamGrad)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeDasharray="24 160"
                animate={{
                  strokeDashoffset: [0, -184],
                }}
                transition={{
                  duration: 3.2,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            )}

            {/* Layer 4: Zenith Starlight Diamond Cross-Flare (The Sovereign Eye) */}
            <g transform="translate(50, 16)">
              {/* Outer Pulsing Flare Spikes */}
              {shouldAnimate && (
                <motion.g
                  animate={{
                    rotate: [0, 90, 180, 270, 360],
                    scale: [0.85, 1.35, 0.85],
                  }}
                  transition={{
                    rotate: { duration: 12, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2.8, repeat: Infinity, ease: "easeInOut" },
                  }}
                >
                  {/* Vertical & Horizontal Spikes */}
                  <path d="M 0 -8 L 1 -1 L 8 0 L 1 1 L 0 8 L -1 1 L -8 0 L -1 -1 Z" fill="#ffffff" opacity="0.9" />
                  {/* Diagonal Micro Spikes */}
                  <path
                    d="M 0 -5 L 0.8 -0.8 L 5 0 L 0.8 0.8 L 0 5 L -0.8 0.8 L -5 0 L -0.8 -0.8 Z"
                    fill="#fef08a"
                    opacity="0.75"
                    transform="rotate(45)"
                  />
                </motion.g>
              )}

              {/* Core Starlight Diamond Jewel */}
              <circle cx="0" cy="0" r="3.2" fill="#ffffff" filter="url(#zenithPhotonicFlare)" />
              <circle cx="0" cy="0" r="1.5" fill="#fef08a" />
            </g>
          </svg>

          {/* Sweeping Specular Light Glint on Hover & Periodically */}
          {shouldAnimate && (
            <motion.div
              animate={{
                x: ["-100%", "200%"],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                repeatDelay: 4.8,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-75"
            />
          )}
        </div>
      </div>

      {/* ========================================================
          TYPOGRAPHY: INNORA + ASTRONOMICAL MICRO-TAGLINE / DOMAIN
          ======================================================== */}
      {showText && (
        <div className={cn("flex flex-col", isStacked && "items-center")}>
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={cn(
                "font-black tracking-tight text-[var(--hos-ink)] transition-colors duration-200 group-hover:text-blue-600 dark:group-hover:text-blue-400",
                dims.text
              )}
              style={{
                letterSpacing: "-0.035em",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              INNORA
            </span>

            {/* Glowing Golden Apex Dot with Pulse Ring */}
            <div className="relative flex size-2 items-center justify-center">
              {shouldAnimate && (
                <motion.span
                  animate={{
                    scale: [1, 2.2, 1],
                    opacity: [0.6, 0, 0.6],
                  }}
                  transition={{
                    duration: 2.2,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                  className="absolute size-2 rounded-full bg-amber-400"
                />
              )}
              <span className="relative size-1.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 shadow-[0_0_6px_#f59e0b]" />
            </div>
          </div>

          {/* Micro-Tagline & innorahotel.com domain lockup */}
          {(tagline || showDomain) && (
            <div
              className={cn(
                "flex items-center gap-1.5 mt-0.5",
                isStacked && "justify-center"
              )}
            >
              {tagline && (
                <span
                  className={cn(
                    "font-mono font-bold tracking-[0.22em] uppercase text-amber-600 dark:text-amber-400/90",
                    dims.sub
                  )}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {tagline}
                </span>
              )}

              {tagline && showDomain && (
                <span className="size-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              )}

              {showDomain && (
                <span
                  className={cn(
                    "font-mono font-bold tracking-wider text-blue-600 dark:text-blue-400 transition-colors duration-200 group-hover:text-amber-500",
                    dims.sub
                  )}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {domain}
                </span>
              )}

              {!showDomain && (
                <>
                  <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="font-mono text-[7px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                    Sovereign
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * InnorahotelLogo: Enterprise-grade lockup explicitly configured for innorahotel.com
 */
export function InnorahotelLogo({
  size = "md",
  variant = "sovereign",
  domain = "innorahotel.com",
  showDomain = true,
  tagline = "SOVEREIGN HOSPITALITY",
  ...props
}: Partial<InnoraLogoProps>) {
  return (
    <InnoraLogo
      size={size}
      variant={variant}
      domain={domain}
      showDomain={showDomain}
      tagline={tagline}
      {...props}
    />
  );
}

