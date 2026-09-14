import { SiteFooter } from "@/components/site/SiteFooter";
import { PublicSiteHeader } from "@/components/site/PublicSiteHeader";
import {
  SiteBreadcrumbs,
  type BreadcrumbItem,
} from "@/components/site/SiteBreadcrumbs";
import type { ReactNode } from "react";

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Visible trail for Google SEO — pair with breadcrumbJsonLd in the page. */
  breadcrumbs?: BreadcrumbItem[];
};

/**
 * Cedar engine shell: full-bleed forest title band + asymmetric content frame.
 * Marketing heroes stay on the homepage; task routes open directly on work.
 */
export function EngineShell({
  eyebrow,
  title,
  description,
  children,
  actions,
  breadcrumbs,
}: Props) {
  return (
    <>
      <PublicSiteHeader variant="solid" />
      <main className="min-h-[70dvh] bg-mist-0">
        <header className="relative overflow-hidden border-b border-forest bg-forest text-[#f2f4f3]">
          <div
            className="absolute inset-x-0 bottom-0 h-0.5 bg-ember"
            aria-hidden
          />
          <div className="mx-auto grid max-w-[1200px] gap-8 px-5 pb-10 pt-8 md:grid-cols-[minmax(0,1.4fr)_auto] md:items-end md:px-8 md:pb-12 md:pt-10">
            <div className="max-w-2xl">
              {breadcrumbs && breadcrumbs.length >= 2 ? (
                <SiteBreadcrumbs
                  items={breadcrumbs}
                  className="mb-4 text-white/70 [&_a]:text-white/70 [&_a:hover]:text-white"
                  tone="on-muted"
                />
              ) : null}
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-celadon">
                {eyebrow}
              </p>
              <h1 className="mt-3 font-display text-3xl leading-tight md:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">
                {description}
              </p>
            </div>
            {actions ? (
              <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                {actions}
              </div>
            ) : null}
          </div>
        </header>
        <div className="mx-auto max-w-[1200px] px-5 py-10 md:px-8 md:py-14">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
