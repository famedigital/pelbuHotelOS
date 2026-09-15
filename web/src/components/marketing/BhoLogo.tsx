import { BRAND_ICONS } from "@/lib/brand";
import { SITE_FULL_NAME, SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

type BhoLogoProps = {
  /** Use light SVG on dark backgrounds. */
  variant?: "default" | "light";
  /** Show the BHO wordmark beside the mark. */
  showWordmark?: boolean;
  /** Optional full name under or beside the wordmark. */
  showFullName?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  wordmarkClassName?: string;
};

const SIZE = {
  sm: { mark: 28, word: "text-lg", full: "text-[0.65rem]" },
  md: { mark: 36, word: "text-xl", full: "text-xs" },
  lg: { mark: 48, word: "text-3xl", full: "text-sm" },
  xl: { mark: 64, word: "text-5xl md:text-7xl", full: "text-sm md:text-base" },
} as const;

export function BhoLogo({
  variant = "default",
  showWordmark = true,
  showFullName = false,
  size = "md",
  className,
  wordmarkClassName,
}: BhoLogoProps) {
  const s = SIZE[size];
  const src = variant === "light" ? BRAND_ICONS.markLight : BRAND_ICONS.mark;

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={s.mark}
        height={s.mark}
        className="shrink-0 object-contain"
        aria-hidden
      />
      {showWordmark ? (
        <span className="flex min-w-0 flex-col leading-none">
          <span
            className={cn(
              "font-display tracking-tight",
              s.word,
              wordmarkClassName,
            )}
          >
            {SITE_NAME}
          </span>
          {showFullName ? (
            <span
              className={cn(
                "mt-1 font-sans font-medium tracking-[0.12em] uppercase opacity-70",
                s.full,
              )}
            >
              {SITE_FULL_NAME}
            </span>
          ) : null}
        </span>
      ) : (
        <span className="sr-only">{SITE_NAME}</span>
      )}
    </span>
  );
}
