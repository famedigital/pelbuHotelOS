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
  sky: "bg-mist-0",
  citrus: "bg-mist-1",
  mint: "bg-mist-0",
  spa: "bg-forest text-[#f2f4f3]",
  espresso: "bg-forest text-[#f2f4f3]",
};

const HEAD_ACCENT: Record<StoryAccent, "juniper" | "ember"> = {
  sky: "juniper",
  citrus: "ember",
  mint: "juniper",
  spa: "juniper",
  espresso: "ember",
};

type Props = {
  id: string;
  block: StoryBlock;
  reverse?: boolean;
  menuItems?: MenuItem[];
  children?: ReactNode;
  className?: string;
};

/** Editorial story band — image + copy split; forest for dark accents. */
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
    ...block.gallery_public_ids.filter((pid) => pid !== block.public_id),
  ].filter(Boolean) as string[];
  const lead = photos[0];
  const leadSrc = lead
    ? cloudinaryUrl(lead, {
        width: 1400,
        crop: "limit",
        quality: "auto:best",
      })
    : null;
  const objectPosition = `${focal.x * 100}% ${focal.y * 100}%`;

  return (
    <section id={id} className={cn("relative", SURFACE[accent], className)}>
      {dark ? (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-ember" aria-hidden />
      ) : null}
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-2 lg:gap-16">
        {leadSrc ? (
          <div
            className={cn(
              "relative aspect-[4/3] w-full overflow-hidden",
              reverse && "lg:order-2",
            )}
          >
            <Image
              src={leadSrc}
              alt={block.title}
              fill
              sizes="(max-width: 1024px) 100vw, 560px"
              className="object-cover"
              style={{ objectPosition }}
            />
            {photos.length > 1 ? (
              <ul className="absolute inset-x-3 bottom-3 flex gap-2 overflow-x-auto">
                {photos.slice(1, 4).map((pid) => {
                  const thumb = cloudinaryUrl(pid, {
                    width: 280,
                    crop: "limit",
                  });
                  if (!thumb) return null;
                  return (
                    <li
                      key={pid}
                      className="relative h-14 w-20 shrink-0 overflow-hidden border border-white/40"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumb}
                        alt=""
                        className="h-full w-full object-cover"
                        style={{ objectPosition }}
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
              "aspect-[4/3] w-full bg-black/10",
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
            className={
              dark ? "[&_h2]:text-white [&_p]:text-white/75" : undefined
            }
          />

          {block.amount_btn != null ? (
            <div
              className={cn(
                "mt-6 border px-5 py-4",
                dark
                  ? "border-ember/50 bg-ember/15"
                  : "border-ember-tint bg-ember-tint/60",
              )}
            >
              <p
                className={cn(
                  "text-xs font-semibold uppercase tracking-[0.18em]",
                  dark ? "text-ember-soft" : "text-ember-deep",
                )}
              >
                {block.amount_note ?? "Package"}
              </p>
              <p
                className={cn(
                  "mt-1 font-display text-3xl font-semibold tabular-nums",
                  dark ? "text-[#f2f4f3]" : "text-foreground",
                )}
              >
                {formatBtn(block.amount_btn)}
                <span className="ml-2 font-sans text-base font-medium opacity-80">
                  pp
                </span>
              </p>
            </div>
          ) : null}

          {menuItems.length > 0 ? (
            <ul
              className={cn(
                "mt-6 divide-y border",
                dark
                  ? "divide-white/10 border-white/15 bg-white/5"
                  : "divide-cedar-rule border-cedar-rule bg-white",
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
                      <span className="ml-2 bg-ember-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ember-deep">
                        Popular
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      dark ? "text-celadon" : "text-juniper",
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
                "inline-flex h-12 items-center rounded-md px-6 text-sm font-semibold",
                dark
                  ? "bg-ember text-white hover:bg-ember-deep"
                  : "bg-juniper text-white hover:bg-juniper-soft",
              )}
            >
              {block.primary_label}
            </Link>
            {block.secondary_href && block.secondary_label ? (
              <Link
                href={block.secondary_href}
                className={cn(
                  "inline-flex h-12 items-center rounded-md border px-6 text-sm font-semibold",
                  dark
                    ? "border-white/25 bg-white/10 text-white hover:bg-white/15"
                    : "border-cedar-rule bg-white text-foreground hover:bg-mist-1",
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
