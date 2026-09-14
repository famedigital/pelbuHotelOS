import Link from "next/link";

type Item = { question: string; answer: string };

/** Two-column FAQ teaser — no cards. */
export function HomeFaqTeaser({ items }: { items: Item[] }) {
  const top = items.slice(0, 4);
  if (top.length === 0) return null;

  return (
    <section id="answers" className="bg-mist-0 py-16 md:py-24">
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-juniper">
              Practical answers
            </p>
            <h2 className="mt-3 font-display text-3xl leading-tight text-foreground md:text-4xl">
              Before you pack for Thimphu.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Straight answers for location, booking and stay. Full set on the
              FAQ — book when you are ready.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/book"
                className="inline-flex h-12 items-center rounded-md bg-ember px-6 text-sm font-semibold text-white hover:bg-ember-deep"
              >
                Book a stay
              </Link>
              <Link
                href="/faq"
                className="inline-flex h-12 items-center rounded-md border border-cedar-rule bg-white px-6 text-sm font-semibold text-foreground hover:bg-mist-1"
              >
                All answers
              </Link>
            </div>
          </div>

          <div className="divide-y divide-cedar-rule border-y border-cedar-rule">
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
        </div>
      </div>
    </section>
  );
}
