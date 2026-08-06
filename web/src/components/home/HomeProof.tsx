import Link from "next/link";
import {
  BadgeCheckIcon,
  Building2Icon,
  CalendarDaysIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

const PROOFS: {
  title: string;
  body: string;
  shortBody: string;
  href: string;
  linkLabel: string;
  icon: LucideIcon;
}[] = [
  {
    title: "Direct rack rates",
    body: "Public BAR on this site — no OTA markup. Package totals live on the rate card.",
    shortBody: "Public BAR — no OTA markup.",
    href: "/rates",
    linkLabel: "Rate card",
    icon: BadgeCheckIcon,
  },
  {
    title: "Live availability",
    body: "Dates hit the same inventory the desk uses. Confirm a hold and pay as instructed.",
    shortBody: "Same inventory the desk uses.",
    href: "/book",
    linkLabel: "Check dates",
    icon: CalendarDaysIcon,
  },
  {
    title: "One roof in Olakha",
    body: "Rooms, cafe, restaurant, spa and meeting share a desk — one bill when it should be.",
    shortBody: "Rooms, cafe, spa — one desk.",
    href: "/services",
    linkLabel: "Services",
    icon: Building2Icon,
  },
  {
    title: "Agent-ready ops",
    body: "Guide and driver beds on qualifying groups; partners book through their portal.",
    shortBody: "Partners & groups via portal.",
    href: "/agents",
    linkLabel: "Agents",
    icon: UsersIcon,
  },
];

/**
 * Verifiable proof — not invented star ratings. Each line maps to a real product path.
 * Mobile: stacked rows (mature list, not card soup). Desktop: four-column copy.
 */
export function HomeProof() {
  return (
    <section
      id="proof"
      aria-label="Why book direct"
      className="border-b border-border/70 bg-background"
    >
      {/* Mobile — calm list rows */}
      <ul className="divide-y divide-border/70 md:hidden">
        {PROOFS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.title}>
              <Link
                href={item.href}
                className="flex min-h-14 items-start gap-3 px-5 py-4 transition-colors active:bg-sky-50/50"
              >
                <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold text-foreground">
                      {item.title}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-sky-700">
                      {item.linkLabel} →
                    </span>
                  </span>
                  <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                    {item.shortBody}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

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
              className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-sky-700 hover:text-sky-900"
            >
              {item.linkLabel} →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
