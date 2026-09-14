import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";

const EYEBROW_ACCENT = {
  sky: "text-juniper",
  citrus: "text-ember",
  mint: "text-juniper-soft",
  juniper: "text-juniper",
  ember: "text-ember",
} as const;

export type SectionAccent = keyof typeof EYEBROW_ACCENT;

/** Shared section header — quiet uppercase label, display heading. */
export function HomeSectionHead({
  eyebrow,
  title,
  description,
  accent = "juniper",
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
            "text-xs font-semibold uppercase tracking-[0.2em]",
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
            "shrink-0 text-sm font-semibold text-juniper underline-offset-4 hover:underline",
            centered && "self-center",
          )}
        >
          {link.label} →
        </Link>
      ) : null}
    </div>
  );
}
