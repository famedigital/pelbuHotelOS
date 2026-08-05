import Link from "next/link";

const PROOFS = [
  {
    title: "Direct rack rates",
    body: "Public BAR on this site — no OTA markup. Package totals live on the rate card.",
    href: "/rates",
    linkLabel: "Rate card",
  },
  {
    title: "Live availability",
    body: "Dates hit the same inventory the desk uses. Confirm a hold and pay as instructed.",
    href: "/book",
    linkLabel: "Check dates",
  },
  {
    title: "One roof in Olakha",
    body: "Rooms, cafe, restaurant, spa and meeting share a desk — one bill when it should be.",
    href: "/services",
    linkLabel: "Services",
  },
  {
    title: "Agent-ready ops",
    body: "Guide and driver beds on qualifying groups; partners book through their portal.",
    href: "/agents",
    linkLabel: "Agents",
  },
] as const;

/**
 * Verifiable proof — not invented star ratings. Each line maps to a real product path.
 */
export function HomeProof() {
  return (
    <section
      id="proof"
      aria-label="Why book direct"
      className="border-b border-border/70 bg-background"
    >
      <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4 md:px-8 md:py-14">
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
