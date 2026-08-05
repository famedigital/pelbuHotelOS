import { BRAND_ICONS } from "@/lib/brand";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";
import Link from "next/link";

export type BrandLockupTone = "hero" | "solid";

type Props = {
  logoSrc?: string | null;
  href?: string;
  /** White type over the homepage hero glass; solid elsewhere. */
  tone?: BrandLockupTone;
  className?: string;
};

/**
 * Public brand lockup: hotel **name** on the slim rail midline (aligned with
 * nav / CTAs). The **mark** is oversized and hangs below the glass bar so the
 * brand pops without shoving the wordmark off-center.
 */
export function BrandLockup({
  logoSrc,
  href = "/",
  tone = "solid",
  className,
}: Props) {
  const logo = logoSrc?.trim() || BRAND_ICONS.mark;
  const hero = tone === "hero";

  return (
    <Link
      href={href}
      className={cn(
        // Fixed to strip height — keeps “Pelbu Suites” level with Stay / Book.
        "relative z-20 flex h-12 min-w-0 items-center gap-2.5 overflow-visible md:h-[3.25rem] md:gap-3.5",
        hero
          ? "text-white [text-shadow:0_1px_3px_rgb(8_47_73/0.55)]"
          : "text-foreground",
        className,
      )}
    >
      {/*
        Layout slot is rail-height so flex centering doesn’t shift the name.
        The painted mark is larger and drops below the bar (offset).
      */}
      <span
        className="relative h-9 w-10 shrink-0 overflow-visible md:h-10 md:w-11"
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt=""
          className={cn(
            "pointer-events-none absolute left-0 top-0 object-contain",
            // ~72–80px mark · hangs under the 48–52px glass strip
            "h-[4.5rem] w-[4.5rem] translate-y-1.5 drop-shadow-[0_8px_18px_rgb(8_47_73/0.28)]",
            "md:h-[5.25rem] md:w-[5.25rem] md:translate-y-2",
            hero &&
              "h-[5rem] w-[5rem] translate-y-2 drop-shadow-[0_6px_16px_rgb(0_0_0/0.45)] md:h-[5.75rem] md:w-[5.75rem] md:translate-y-2.5",
          )}
          width={84}
          height={84}
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
