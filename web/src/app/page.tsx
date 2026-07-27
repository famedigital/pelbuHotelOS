import { HomeHero } from "@/components/home/HomeHero";
import { HomeStreams } from "@/components/home/HomeStreams";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <HomeHero />
        <HomeStreams />
        <section className="bg-white px-6 py-16 md:px-8 md:py-20">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <p className="text-sm tracking-[0.2em] text-maroon uppercase">
                Location
              </p>
              <h2 className="mt-3 text-3xl text-espresso md:text-4xl">
                Olakha, Thimphu — easy for guests and agents alike.
              </h2>
              <p className="mt-4 text-muted">
                Built for Bhutan travel reality: fast bookings, guide and driver
                care, and dining that earns a second visit.
              </p>
            </div>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center text-sm text-maroon hover:underline"
            >
              Get directions →
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
