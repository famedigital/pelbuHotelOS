import { BRAND_ICONS } from "@/lib/brand";
import { SITE_NAME } from "@/lib/site";
import {
  DEFAULT_LOGO_NAV_GAP_REM,
  DEFAULT_LOGO_NAV_OFFSET_PCT,
  DEFAULT_LOGO_NAV_SHIFT_X_REM,
  DEFAULT_LOGO_NAV_SIZE_REM,
} from "@/lib/property-settings";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { CSSProperties } from "react";

export type BrandLockupTone = "hero" | "solid";

type Props = {
  logoSrc?: string | null;
  href?: string;
  /** White type over the homepage hero glass; solid elsewhere. */
  tone?: BrandLockupTone;
  className?: string;
  /** Desktop mark size in rem (ERP Settings). Mobile ~90%, hero slightly larger. */
  sizeRem?: number;
  /** Vertical hang as % of mark height (higher hangs lower under the rail). */
  offsetPct?: number;
  /** Horizontal gap between mark and hotel name (rem). */
  gapRem?: number;
  /** Horizontal nudge of the mark (rem). Positive moves right. */
  shiftXRem?: number;
  /** Override text colour (CMS hero nav text). */
  color?: string;
  /**
   * Mobile homepage over photo: compact mark, no hang — avoids a second bar.
   * From `md` up the normal hang/size still apply.
   */
  flushMobile?: boolean;
};

/**
 * Public brand lockup: hotel name stays on the slim rail midline.
 * Mark hangs relative to the glass strip. Size / hang / shift / gap from ERP.
 */
export function BrandLockup({
  logoSrc,
  href = "/",
  tone = "solid",
  className,
  sizeRem = DEFAULT_LOGO_NAV_SIZE_REM,
  offsetPct = DEFAULT_LOGO_NAV_OFFSET_PCT,
  gapRem = DEFAULT_LOGO_NAV_GAP_REM,
  shiftXRem = DEFAULT_LOGO_NAV_SHIFT_X_REM,
  color,
  flushMobile = false,
}: Props) {
  const logo = logoSrc?.trim() || BRAND_ICONS.mark;
  const hero = tone === "hero";

  const desktop = Math.min(12, Math.max(4, sizeRem));
  const mobileBase = Math.round(desktop * 0.9 * 100) / 100;
  // Hero phone: bold mark in the rail (no hang) without shrinking like the old compact mode.
  const mobile = flushMobile
    ? Math.min(3.75, Math.max(3.1, Math.round(desktop * 0.58 * 100) / 100))
    : mobileBase;
  const displaySize = hero
    ? Math.round(desktop * 1.04 * 100) / 100
    : desktop;
  const displayMobile =
    hero && !flushMobile
      ? Math.round(mobile * 1.08 * 100) / 100
      : flushMobile
        ? mobile
        : mobile;
  const offset = Math.min(70, Math.max(20, offsetPct));
  const gap = Math.min(3, Math.max(0, gapRem));
  const shiftX = flushMobile
    ? 0
    : Math.min(3, Math.max(-1.5, shiftXRem));
  const slotRem = Math.max(displayMobile, displaySize);

  const vars = {
    ["--logo-size"]: `${displaySize}rem`,
    ["--logo-size-m"]: `${displayMobile}rem`,
    ["--logo-offset"]: `${offset}%`,
    ["--logo-offset-m"]: flushMobile ? "0%" : `${offset}%`,
    ["--logo-slot"]: `${flushMobile ? displayMobile : slotRem}rem`,
    ["--logo-slot-d"]: `${slotRem}rem`,
    ["--logo-gap"]: `${gap}rem`,
    ["--logo-shift-x"]: `${shiftX}rem`,
    // Solid bar can inherit colour; hero wordmark uses its own gradient (not CMS navText).
    ...(!hero && color ? { color } : {}),
  } as CSSProperties;

  return (
    <Link
      href={href}
      className={cn(
        "relative z-20 flex h-12 min-w-0 items-center overflow-visible md:h-[3.25rem]",
        "gap-[var(--logo-gap)]",
        // Wordmark paints its own gradient on hero; keep solid tones for solid bar.
        !hero && "text-foreground",
        className,
      )}
      style={vars}
    >
      <span
        className={cn(
          "relative h-full w-[var(--logo-slot)] shrink-0 overflow-visible",
          flushMobile && "md:w-[var(--logo-slot-d)]",
        )}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt=""
          className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 h-[var(--logo-size-m)] w-[var(--logo-size-m)] object-contain md:h-[var(--logo-size)] md:w-[var(--logo-size)]",
            "drop-shadow-[0_8px_18px_rgb(8_47_73/0.28)]",
            hero && "drop-shadow-[0_6px_16px_rgb(0_0_0/0.45)]",
            // Phone flush: center in rail. md+: hang via --logo-offset (see style).
            flushMobile &&
              "max-md:[transform:translate(-50%,-50%)] md:[transform:translate(calc(-50%+var(--logo-shift-x)),calc(-1*var(--logo-offset)))]",
          )}
          style={
            flushMobile
              ? undefined
              : {
                  transform:
                    "translate(calc(-50% + var(--logo-shift-x)), calc(-1 * var(--logo-offset-m)))",
                }
          }
          width={Math.round(displaySize * 16)}
          height={Math.round(displaySize * 16)}
        />
      </span>
      <span
        className={cn(
          "relative z-10 min-w-0 truncate font-display font-semibold leading-none tracking-tight",
          flushMobile
            ? "text-[1.4rem] md:text-2xl"
            : "text-lg md:text-2xl",
          hero
            ? cn(
                // Brand gold gradient — reads as the product name, not flat white nav chrome.
                "bg-gradient-to-br from-[#fff6d8] via-citrus-soft to-citrus bg-clip-text text-transparent",
                "[filter:drop-shadow(0_1px_2px_rgb(0_0_0/0.55))_drop-shadow(0_0_18px_rgb(251_191_36/0.35))]",
                "tracking-[-0.02em]",
              )
            : "text-foreground",
        )}
      >
        {SITE_NAME}
      </span>
    </Link>
  );
}
