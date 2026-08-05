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
 * Compact shell for task-first public engines. Marketing heroes belong on the
 * homepage; booking, ordering, spa and meeting routes open directly on task.
 * Extra top air under the rail keeps the oversized brand mark from colliding
 * with the page eyebrow.
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
      <main className="min-h-[70dvh] bg-background">
        <header className="border-b border-border bg-sky-100/40 pt-4 md:pt-5">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-5 pb-8 pt-6 md:flex-row md:items-end md:justify-between md:px-8 md:pb-10 md:pt-8">
            <div className="max-w-2xl">
              {breadcrumbs && breadcrumbs.length >= 2 ? (
                <SiteBreadcrumbs
                  items={breadcrumbs}
                  className="mb-3"
                  tone="on-muted"
                />
              ) : null}
              <p className="text-sm font-medium text-sky-700">{eyebrow}</p>
              <h1 className="mt-2 font-display text-3xl leading-tight text-foreground md:text-4xl">
                {title}
              </h1>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
            {actions ? (
              <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
            ) : null}
          </div>
        </header>
        <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8 md:py-12">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
