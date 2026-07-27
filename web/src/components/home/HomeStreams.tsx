import Link from "next/link";

const streams = [
  {
    href: "/rooms",
    title: "Rooms",
    blurb: "Rest well in Olakha — book direct for the best rate.",
  },
  {
    href: "/cafe",
    title: "Cafe & Pastry",
    blurb: "Opens 6:30 summer / 7:30 winter. Order for taxi delivery.",
  },
  {
    href: "/restaurant",
    title: "Restaurant",
    blurb: "Indian, Bhutanese, and multicuisine — breakfast to dinner.",
  },
  {
    href: "/bar",
    title: "Bar",
    blurb: "Weekend menu and a calm evening pour.",
  },
  {
    href: "/spa",
    title: "Spa & Steam",
    blurb: "Book treatments and steam — restore after the road.",
  },
  {
    href: "/meeting",
    title: "Meeting",
    blurb: "Premium hall for up to 25 — chairs, table, focus.",
  },
] as const;

export function HomeStreams() {
  return (
    <section className="bg-ivory px-6 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-[1200px]">
        <p className="text-sm tracking-[0.2em] text-maroon uppercase">
          Six ways to Pelbu
        </p>
        <h2 className="mt-3 max-w-xl text-3xl text-espresso md:text-4xl">
          Everything your stay — or your day in Thimphu — needs.
        </h2>
        <div className="mt-12 grid gap-px bg-espresso/10 sm:grid-cols-2 lg:grid-cols-3">
          {streams.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex min-h-[180px] flex-col justify-between bg-ivory p-8 transition hover:bg-white"
            >
              <div>
                <p className="text-xl text-espresso">{s.title}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {s.blurb}
                </p>
              </div>
              <span className="mt-8 text-sm text-maroon group-hover:underline">
                Explore →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
