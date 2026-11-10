import { motion, useReducedMotion } from "motion/react";
import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

export type LogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export interface InnoraLogoProps extends HTMLAttributes<HTMLDivElement> {
  size?: LogoSize | number;
  animated?: boolean;
  showText?: boolean;
  tagline?: string;
  variant?: "sovereign" | "champagne" | "gold" | "platinum" | "obsidian" | "monochrome";
  interactive?: boolean;
  domain?: string;
  showDomain?: boolean;
  layout?: "horizontal" | "stacked";
}

const SIZE_MAP: Record<LogoSize, { box: number; icon: number; text: string; sub: string; domainSize: string }> = {
  xs: { box: 26, icon: 16, text: "text-[11px]", sub: "text-[7px]", domainSize: "text-[8px]" },
  sm: { box: 34, icon: 20, text: "text-[13px]", sub: "text-[8px]", domainSize: "text-[9px]" },
  md: { box: 44, icon: 26, text: "text-[15px]", sub: "text-[9px]", domainSize: "text-[10px]" },
  lg: { box: 64, icon: 38, text: "text-[20px]", sub: "text-[11px]", domainSize: "text-[12px]" },
  xl: { box: 92, icon: 54, text: "text-[28px]", sub: "text-[12px]", domainSize: "text-[14px]" },
  "2xl": { box: 128, icon: 78, text: "text-[38px]", sub: "text-[14px]", domainSize: "text-[16px]" },
};

/**
 * Innora Sovereign Monogram: The Living "IN" Talisman
 * Uniting the Sovereign Pillar ("I") and the Endless Relay ("N") with the Golden Horizon ("O").
 * Built to look unmistakable on everything: T-shirts, fleet cars, cotton letterheads, stickers, and 16px favicons.
 */
