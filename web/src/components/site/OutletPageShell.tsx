import { MediaGallery } from "@/components/media/MediaGallery";
import { CloudinaryImage } from "@/components/media/CloudinaryImage";
import {
  PhotoSlideshow,
  type SlideshowPhoto,
} from "@/components/home/PhotoSlideshow";
import { CmsContentSections } from "@/components/site/CmsContentSections";
import { MenuSections } from "@/components/site/MenuSections";
import { PublicSiteHeader } from "@/components/site/PublicSiteHeader";
import {
  SiteBreadcrumbs,
  type BreadcrumbItem,
} from "@/components/site/SiteBreadcrumbs";
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
  /** Kept for call-site compat; cedar uses a single outlet accent. */
  accent?: "sky" | "citrus" | "mint";
  breadcrumbs?: BreadcrumbItem[];
  children?: ReactNode;
};

/**
 * Outlet shell: full-bleed forest title + image split, then menu / gallery.
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
  breadcrumbs,
  children,
}: Props) {
  const hasMenu = byCategory.size > 0;

  return (
    <>
      <PublicSiteHeader variant="solid" />
      <main className="min-h-[70dvh] bg-mist-0">
        <section className="relative overflow-hidden border-b border-forest bg-forest text-[#f2f4f3]">
          <div
            className="absolute inset-x-0 bottom-0 h-0.5 bg-ember"
            aria-hidden
          />
          <div className="mx-auto grid max-w-[1200px] items-center gap-8 px-5 py-10 md:px-8 md:py-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
            <div className="max-w-xl">
              {breadcrumbs && breadcrumbs.length >= 2 ? (
                <SiteBreadcrumbs
                  items={breadcrumbs}
                  className="mb-4 text-white/70 [&_a]:text-white/70 [&_a:hover]:text-white"
                />
              ) : null}
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-celadon">
                {eyebrow}
              </p>
              <h1 className="mt-3 font-display text-3xl leading-tight md:text-5xl">
                {title}
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-white/70 md:text-base">
                {description}
              </p>

              {hoursNote ? (
                <p className="mt-5 inline-flex items-center gap-2 border border-white/20 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85">
                  <Clock3Icon className="size-3.5 shrink-0" aria-hidden />
                  {hoursNote}
                </p>
              ) : null}

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={primaryCta.href}
                  className={cn(
                    buttonVariants({ variant: "ember", size: "lg" }),
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
                      "border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white",
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
                className="aspect-[4/3] w-full rounded-md shadow-[0_30px_60px_-32px_rgba(14,22,19,0.65)]"
                sizes="(max-width: 1024px) 100vw, 520px"
              />
            ) : null}
          </div>
        </section>

        <div className="mx-auto max-w-[1200px] space-y-14 px-5 py-10 md:px-8 md:py-16">
          <CmsContentSections sections={sections} />

          {children}

          <section
            aria-labelledby="outlet-menu-heading"
            className="border-t border-cedar-rule pt-12"
          >
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-juniper">
                  Live menu
                </p>
                <h2
                  id="outlet-menu-heading"
                  className="mt-2 font-display text-2xl text-foreground md:text-3xl"
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
            <section
              aria-labelledby="sister-outlets-heading"
              className="border-t border-cedar-rule pt-12"
            >
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-juniper">
                  More to try
                </p>
                <h2
                  id="sister-outlets-heading"
                  className="mt-2 font-display text-2xl text-foreground"
                >
                  Other outlets at Pelbu
                </h2>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sisters.map((sister) => (
                  <li key={sister.href}>
                    <Link
                      href={sister.href}
                      className="group flex overflow-hidden border border-cedar-rule bg-white transition-shadow hover:shadow-md"
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
                        <span className="text-[15px] font-semibold text-foreground group-hover:text-juniper">
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
