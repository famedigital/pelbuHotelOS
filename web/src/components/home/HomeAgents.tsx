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

/** Compact B2B strip — demoted so guest conversion owns the homepage. */
export function HomeAgents() {
  return (
    <section
      id="agents"
      className="border-y border-border/60 bg-mint-50/40 py-12 md:py-14"
    >
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mint-700">
              Travel agents
            </p>
            <h2 className="mt-2 font-display text-2xl leading-snug text-foreground md:text-3xl">
              Contracted rates and a portal for your ops team.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Already working Bhutan? Apply once for agent rates, allotments and
              vouchers — guests book free on this site.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/agents"
                className="inline-flex h-11 items-center rounded-xl bg-mint-600 px-5 text-sm font-semibold text-white hover:bg-mint-700"
              >
                Apply for agent access
              </Link>
              <Link
                href="/agents/login"
                className="inline-flex h-11 items-center rounded-xl border border-border bg-card px-5 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                Agent login
              </Link>
            </div>
          </div>

          <ul className="grid flex-1 gap-3 sm:grid-cols-3 lg:max-w-xl lg:grid-cols-1 xl:grid-cols-3">
            {PERKS.map((perk) => {
              const Icon = perk.icon;
              return (
                <li key={perk.title} className="flex gap-3 text-sm">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-mint-100 text-mint-700">
                    <Icon className="size-4" />
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">
                      {perk.title}
                    </span>
                    <span className="mt-0.5 block text-muted-foreground">
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
