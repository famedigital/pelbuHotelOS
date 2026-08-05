import { HomeSectionHead } from "@/components/home/HomeSectionHead";
import { Reveal } from "@/components/home/Reveal";
import type { StoryAccent, StoryBlock } from "@/lib/home-story";
import { cloudinaryUrl, normalizeFocal } from "@/lib/cloudinary";
import type { MenuItem } from "@/lib/menu";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

const SURFACE: Record<StoryAccent, string> = {
  sky: "bg-gradient-to-br from-sky-100/90 via-background to-sky-50/40",
  citrus: "bg-gradient-to-br from-amber-50 via-background to-orange-50/50",
  mint: "bg-gradient-to-br from-emerald-50/90 via-background to-teal-50/40",
  spa: "bg-gradient-to-br from-[#0f2a28] via-[#143532] to-[#0a1f1d] text-white",
  espresso:
    "bg-gradient-to-br from-[#1a0f0a] via-[#2a1810] to-[#1a0f0a] text-white",
};

const HEAD_ACCENT: Record<
  StoryAccent,
  "sky" | "citrus" | "mint"
> = {
  sky: "sky",
  citrus: "citrus",
  mint: "mint",
  spa: "mint",
  espresso: "citrus",
};

const CTA: Record<StoryAccent, string> = {
  sky: "bg-gradient-to-r from-sky-600 to-sky-500 text-white shadow-[0_16px_40px_-18px_rgba(2,132,199,0.9)]",
  citrus:
    "bg-gradient-to-r from-amber-500 to-orange-400 text-[#1a0f0a] shadow-[0_16px_40px_-18px_rgba(245,158,11,0.9)]",
  mint: "bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-[0_16px_40px_-18px_rgba(16,185,129,0.9)]",
  spa: "bg-gradient-to-r from-teal-400 to-emerald-500 text-[#0f2a28] shadow-[0_16px_40px_-18px_rgba(45,212,191,0.5)]",
  espresso:
    "bg-gradient-to-r from-amber-400 to-amber-300 text-[#1a0f0a] shadow-[0_16px_40px_-18px_rgba(251,191,36,0.55)]",
};

const SECONDARY: Record<StoryAccent, string> = {
  sky: "border-border bg-white/80 text-foreground hover:bg-white",
  citrus: "border-border bg-white/80 text-foreground hover:bg-white",
  mint: "border-border bg-white/80 text-foreground hover:bg-white",
  spa: "border-white/25 bg-white/10 text-white hover:bg-white/15",
  espresso: "border-white/25 bg-white/10 text-white hover:bg-white/15",
};

type Props = {
  id: string;
  block: StoryBlock;
  reverse?: boolean;
  menuItems?: MenuItem[];
  children?: ReactNode;
  className?: string;
};

/**
 * Brochure story band — photo + copy with premium gradient, CMS-driven.
 */
export function HomeStorySection({
  id,
  block,
  reverse,
  menuItems = [],
  children,
  className,
}: Props) {
  if (!block.enabled) return null;

  const accent = block.accent;
  const dark = accent === "spa" || accent === "espresso";
  const focal = normalizeFocal(block.focal_x, block.focal_y);
  const photos = [
    block.public_id,
    ...block.gallery_public_ids.filter((id) => id !== block.public_id),
  ].filter(Boolean) as string[];
  const lead = photos[0];
  const leadSrc = lead
    ? cloudinaryUrl(lead, {
        width: 1200,
        height: 900,
        crop: "fill",
        gravity: focal,
        quality: "auto:best",
        improve: true,
      })
    : null;

  return (
    <section
      id={id}
      className={cn("relative", SURFACE[accent], className)}
    >
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-2 lg:gap-16">
        {leadSrc ? (
          <div
            className={cn(
              "relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-[0_30px_60px_-32px_rgba(8,47,73,0.5)]",
              reverse && "lg:order-2",
            )}
          >
            <Image
              src={leadSrc}
              alt={block.title}
              fill
              sizes="(max-width: 1024px) 100vw, 560px"
              className="object-cover"
            />
            {photos.length > 1 ? (
              <ul className="absolute inset-x-3 bottom-3 flex gap-2 overflow-x-auto">
                {photos.slice(1, 4).map((pid) => {
                  const thumb = cloudinaryUrl(pid, {
                    width: 200,
                    height: 140,
                    crop: "fill",
                    gravity: focal,
                  });
                  if (!thumb) return null;
                  return (
                    <li
                      key={pid}
                      className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-white/40 shadow"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumb}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : (
          <div
            className={cn(
              "aspect-[4/3] w-full rounded-2xl bg-black/10",
              reverse && "lg:order-2",
            )}
          />
        )}

        <Reveal className={cn("w-full", reverse && "lg:order-1")}>
          <HomeSectionHead
            eyebrow={block.eyebrow}
            title={block.title}
            description={block.body}
            accent={HEAD_ACCENT[accent]}
            className={dark ? "[&_h2]:text-white [&_p]:text-white/75" : undefined}
          />

          {block.amount_btn != null ? (
            <div
              className={cn(
                "mt-6 rounded-2xl border px-5 py-4",
                dark
                  ? "border-amber-400/40 bg-gradient-to-br from-amber-400/20 to-amber-500/10"
                  : "border-amber-300/80 bg-gradient-to-br from-amber-50 to-orange-50",
              )}
            >
              <p
                className={cn(
                  "text-xs font-semibold uppercase tracking-[0.18em]",
                  dark ? "text-amber-200" : "text-amber-800",
                )}
              >
                {block.amount_note ?? "Package"}
              </p>
              <p
                className={cn(
                  "mt-1 font-display text-3xl font-semibold tabular-nums",
                  dark ? "text-amber-100" : "text-foreground",
                )}
              >
                {formatBtn(block.amount_btn)}
                <span className="ml-2 text-base font-sans font-medium opacity-80">
                  pp
                </span>
              </p>
            </div>
          ) : null}

          {menuItems.length > 0 ? (
            <ul
              className={cn(
                "mt-6 divide-y rounded-2xl border shadow-[0_20px_50px_-28px_rgba(8,47,73,0.35)] backdrop-blur",
                dark
                  ? "divide-white/10 border-white/15 bg-white/10"
                  : "divide-border/70 border-white/80 bg-white/80",
              )}
            >
              {menuItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-baseline justify-between gap-4 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "text-[15px] font-medium",
                        dark ? "text-white" : "text-foreground",
                      )}
                    >
                      {item.name}
                    </span>
                    {item.is_popular ? (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                        Popular
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      dark ? "text-teal-200" : "text-sky-700",
                    )}
                  >
                    {formatBtn(item.price_btn)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {children}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={block.primary_href}
              className={cn(
                "inline-flex h-12 items-center rounded-xl px-6 text-sm font-semibold transition-transform motion-safe:hover:-translate-y-0.5",
                CTA[accent],
              )}
            >
              {block.primary_label}
            </Link>
            {block.secondary_href && block.secondary_label ? (
              <Link
                href={block.secondary_href}
                className={cn(
                  "inline-flex h-12 items-center rounded-xl border px-6 text-sm font-semibold backdrop-blur",
                  SECONDARY[accent],
                )}
              >
                {block.secondary_label}
              </Link>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
