import Link from "next/link";

const PROOFS = [
  {
    title: "Direct rack rates",
    body: "Public BAR on this site — no OTA markup. Package totals live on the rate card.",
    shortBody: "Public BAR — no OTA markup.",
    href: "/rates",
    linkLabel: "Rate card",
  },
  {
    title: "Live availability",
    body: "Dates hit the same inventory the desk uses. Confirm a hold and pay as instructed.",
    shortBody: "Same inventory the desk uses.",
    href: "/book",
    linkLabel: "Check dates",
  },
  {
    title: "One roof in Olakha",
    body: "Rooms, cafe, restaurant, spa and meeting share a desk — one bill when it should be.",
    shortBody: "Rooms, cafe, spa — one desk.",
    href: "/services",
    linkLabel: "Services",
  },
  {
    title: "Agent-ready ops",
    body: "Guide and driver beds on qualifying groups; partners book through their portal.",
    shortBody: "Partners & groups via portal.",
    href: "/agents",
    linkLabel: "Agents",
  },
] as const;

/**
 * Verifiable proof — not invented star ratings. Each line maps to a real product path.
 * Mobile: compact 2×2 cards. Desktop: fuller four-column copy.
 */
export function HomeProof() {
  return (
    <section
      id="proof"
      aria-label="Why book direct"
      className="border-b border-border/70 bg-background"
    >
      {/* Mobile 2×2 cards */}
      <div className="grid grid-cols-2 gap-2.5 px-4 py-6 md:hidden">
        {PROOFS.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="flex min-h-[7.5rem] flex-col rounded-xl border border-border/80 bg-card px-3 py-3 transition-colors hover:border-sky-200 hover:bg-sky-50/40"
          >
            <p className="text-[13px] font-semibold leading-snug text-foreground">
              {item.title}
            </p>
            <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-5 text-muted-foreground">
              {item.shortBody}
            </p>
            <span className="mt-2 text-xs font-semibold text-sky-700">
              {item.linkLabel} →
            </span>
          </Link>
        ))}
      </div>

      {/* Desktop grid */}
      <div className="mx-auto hidden max-w-[1200px] gap-8 px-5 py-12 sm:grid-cols-2 md:grid md:grid-cols-2 md:px-8 md:py-14 lg:grid-cols-4">
        {PROOFS.map((item) => (
          <div key={item.title} className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {item.body}
            </p>
            <Link
              href={item.href}
              className="mt-3 inline-flex text-sm font-semibold text-sky-700 hover:text-sky-900"
            >
              {item.linkLabel} →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
