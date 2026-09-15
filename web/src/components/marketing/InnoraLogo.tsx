import { BRAND_ICONS } from "@/lib/brand";
import { SITE_FULL_NAME, SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

type InnoraLogoProps = {
  variant?: "default" | "light";
  showWordmark?: boolean;
  showTagline?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  wordmarkClassName?: string;
};

const SIZE = {
  sm: { mark: 28, word: "text-lg", tag: "text-[0.65rem]" },
  md: { mark: 36, word: "text-xl", tag: "text-xs" },
  lg: { mark: 48, word: "text-3xl", tag: "text-sm" },
  xl: { mark: 72, word: "text-5xl md:text-6xl", tag: "text-sm md:text-base" },
} as const;

export function InnoraLogo({
  variant = "default",
  showWordmark = true,
  showTagline = false,
  size = "md",
  className,
  wordmarkClassName,
}: InnoraLogoProps) {
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
        className="shrink-0 rounded-2xl object-contain shadow-sm"
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
          {showTagline ? (
            <span
              className={cn(
                "mt-1.5 font-sans font-medium tracking-[0.08em] text-muted-foreground",
                s.tag,
              )}
            >
              hotel software for Bhutan
            </span>
          ) : null}
        </span>
      ) : (
        <span className="sr-only">{SITE_FULL_NAME}</span>
      )}
    </span>
  );
}
