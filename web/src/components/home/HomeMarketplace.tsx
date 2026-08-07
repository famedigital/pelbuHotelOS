import { MousePointerClickIcon, ShoppingBagIcon, TruckIcon } from "lucide-react";
import Link from "next/link";

const STEPS = [
  {
    icon: MousePointerClickIcon,
    title: "Browse every outlet",
    body: "Cafe, pastry, restaurant and bar in one searchable list with live photos and prices.",
  },
  {
    icon: ShoppingBagIcon,
    title: "Add without leaving",
    body: "Tap add and the cart builds beside you — quantities, GST and total update instantly.",
  },
  {
    icon: TruckIcon,
    title: "Pickup, room, or taxi",
    body: "In-house? Charge your room after verifying room number + booking mobile (names never shown). Or collect or taxi across Thimphu.",
  },
];

export function HomeMarketplace({ dishCount }: { dishCount: number }) {
  return (
    <section id="marketplace" className="px-5 py-16 md:px-8 md:py-24">
      <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky-700 via-sky-600 to-mint-600 px-6 py-14 shadow-[0_40px_100px_-50px_rgba(2,132,199,0.9)] md:px-14">
        <div
          className="absolute -right-16 -top-16 size-[22rem] rounded-full bg-citrus/30 blur-[110px]"
          aria-hidden
        />
        <div
          className="absolute -bottom-24 -left-10 size-[20rem] rounded-full bg-mint-500/40 blur-[110px]"
          aria-hidden
        />

        <div className="relative max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-citrus-soft">
            Online marketplace
          </p>
          <h2 className="mt-3 font-display text-3xl leading-tight text-white md:text-4xl">
            Order the whole kitchen from one page.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/80">
            {dishCount > 0
              ? `${dishCount} dishes are live right now. `
              : ""}
            Guests in-house charge the room after a private room + phone check.
            Walk-ins pick up or take taxi delivery.
          </p>
        </div>

        <ul className="relative mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-citrus-soft to-citrus text-sky-ink">
                  <Icon className="size-5" />
                </span>
                <p className="mt-4 font-semibold text-white">{step.title}</p>
                <p className="mt-2 text-sm leading-6 text-white/75">
                  {step.body}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="relative mt-10 flex flex-wrap gap-3">
          <Link
            href="/menu"
            className="inline-flex h-12 items-center rounded-xl bg-gradient-to-r from-citrus-soft to-citrus px-6 text-sm font-semibold text-sky-ink shadow-[0_16px_40px_-16px_rgba(245,158,11,0.9)] transition-transform motion-safe:hover:-translate-y-0.5"
          >
            Open the menu
          </Link>
          <Link
            href="/menu?deliver=room"
            className="inline-flex h-12 items-center rounded-xl border border-white/30 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
          >
            Order to my room
          </Link>
        </div>
      </div>
    </section>
  );
}
