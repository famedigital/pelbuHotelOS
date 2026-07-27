import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import Link from "next/link";

type Props = {
  title: string;
  eyebrow: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

/** Shared production shell for stream pages until each has full CMS content. */
export function StreamPage({
  title,
  eyebrow,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: Props) {
  return (
    <>
      <div className="relative bg-espresso">
        <SiteHeader />
        <div className="mx-auto max-w-[1200px] px-6 pb-16 pt-28 md:px-8 md:pt-32">
          <p className="text-xs tracking-[0.3em] text-gold uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl text-white md:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-white/75">{body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={primaryHref}
              className="inline-flex min-h-11 items-center rounded-sm bg-gold px-6 text-sm font-medium text-espresso"
            >
              {primaryLabel}
            </Link>
            {secondaryHref && secondaryLabel ? (
              <Link
                href={secondaryHref}
                className="inline-flex min-h-11 items-center rounded-sm border border-white/35 px-6 text-sm text-white"
              >
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
