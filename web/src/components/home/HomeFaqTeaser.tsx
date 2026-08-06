import Link from "next/link";

type Item = { question: string; answer: string };

/** Homepage AEO teaser — top facts + path to full FAQ and book. */
export function HomeFaqTeaser({ items }: { items: Item[] }) {
  const top = items.slice(0, 4);
  if (top.length === 0) return null;

  return (
    <section
      id="answers"
      className="bg-gradient-to-b from-sky-50/50 to-background py-12 md:py-20"
    >
      <div className="mx-auto max-w-[800px] px-5 md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
          Practical answers
        </p>
        <h2 className="mt-2 font-display text-3xl leading-tight text-foreground md:text-4xl">
          Before you pack for Thimphu.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Straight answers for location, booking and stay. Full set on the FAQ —
          book when you are ready.
        </p>

        <div className="mt-8 divide-y divide-border border-y border-border">
          {top.map((item) => (
            <details key={item.question} className="group py-1">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] font-medium text-foreground">
                {item.question}
                <span
                  aria-hidden
                  className="text-lg text-muted-foreground transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-2xl pb-4 text-sm leading-7 text-muted-foreground">
                {item.answer}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/book"
            className="inline-flex h-12 items-center rounded-xl bg-gradient-to-r from-citrus-soft to-citrus px-6 text-sm font-semibold text-sky-ink"
          >
            Book a stay
          </Link>
          <Link
            href="/faq"
            className="inline-flex h-12 items-center rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            All answers
          </Link>
        </div>
      </div>
    </section>
  );
}
