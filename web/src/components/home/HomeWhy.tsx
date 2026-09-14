import { HomeSectionHead } from "@/components/home/HomeSectionHead";
import { HomeWhyReasons } from "@/components/home/HomeWhyReasons";
import Link from "next/link";

/** Why Pelbu — timeline-style reasons + forest CTA band. */
export function HomeWhy() {
  return (
    <section id="why" className="bg-mist-1 py-16 md:py-24">
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <HomeSectionHead
          eyebrow="Why Pelbu Suites"
          title="A hotel that behaves like a good host."
          description="Straight pricing, real people at the desk, and every service you need for a Thimphu trip in the same building."
          accent="ember"
        />

        <div className="mt-10 border-l-2 border-ember/40 pl-6 md:pl-10">
          <HomeWhyReasons />
        </div>

        <div className="relative mt-14 overflow-hidden bg-forest px-5 py-10 text-[#f2f4f3] md:px-12 md:py-14">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-ember" aria-hidden />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-6">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl leading-tight md:text-4xl">
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
                className="inline-flex h-12 items-center rounded-md bg-ember px-6 text-sm font-semibold text-white hover:bg-ember-deep"
              >
                Book a stay
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-12 items-center rounded-md border border-white/30 bg-white/10 px-6 text-sm font-semibold text-white hover:bg-white/20"
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
