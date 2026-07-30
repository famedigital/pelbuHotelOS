import { BedDoubleIcon, FileTextIcon, WalletIcon } from "lucide-react";
import Link from "next/link";

const PERKS = [
  {
    icon: BedDoubleIcon,
    title: "Guide & driver beds",
    body: "Complimentary crew beds on qualifying group bookings.",
  },
  {
    icon: WalletIcon,
    title: "Credit & statements",
    body: "Approved agents book on credit and settle against a live statement.",
  },
  {
    icon: FileTextIcon,
    title: "Vouchers in minutes",
    body: "Confirmations, vouchers and invoices issue straight from the portal.",
  },
];

export function HomeAgents() {
  return (
    <section
      id="agents"
      className="bg-gradient-to-br from-mint-100/80 via-background to-sky-100/70 py-16 md:py-24"
    >
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
          <div>
            <p className="bg-gradient-to-r from-mint-600 to-mint-500 bg-clip-text text-xs font-semibold uppercase tracking-[0.24em] text-transparent">
              Travel agents
            </p>
            <h2 className="mt-3 font-display text-3xl leading-tight text-foreground md:text-4xl">
              Your own portal for Thimphu inventory.
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Apply once and get contracted rates, allotments and a booking desk
              your team can use directly — no email chains, no rate guesswork.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/agents"
                className="inline-flex h-12 items-center rounded-xl bg-gradient-to-r from-mint-500 to-mint-600 px-6 text-sm font-semibold text-white shadow-[0_16px_40px_-18px_rgba(16,185,129,0.9)] transition-transform motion-safe:hover:-translate-y-0.5"
              >
                Apply for agent access
              </Link>
              <Link
                href="/agents/login"
                className="inline-flex h-12 items-center rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                Agent login
              </Link>
            </div>
          </div>

          <ul className="grid gap-3">
            {PERKS.map((perk) => {
              const Icon = perk.icon;
              return (
                <li
                  key={perk.title}
                  className="flex gap-4 rounded-2xl border border-white/70 bg-white/70 p-5 backdrop-blur"
                >
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-mint-500 text-white">
                    <Icon className="size-5" />
                  </span>
                  <span>
                    <span className="block font-semibold text-foreground">
                      {perk.title}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      {perk.body}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
