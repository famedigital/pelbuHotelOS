import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  eyebrow: string;
  title: string;
  body: string;
  children: ReactNode;
  aside?: ReactNode;
};

/** Dark hero + ivory content shell shared by Book / Order. */
export function ConversionShell({
  eyebrow,
  title,
  body,
  children,
  aside,
}: Props) {
  return (
    <>
      <div className="relative bg-espresso">
        <SiteHeader />
        <div className="mx-auto max-w-[1200px] px-6 pb-16 pt-28 md:px-8 md:pt-32">
          <p className="text-xs tracking-[0.3em] text-gold uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl leading-tight text-white md:text-5xl md:leading-tight">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75">
            {body}
          </p>
          <p className="mt-8 text-sm text-white/55">
            Prefer the desk?{" "}
            <Link
              href="/contact"
              className="text-gold underline-offset-4 hover:underline"
            >
              Contact us
            </Link>
            {" · "}
            <Link
              href="/agents"
              className="text-gold underline-offset-4 hover:underline"
            >
              Agent booking
            </Link>
          </p>
        </div>
      </div>

      <main className="mx-auto grid max-w-[1200px] gap-10 px-6 py-12 md:grid-cols-[minmax(0,1fr)_320px] md:gap-12 md:px-8 md:py-20">
        <div className="min-w-0">{children}</div>
        {aside ? <aside className="md:pt-1">{aside}</aside> : null}
      </main>

      <SiteFooter />
    </>
  );
}
