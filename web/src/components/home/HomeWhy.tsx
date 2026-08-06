import { HomeSectionHead } from "@/components/home/HomeSectionHead";
import {
  BadgeCheckIcon,
  ClockIcon,
  MapPinIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";

const REASONS = [
  {
    icon: BadgeCheckIcon,
    title: "Direct rates, no middle layer",
    body: "Book on this site and you get the desk rate with instant confirmation — no channel markup.",
    tone: "from-sky-600 to-sky-500",
  },
  {
    icon: MapPinIcon,
    title: "Olakha, close to everything",
    body: "Minutes from the expressway, offices and the city core, with parking and calm evenings.",
    tone: "from-mint-500 to-mint-600",
  },
  {
    icon: SparklesIcon,
    title: "One roof, five services",
    body: "Rooms, cafe, restaurant, bar and spa share a desk — one bill, one team, one place.",
    tone: "from-citrus-soft to-citrus",
  },
  {
    icon: ClockIcon,
    title: "Live availability",
    body: "What you see is what the desk sees — rooms, kitchen tickets and housekeeping in real time.",
    tone: "from-sky-500 to-mint-500",
  },
];

export function HomeWhy() {
  return (
    <section
      id="why"
      className="bg-gradient-to-b from-background to-frost-2/70 py-10 md:py-24"
    >
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <HomeSectionHead
          eyebrow="Why Pelbu Suites"
          title="A hotel that behaves like a good host."
          description="Straight pricing, real people at the desk, and every service you need for a Thimphu trip in the same building."
          accent="citrus"
        />

        <ul className="mt-6 grid gap-5 sm:grid-cols-2 md:mt-10 md:gap-8 lg:grid-cols-4">
          {REASONS.map((reason) => {
            const Icon = reason.icon;
            return (
              <li key={reason.title} className="min-w-0">
                <span
                  className={`inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${reason.tone} text-white md:size-11`}
                >
                  <Icon className="size-5" />
                </span>
                <p className="mt-3 font-semibold text-foreground md:mt-4">
                  {reason.title}
                </p>
                <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-muted-foreground md:mt-2 md:line-clamp-none">
                  {reason.body}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="relative mt-10 overflow-hidden rounded-2xl bg-sky-ink px-5 py-9 md:mt-14 md:rounded-[2rem] md:px-12 md:py-12">
          <div
            className="absolute -left-10 top-0 size-72 rounded-full bg-sky-500/30 blur-[100px]"
            aria-hidden
          />
          <div
            className="absolute -right-10 bottom-0 size-72 rounded-full bg-citrus/20 blur-[100px]"
            aria-hidden
          />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-6">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl leading-tight text-white md:text-4xl">
                Ready when you are.
              </h2>
              <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-white/75 md:mt-3 md:line-clamp-none">
                Check live rooms and confirm direct — or message the desk if you
                need a group or meal plan sorted first.
              </p>
            </div>
            <div className="relative flex flex-wrap gap-3">
              <Link
                href="/book"
                className="inline-flex h-11 items-center rounded-xl bg-gradient-to-r from-citrus-soft to-citrus px-5 text-sm font-semibold text-sky-ink shadow-[0_16px_40px_-16px_rgba(245,158,11,0.9)] transition-transform motion-safe:hover:-translate-y-0.5 md:h-12 md:px-6"
              >
                Book a stay
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-11 items-center rounded-xl border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20 md:h-12 md:px-6"
              >
                Talk to the desk
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
