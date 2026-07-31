import { MediaGallery } from "@/components/media/MediaGallery";
import { CloudinaryImage } from "@/components/media/CloudinaryImage";
import {
  PhotoSlideshow,
  type SlideshowPhoto,
} from "@/components/home/PhotoSlideshow";
import { CmsContentSections } from "@/components/site/CmsContentSections";
import { MenuSections } from "@/components/site/MenuSections";
import { PublicSiteHeader } from "@/components/site/PublicSiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { buttonVariants } from "@/components/ui/button";
import type { CmsContentSection, CmsMediaItem } from "@/lib/cms";
import type { MenuItem } from "@/lib/menu";
import { cn } from "@/lib/utils";
import { ArrowRightIcon, Clock3Icon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type OutletSister = {
  href: string;
  title: string;
  description: string;
  publicId: string;
};

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  hoursNote?: string | null;
  primaryCta: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
  /** Known-good hero photography — never pass IDs that 404 on Cloudinary. */
  heroPhotos: SlideshowPhoto[];
  sections?: CmsContentSection[] | null;
  byCategory: Map<string, MenuItem[]>;
  orderBaseHref?: string;
  gallery: CmsMediaItem[];
  galleryLabel: string;
  sisters?: OutletSister[];
  accent?: "sky" | "citrus" | "mint";
  children?: ReactNode;
};

const ACCENT_SURFACE = {
  sky: "from-sky-100/80 via-background to-background",
  citrus: "from-citrus-tint/70 via-background to-background",
  mint: "from-mint-100/70 via-background to-background",
} as const;

const ACCENT_EYEBROW = {
  sky: "text-sky-700",
  citrus: "text-citrus-600",
  mint: "text-mint-600",
} as const;

/**
 * Shared public shell for restaurant / cafe / bar. Hero photography + hours +
 * CTAs up top, then CMS copy, the live menu, a gallery, and sister outlets.
 * Replaces the flat EngineShell header those pages used to share.
 */
export function OutletPageShell({
  eyebrow,
  title,
  description,
  hoursNote,
  primaryCta,
  secondaryCta,
  heroPhotos,
  sections,
  byCategory,
  orderBaseHref,
  gallery,
  galleryLabel,
  sisters = [],
  accent = "sky",
  children,
}: Props) {
  const hasMenu = byCategory.size > 0;

  return (
    <>
      <PublicSiteHeader variant="solid" />
      <main className="min-h-[70dvh] bg-background">
        <section
          className={cn(
            "relative overflow-hidden border-b border-border bg-gradient-to-br",
            ACCENT_SURFACE[accent],
          )}
        >
          <div className="mx-auto grid max-w-[1200px] items-center gap-8 px-5 py-10 md:px-8 md:py-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
            <div className="max-w-xl">
              <p
                className={cn(
                  "text-sm font-semibold uppercase tracking-[0.16em]",
                  ACCENT_EYEBROW[accent],
                )}
              >
                {eyebrow}
              </p>
              <h1 className="mt-3 font-display text-3xl leading-tight text-foreground md:text-5xl">
                {title}
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground md:text-base">
                {description}
              </p>

              {hoursNote ? (
                <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-sky-700 backdrop-blur">
                  <Clock3Icon className="size-3.5 shrink-0" aria-hidden />
                  {hoursNote}
                </p>
              ) : null}

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={primaryCta.href}
                  className={cn(
                    buttonVariants({ variant: "citrus", size: "lg" }),
                  )}
                >
                  {primaryCta.label}
                  <ArrowRightIcon aria-hidden />
                </Link>
                {secondaryCta ? (
                  <Link
                    href={secondaryCta.href}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                    )}
                  >
                    {secondaryCta.label}
                  </Link>
                ) : null}
              </div>
            </div>

            {heroPhotos.length > 0 ? (
              <PhotoSlideshow
                photos={heroPhotos}
                priority
                className="aspect-[4/3] w-full rounded-2xl shadow-[0_30px_60px_-32px_rgba(8,47,73,0.45)]"
                sizes="(max-width: 1024px) 100vw, 520px"
              />
            ) : null}
          </div>
        </section>

        <div className="mx-auto max-w-[1200px] space-y-14 px-5 py-10 md:px-8 md:py-16">
          <CmsContentSections sections={sections} />

          {children}

          <section aria-labelledby="outlet-menu-heading">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-sky-700">Live menu</p>
                <h2
                  id="outlet-menu-heading"
                  className="mt-1 font-display text-2xl text-foreground md:text-3xl"
                >
                  What we are cooking
                </h2>
              </div>
              {hasMenu && orderBaseHref ? (
                <Link
                  href={primaryCta.href}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                  )}
                >
                  Order online
                  <ArrowRightIcon aria-hidden />
                </Link>
              ) : null}
            </div>
            <MenuSections
              byCategory={byCategory}
              orderBaseHref={orderBaseHref}
            />
          </section>

          <MediaGallery items={gallery} label={galleryLabel} />

          {sisters.length > 0 ? (
            <section aria-labelledby="sister-outlets-heading">
              <div className="mb-5">
                <p className="text-sm font-medium text-sky-700">More to try</p>
                <h2
                  id="sister-outlets-heading"
                  className="mt-1 font-display text-2xl text-foreground"
                >
                  Other outlets at Pelbu
                </h2>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sisters.map((sister) => (
                  <li key={sister.href}>
                    <Link
                      href={sister.href}
                      className="group media-card flex overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
                    >
                      <div className="relative w-28 shrink-0 sm:w-32">
                        <CloudinaryImage
                          publicId={sister.publicId}
                          alt=""
                          fill
                          sizes="128px"
                          imgClassName="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"
                        />
                      </div>
                      <span className="flex min-w-0 flex-1 flex-col justify-center p-4">
                        <span className="text-[15px] font-semibold text-foreground group-hover:text-sky-700">
                          {sister.title}
                        </span>
                        <span className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                          {sister.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
