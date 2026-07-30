import { HomeSectionHead, type SectionAccent } from "@/components/home/HomeSectionHead";
import {
  PhotoSlideshow,
  type SlideshowPhoto,
} from "@/components/home/PhotoSlideshow";
import { Reveal } from "@/components/home/Reveal";
import type { MenuItem } from "@/lib/menu";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import Link from "next/link";

const SURFACE: Record<SectionAccent, string> = {
  sky: "bg-gradient-to-br from-sky-100/80 via-background to-background",
  citrus: "bg-gradient-to-br from-citrus-tint/80 via-background to-background",
  mint: "bg-gradient-to-br from-mint-100/80 via-background to-background",
};

const CTA: Record<SectionAccent, string> = {
  sky: "bg-gradient-to-r from-sky-600 to-sky-500 text-white shadow-[0_16px_40px_-18px_rgba(2,132,199,0.9)]",
  citrus:
    "bg-gradient-to-r from-citrus-soft to-citrus text-sky-ink shadow-[0_16px_40px_-18px_rgba(245,158,11,0.9)]",
  mint: "bg-gradient-to-r from-mint-500 to-mint-600 text-white shadow-[0_16px_40px_-18px_rgba(16,185,129,0.9)]",
};

type Props = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  note?: string | null;
  /** Curated, known-good Cloudinary photos. Do not pass DB IDs that 404. */
  photos: SlideshowPhoto[];
  items: MenuItem[];
  accent: SectionAccent;
  reverse?: boolean;
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
};

/**
 * Outlet teaser — a photo and a menu panel side by side inside the page
 * container, sides alternating down the page. The photo is held to a 4:3 frame
 * rather than filling the section so the three outlets read as a set instead of
 * three full-bleed walls.
 */
export function HomeOutletSection({
  id,
  eyebrow,
  title,
  description,
  note,
  photos,
  items,
  accent,
  reverse,
  primary,
  secondary,
}: Props) {
  return (
    <section id={id} className={cn("relative", SURFACE[accent])}>
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-2 lg:gap-16">
        <PhotoSlideshow
          photos={photos}
          className={cn(
            "aspect-[4/3] w-full rounded-2xl shadow-[0_30px_60px_-32px_rgba(8,47,73,0.5)]",
            reverse && "lg:order-2",
          )}
          sizes="(max-width: 1024px) 100vw, 560px"
        />

        <Reveal className={cn("w-full", reverse && "lg:order-1")}>
          <HomeSectionHead
            eyebrow={eyebrow}
            title={title}
            description={description}
            accent={accent}
          />

          {note ? (
            <p className="mt-4 inline-flex rounded-full bg-white/70 px-4 py-1.5 text-xs font-medium text-sky-700 backdrop-blur">
              {note}
            </p>
          ) : null}

          {items.length > 0 ? (
            <ul className="mt-6 divide-y divide-border/70 rounded-2xl border border-white/80 bg-white/80 shadow-[0_20px_50px_-28px_rgba(8,47,73,0.35)] backdrop-blur">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-baseline justify-between gap-4 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="text-[15px] font-medium text-foreground">
                      {item.name}
                    </span>
                    {item.is_popular ? (
                      <span className="ml-2 rounded-full bg-citrus-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-citrus-600">
                        Popular
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-sky-700">
                    {formatBtn(item.price_btn)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={primary.href}
              className={cn(
                "inline-flex h-12 items-center rounded-xl px-6 text-sm font-semibold transition-transform motion-safe:hover:-translate-y-0.5",
                CTA[accent],
              )}
            >
              {primary.label}
            </Link>
            <Link
              href={secondary.href}
              className="inline-flex h-12 items-center rounded-xl border border-border bg-white/80 px-6 text-sm font-semibold text-foreground backdrop-blur hover:bg-white"
            >
              {secondary.label}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
