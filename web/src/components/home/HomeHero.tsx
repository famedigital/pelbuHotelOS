import Link from "next/link";

const LOGO =
  "https://res.cloudinary.com/hkkchsfy/image/upload/f_auto,q_auto,w_160/pelbu/brand/logo-primary.png";

export function HomeHero() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[#1c1612]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 70% 20%, rgba(184,137,44,0.22), transparent 55%), linear-gradient(165deg, #2a211c 0%, #1c1612 48%, #120e0c 100%)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-[100svh] max-w-[1200px] flex-col justify-end px-6 pb-20 pt-28 md:px-8 md:pb-24">
        <img
          src={LOGO}
          alt="Pelbu Suites"
          className="mb-8 h-16 w-16 object-contain md:h-20 md:w-20"
          width={80}
          height={80}
        />
        <p className="mb-3 text-xs tracking-[0.35em] text-gold uppercase">
          Olakha · Thimphu
        </p>
        <h1 className="max-w-2xl text-4xl leading-tight text-white md:text-6xl">
          Stay. Dine. Gather.
        </h1>
        <p className="mt-4 max-w-md text-base text-white/80 md:text-lg">
          A modern Bhutanese boutique hotel — rooms, cafe, restaurant, spa, and
          meeting under one roof.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/book"
            className="inline-flex min-h-11 items-center rounded-sm bg-gold px-6 text-sm font-medium text-espresso"
          >
            Book stay
          </Link>
          <Link
            href="/order"
            className="inline-flex min-h-11 items-center rounded-sm border border-white/40 px-6 text-sm font-medium text-white"
          >
            Order food
          </Link>
          <Link
            href="/spa"
            className="inline-flex min-h-11 items-center rounded-sm border border-white/40 px-6 text-sm font-medium text-white"
          >
            Book spa
          </Link>
        </div>
      </div>
    </section>
  );
}
