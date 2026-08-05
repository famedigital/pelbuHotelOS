import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";

const EYEBROW_ACCENT = {
  sky: "from-sky-600 to-sky-500",
  citrus: "from-citrus-600 to-citrus",
  mint: "from-mint-600 to-mint-500",
} as const;

export type SectionAccent = keyof typeof EYEBROW_ACCENT;

/** Shared section header: gradient eyebrow, display heading, optional side link. */
export function HomeSectionHead({
  eyebrow,
  title,
  description,
  accent = "sky",
  link,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  accent?: SectionAccent;
  link?: { href: string; label: string };
  className?: string;
}) {
  const centered = Boolean(className?.includes("text-center"));

  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className={cn("max-w-2xl", centered && "mx-auto w-full max-w-2xl")}>
        <p
          className={cn(
            "bg-gradient-to-r bg-clip-text text-xs font-semibold uppercase tracking-[0.24em] text-transparent",
            EYEBROW_ACCENT[accent],
          )}
        >
          {eyebrow}
        </p>
        <h2 className="mt-3 font-display text-3xl leading-tight text-foreground md:text-4xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {link ? (
        <Link
          href={link.href}
          className={cn(
            "shrink-0 text-sm font-semibold text-sky-700 underline-offset-4 hover:underline",
            centered && "self-center",
          )}
        >
          {link.label} →
        </Link>
      ) : null}
    </div>
  );
}
