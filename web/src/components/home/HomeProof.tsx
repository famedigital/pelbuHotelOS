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

/** Quiet proof strip — demoted after story/outlets in the new spine. */
export function HomeProof() {
  return (
    <section
      id="proof"
      aria-label="Why book direct"
      className="border-y border-cedar-rule bg-white"
    >
      <ul className="mx-auto grid max-w-[1200px] divide-y divide-cedar-rule md:grid-cols-4 md:divide-x md:divide-y-0">
        {PROOFS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.title}>
              <Link
                href={item.href}
                className="flex min-h-14 flex-col gap-2 px-5 py-5 transition-colors hover:bg-mist-1 md:min-h-[9.5rem] md:px-6"
              >
                <span className="inline-flex size-8 items-center justify-center text-juniper">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="text-[15px] font-semibold text-foreground">
                  {item.title}
                </span>
                <span className="hidden text-sm leading-6 text-muted-foreground md:block">
                  {item.body}
                </span>
                <span className="text-sm text-muted-foreground md:hidden">
                  {item.shortBody}
                </span>
                <span className="mt-auto text-xs font-semibold text-ember">
                  {item.linkLabel} →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
