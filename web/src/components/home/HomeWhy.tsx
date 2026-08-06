import { HomeSectionHead } from "@/components/home/HomeSectionHead";
import { HomeWhyReasons } from "@/components/home/HomeWhyReasons";
import Link from "next/link";

/**
 * Why book Pelbu — interactive reasons (accordion on phone, tabs on desktop)
 * plus a soft CTA band to convert.
 */
export function HomeWhy() {
  return (
    <section
      id="why"
      className="bg-gradient-to-b from-background via-frost-2/50 to-background py-12 md:py-20"
    >
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <HomeSectionHead
          eyebrow="Why Pelbu Suites"
          title="A hotel that behaves like a good host."
          description="Straight pricing, real people at the desk, and every service you need for a Thimphu trip in the same building."
          accent="citrus"
        />

        <div className="mt-7 md:mt-10">
          <HomeWhyReasons />
        </div>

        <div className="relative mt-10 overflow-hidden rounded-2xl bg-sky-ink px-5 py-9 md:mt-14 md:rounded-[2rem] md:px-12 md:py-12">
          <div
            className="absolute -left-10 top-0 size-72 rounded-full bg-sky-500/30 blur-[100px]"
            aria-hidden
          />
          <div
            className="absolute -right-10 bottom-0 size-72 rounded-full bg-citrus/20 blur-[100px]"
            aria-hidden
          />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-6">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl leading-tight text-white md:text-4xl">
                Ready when you are.
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-white/75 md:mt-3">
                Check live rooms and confirm direct — or message the desk if you
                need a group or meal plan sorted first.
              </p>
            </div>
            <div className="relative flex flex-wrap gap-3">
              <Link
                href="/book"
                className="inline-flex h-11 items-center rounded-xl bg-gradient-to-r from-citrus-soft to-citrus px-5 text-sm font-semibold text-sky-ink shadow-[0_16px_40px_-16px_rgba(245,158,11,0.9)] transition-transform motion-safe:hover:-translate-y-0.5 md:h-12 md:px-6"
              >
                Book a stay
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-11 items-center rounded-xl border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20 md:h-12 md:px-6"
              >
                Talk to the desk
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