export function InnoraLogo({
  size = "md",
  animated = true,
  showText = true,
  tagline,
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
          icon: Math.round(size * 0.6),
          text: size > 60 ? "text-[22px]" : "text-[14px]",
          sub: size > 60 ? "text-[10px]" : "text-[8px]",
          domainSize: size > 60 ? "text-[12px]" : "text-[9px]",
        }
      : SIZE_MAP[size];

  const isStacked = layout === "stacked";

  return (
    <div
      className={cn(
        "group select-none",
        isStacked
          ? "flex flex-col items-center text-center gap-3"
          : "inline-flex items-center gap-3.5",
        interactive && "cursor-pointer",
        className
      )}
      {...props}
    >
      {/* ========================================================
          THE SOVEREIGN "IN" MONOGRAM (Architectural Chassis)
          ======================================================== */}
      <div
        style={{ width: dims.box, height: dims.box }}
        className="relative flex shrink-0 items-center justify-center"
      >
        {/* Layer 1: Ambient Horizon Breathing Glow */}
        {shouldAnimate && variant !== "monochrome" && (
          <motion.div
            animate={{
              opacity: [0.2, 0.45, 0.2],
              scale: [0.96, 1.05, 0.96],
            }}
            transition={{
              duration: 6.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="pointer-events-none absolute -inset-2 -z-10 rounded-2xl blur-xl transition-all duration-700 group-hover:opacity-75 group-hover:scale-115"
            style={{
              background:
                variant === "champagne" || variant === "gold"
                  ? "radial-gradient(circle at 50% 40%, rgba(245, 158, 11, 0.35) 0%, rgba(180, 83, 9, 0.12) 50%, transparent 75%)"
                  : variant === "platinum"
                  ? "radial-gradient(circle at 50% 40%, rgba(226, 232, 240, 0.3) 0%, rgba(148, 163, 184, 0.1) 50%, transparent 75%)"
                  : "radial-gradient(circle at 50% 35%, rgba(245, 158, 11, 0.35) 0%, rgba(37, 99, 235, 0.18) 45%, transparent 72%)",
            }}
          />
        )}

        {/* Layer 2: Obsidian Architectural Monolith Chassis */}
        <div
          className={cn(
            "relative flex size-full items-center justify-center overflow-hidden rounded-[24%] border transition-all duration-500",
            interactive && "group-hover:-translate-y-0.5 group-hover:shadow-[0_16px_36px_-8px_rgba(0,0,0,0.65)] group-active:scale-[0.98]",
            // Sovereign: Obsidian Black + Hairline Platinum/Champagne Edge
            variant === "sovereign" &&
              "border-white/[0.14] bg-gradient-to-b from-[#161a26] via-[#0d1017] to-[#06080d] shadow-[0_10px_28px_-6px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.18)]",
            (variant === "champagne" || variant === "gold") &&
              "border-amber-400/25 bg-gradient-to-b from-[#1c1813] via-[#14110d] to-[#0a0806] shadow-[0_10px_28px_-6px_rgba(245,158,11,0.22),inset_0_1px_1px_rgba(245,208,136,0.2)]",
            variant === "platinum" &&
              "border-slate-300/20 bg-gradient-to-b from-[#1e232d] via-[#12151b] to-[#090b0e] shadow-[0_10px_28px_-6px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.18)]",
            variant === "obsidian" &&
              "border-white/[0.08] bg-[#090a0f] shadow-[0_8px_24px_rgba(0,0,0,0.6)]",
            variant === "monochrome" &&
              "border-black/10 dark:border-white/10 bg-white dark:bg-black shadow-sm"
          )}
        >
          {/* Top Specular Rim Reflection */}
          {variant !== "monochrome" && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/[0.12] to-transparent" />
          )}

          {/* Micro Hairline Rim */}
          <div className="pointer-events-none absolute inset-[1px] rounded-[22%] border border-white/[0.04]" />

          {/* PRECISION "IN" VECTOR MONOGRAM */}
          <svg
            width={dims.icon}
            height={dims.icon}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="relative z-10 transition-transform duration-500 group-hover:scale-[1.03]"
          >
            <defs>
              <linearGradient id="inPlatBeam" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="35%" stopColor="#e2e8f0" />
                <stop offset="75%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>

              <linearGradient id="inGoldBeam" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fff2d1" />
                <stop offset="35%" stopColor="#f59e0b" />
                <stop offset="70%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>

              <filter id="keystoneGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#f59e0b" floodOpacity="0.8" />
              </filter>
            </defs>

            {/* 1. SOVEREIGN 'I' PILLAR (Left Vertical Spine) */}
            <motion.rect
              x="24"
              y="18"
              width="12"
              height="64"
              rx="3"
              fill={variant === "monochrome" ? "currentColor" : "url(#inPlatBeam)"}
              initial={shouldAnimate ? { scaleY: 0, originY: 1 } : false}
              animate={shouldAnimate ? { scaleY: 1 } : false}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* 2. RELAY 'N' DIAGONAL BRIDGE (Connecting Desk to Field) */}
            <motion.path
              d="M 33 22 L 67 76 L 56 82 L 24 28 Z"
              fill={
                variant === "monochrome"
                  ? "currentColor"
                  : variant === "platinum"
                  ? "url(#inPlatBeam)"
                  : "url(#inGoldBeam)"
              }
              opacity={variant === "monochrome" ? 1 : 0.95}
              initial={shouldAnimate ? { opacity: 0, scale: 0.8 } : false}
              animate={shouldAnimate ? { opacity: 1, scale: 1 } : false}
              transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* 3. RIGHT PILLAR (Completing 'N') */}
            <motion.rect
              x="64"
              y="18"
              width="12"
              height="64"
              rx="3"
              fill={variant === "monochrome" ? "currentColor" : "url(#inPlatBeam)"}
              initial={shouldAnimate ? { scaleY: 0, originY: 1 } : false}
              animate={shouldAnimate ? { scaleY: 1 } : false}
              transition={{ delay: 0.6, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* 4. CENTRAL GOLDEN HORIZON BEACON ('O' of Ora / Auspicious Keystone) */}
            <motion.g
              initial={shouldAnimate ? { scale: 0 } : false}
              animate={
                shouldAnimate
                  ? {
                      scale: [0.92, 1.15, 0.92],
                      opacity: [0.85, 1, 0.85],
                    }
                  : false
              }
              transition={{
                delay: 0.9,
                duration: 3.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <circle
                cx="49"
                cy="50"
                r="4.5"
                fill={variant === "monochrome" ? "#ffffff" : "#f59e0b"}
                filter={variant === "monochrome" ? undefined : "url(#keystoneGlow)"}
              />
              <circle cx="49" cy="50" r="1.8" fill="#ffffff" />
            </motion.g>

            {/* Foundation Horizon Plinth */}
            <rect
              x="18"
              y="85"
              width="64"
              height="4"
              rx="2"
              fill={variant === "monochrome" ? "currentColor" : "url(#inPlatBeam)"}
              opacity="0.6"
            />
          </svg>

          {/* Sweeping Swiss Specular Sheen (Every 6.5s) */}
          {shouldAnimate && variant !== "monochrome" && (
            <motion.div
              animate={{
                x: ["-160%", "280%"],
              }}
              transition={{
                duration: 1.3,
                repeat: Infinity,
                repeatDelay: 5.2,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="pointer-events-none absolute inset-0 -skew-x-[22deg] bg-gradient-to-r from-transparent via-white/[0.22] to-transparent"
            />
          )}
        </div>
      </div>

      {/* ========================================================
          INTERNATIONAL TYPOGRAPHY: I N N O R A + PROVENANCE LOCKUP
          ======================================================== */}
      {showText && (
        <div className={cn("flex flex-col select-none", isStacked && "items-center")}>
          {/* Main Brand Wordmark */}
          <div className="flex items-center gap-2 leading-none">
            <span
              className={cn(
                "font-extrabold text-[var(--hos-ink)] transition-colors duration-300 group-hover:text-amber-600 dark:group-hover:text-amber-400",
                dims.text
              )}
              style={{
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Cinzel', 'Playfair Display', 'Plus Jakarta Sans', serif",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
              }}
            >
              INNORA
            </span>

            {/* Restrained Champagne Gold Jewelry Dot */}
            <span
              className="inline-block size-1.5 rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 shadow-[0_0_6px_rgba(245,158,11,0.7)]"
              aria-hidden
            />
          </div>

          {/* International Domain / Provenance Subtitle */}
          <div
            className={cn(
              "flex items-center gap-1.5 mt-1 tracking-widest",
              isStacked && "justify-center"
            )}
          >
            {showDomain ? (
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "font-mono font-medium tracking-[0.24em] uppercase text-slate-500 dark:text-slate-400 transition-colors group-hover:text-slate-900 dark:group-hover:text-slate-200",
                    dims.domainSize
                  )}
                >
                  {domain}
                </span>
                <span className="size-1 rounded-full bg-amber-500/60" />
                <span
                  className={cn(
                    "font-mono font-medium tracking-[0.18em] uppercase text-amber-700/80 dark:text-amber-400/80",
                    dims.sub
                  )}
                >
                  BHUTAN
                </span>
              </div>
            ) : tagline ? (
              <span
                className={cn(
                  "font-mono font-semibold tracking-[0.26em] uppercase text-slate-500 dark:text-slate-400",
                  dims.sub
                )}
              >
                {tagline}
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "font-mono font-medium tracking-[0.22em] uppercase text-slate-400 dark:text-slate-500",
                    dims.sub
                  )}
                >
                  Sovereign Hospitality
                </span>
                <span className="size-0.5 rounded-full bg-slate-400 dark:bg-slate-600" />
                <span
                  className={cn(
                    "font-mono font-medium tracking-[0.16em] uppercase text-amber-600/75 dark:text-amber-400/75",
                    dims.sub
                  )}
                >
                  Himalaya
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * InnorahotelLogo: Luxury International Haute-Hôtellerie Lockup for innorahotel.com
 */
export function InnorahotelLogo({
  size = "md",
  variant = "sovereign",
  domain = "innorahotel.com",
  showDomain = true,
  tagline,
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
