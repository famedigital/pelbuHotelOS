import { BRAND_ICONS } from "@/lib/brand";
import { SITE_NAME } from "@/lib/site";
import {
  DEFAULT_LOGO_NAV_GAP_REM,
  DEFAULT_LOGO_NAV_OFFSET_PCT,
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
  /** Override text colour (CMS hero nav text). */
  color?: string;
};

/**
 * Public brand lockup: hotel name stays on the slim rail midline.
 * Mark hangs relative to the glass strip. Size / offset / gap from ERP Settings.
 */
export function BrandLockup({
  logoSrc,
  href = "/",
  tone = "solid",
  className,
  sizeRem = DEFAULT_LOGO_NAV_SIZE_REM,
  offsetPct = DEFAULT_LOGO_NAV_OFFSET_PCT,
  gapRem = DEFAULT_LOGO_NAV_GAP_REM,
  color,
}: Props) {
  const logo = logoSrc?.trim() || BRAND_ICONS.mark;
  const hero = tone === "hero";

  const desktop = Math.min(12, Math.max(4, sizeRem));
  const mobile = Math.round(desktop * 0.9 * 100) / 100;
  const displaySize = hero
    ? Math.round(desktop * 1.04 * 100) / 100
    : desktop;
  const displayMobile = hero
    ? Math.round(mobile * 1.04 * 100) / 100
    : mobile;
  const offset = Math.min(70, Math.max(20, offsetPct));
  const gap = Math.min(3, Math.max(0, gapRem));
  const slotRem = Math.max(2.75, Math.round(displaySize * 0.5 * 100) / 100);

  const vars = {
    ["--logo-size"]: `${displaySize}rem`,
    ["--logo-size-m"]: `${displayMobile}rem`,
    ["--logo-offset"]: `${offset}%`,
    ["--logo-slot"]: `${slotRem}rem`,
    ["--logo-gap"]: `${gap}rem`,
    ...(color ? { color } : {}),
  } as CSSProperties;

  return (
    <Link
      href={href}
      className={cn(
        "relative z-20 flex h-12 min-w-0 items-center overflow-visible md:h-[3.25rem]",
        "gap-[var(--logo-gap)]",
        hero
          ? color
            ? "[text-shadow:0_1px_2px_rgb(0_0_0/0.35)]"
            : "text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.35)]"
          : "text-foreground",
        className,
      )}
      style={vars}
    >
      <span
        className="relative h-full w-[var(--logo-slot)] shrink-0 overflow-visible"
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt=""
          className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 h-[var(--logo-size-m)] w-[var(--logo-size-m)] object-contain md:h-[var(--logo-size)] md:w-[var(--logo-size)]",
            "-translate-x-1/2",
            "drop-shadow-[0_8px_18px_rgb(8_47_73/0.28)]",
            hero && "drop-shadow-[0_6px_16px_rgb(0_0_0/0.45)]",
          )}
          style={{
            transform: `translate(-50%, calc(-1 * var(--logo-offset)))`,
          }}
          width={Math.round(displaySize * 16)}
          height={Math.round(displaySize * 16)}
        />
      </span>
      <span
        className={cn(
          "relative z-10 min-w-0 truncate font-display font-semibold leading-none tracking-tight",
          "text-lg md:text-2xl",
          hero && "drop-shadow-sm",
        )}
      >
        {SITE_NAME}
      </span>
    </Link>
  );
}
