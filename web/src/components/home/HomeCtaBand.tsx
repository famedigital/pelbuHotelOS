import Link from "next/link";

/** One calm CTA band — no quote theatre, no numbered props. */
export function HomeCtaBand() {
  return (
    <section className="border-t border-border px-5 py-16 md:px-8 md:py-20">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-md">
          <h2 className="font-display text-2xl text-ink md:text-3xl">
            Ready to book?
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            Live rates, pick a room, hold instantly. Pay link lands in your
            inbox.
          </p>
        </div>
        <Link
          href="/book"
          className="inline-flex h-11 shrink-0 items-center rounded-md bg-ink px-5 text-sm font-medium text-ivory hover:bg-ink-soft"
        >
          Book a stay
        </Link>
      </div>
    </section>
  );
}
