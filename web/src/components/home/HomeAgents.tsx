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
] as const;

/** Full-bleed forest agents CTA band. */
export function HomeAgents() {
  return (
    <section id="agents" className="relative bg-forest py-16 text-[#f2f4f3] md:py-20">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-ember" aria-hidden />
      <div className="relative mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-celadon">
              Travel agents
            </p>
            <h2 className="mt-3 font-display text-3xl leading-snug md:text-4xl">
              Contracted rates and a portal for your ops team.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Already working Bhutan? Apply once for agent rates, allotments and
              vouchers — guests book free on this site.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/agents"
                className="inline-flex h-12 items-center rounded-md bg-ember px-6 text-sm font-semibold text-white hover:bg-ember-deep"
              >
                Apply for agent access
              </Link>
              <Link
                href="/agents/login"
                className="inline-flex h-12 items-center rounded-md border border-white/25 bg-white/5 px-6 text-sm font-semibold text-white hover:bg-white/10"
              >
                Agent login
              </Link>
            </div>
          </div>

          <ul className="grid flex-1 gap-6 sm:grid-cols-3 lg:max-w-xl lg:grid-cols-1 xl:grid-cols-3">
            {PERKS.map((perk) => {
              const Icon = perk.icon;
              return (
                <li key={perk.title} className="flex gap-3 text-sm">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center border border-white/15 text-celadon">
                    <Icon className="size-4" />
                  </span>
                  <span>
                    <span className="font-semibold text-white">{perk.title}</span>
                    <span className="mt-0.5 block text-white/65">{perk.body}</span>
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
