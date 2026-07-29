import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import type { ReactNode } from "react";

type Props = {
  eyebrow: string;
  title: string;
  body: string;
  children: ReactNode;
  aside?: ReactNode;
  heroSrc?: string | null;
  logoSrc?: string | null;
};

/**
 * Conversion shell — one quiet ink intro, then content.
 * No brass hairlines, no “prefer the desk” chrome, no card wrappers.
 */
export function ConversionShell({
  eyebrow,
  title,
  body,
  children,
  aside,
  heroSrc,
  logoSrc,
}: Props) {
  return (
    <>
      <section className="relative overflow-hidden bg-ink">
        {heroSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            width={1600}
            height={900}
            fetchPriority="high"
          />
        ) : null}
        <div
          className={`absolute inset-0 ${
            heroSrc
              ? "bg-gradient-to-t from-ink via-ink/75 to-ink/45"
              : ""
          }`}
          aria-hidden
        />

        <div className="relative">
          <SiteHeader logoSrc={logoSrc} variant="ink" />

          <div className="mx-auto max-w-[1120px] px-5 pb-14 pt-28 md:px-8 md:pb-16 md:pt-32">
            <p className="label-quiet label-quiet--on-ink">{eyebrow}</p>
            <h1 className="mt-3 max-w-2xl font-display text-[2rem] leading-[1.15] text-ivory md:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ivory/70">
              {body}
            </p>
          </div>
        </div>
      </section>

      <main className="bg-background">
        <div
          className={`mx-auto max-w-[1120px] gap-12 px-5 py-12 md:px-8 md:py-16 ${
            aside
              ? "grid md:grid-cols-[minmax(0,1fr)_280px] md:gap-16"
              : ""
          }`}
        >
          <div className="min-w-0">{children}</div>
          {aside ? (
            <aside className="space-y-4 text-sm text-muted-foreground md:pt-1">
              {aside}
            </aside>
          ) : null}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
