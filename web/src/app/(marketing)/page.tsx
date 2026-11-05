import Link from "next/link";
import type { Metadata } from "next";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { BhutanEcosystemInteractive } from "@/components/marketing/BhutanEcosystemInteractive";
import { MarketingProductStudio } from "@/components/marketing/MarketingProductStudio";
import { BhutanRoiCalculator } from "@/components/marketing/BhutanRoiCalculator";
import { BhutanTestimonials } from "@/components/marketing/BhutanTestimonials";
import { DeviceMockup } from "@/components/marketing/SamsungDevices";
import { CATALOG_PACKAGES } from "@/lib/pricing-catalog";
import { SITE_NAME } from "@/lib/site";
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Zap,
  Lock,
  Layers,
  Laptop,
} from "lucide-react";

export const metadata: Metadata = {
  title: `${SITE_NAME} — The Operating System for Bhutan Hotels`,
  description:
    "White-label hotel ERP built for Bhutan. Front desk stayview, dynamic folio, POS, travel agent city ledger, and DOT star classification compliance. Priced in BTN.",
  robots: { index: true, follow: true },
};

const classic = CATALOG_PACKAGES.find((pkg) => pkg.code === "classic");
const plus = CATALOG_PACKAGES.find((pkg) => pkg.code === "plus");
const portfolio = CATALOG_PACKAGES.find((pkg) => pkg.code === "portfolio");
const chain = CATALOG_PACKAGES.find((pkg) => pkg.code === "chain");

function btn(amount: number | undefined) {
  return amount ? `BTN ${amount.toLocaleString("en-BT")}` : "";
}

export default function MarketingHomePage() {
  const buyers = [
    {
      href: "/for/leased",
      title: "Leased Hotels",
      subtitle: "Multi-property leaseholds",
      price: portfolio ? `${btn(portfolio.msrpBtnMo)} a month per property` : "",
      desc: "Centralized owner dashboard across all leased properties with separate staff logins.",
    },
    {
      href: "/for/independent",
      title: "Independent Boutique",
      subtitle: "Up to 15 or 30 rooms",
      price: classic
        ? `Classic ${btn(classic.msrpBtnMo)} a month${plus ? `. POS from Plus, ${btn(plus.msrpBtnMo)}` : ""}`
        : "",
      desc: "Everything a boutique hotel needs: room rack, B2B agent vouchers, and DRC tax invoices.",
    },
    {
      href: "/for/chain",
      title: "Resort & Chain",
      subtitle: "Multi-wing enterprise",
      price: chain ? `From ${btn(chain.msrpBtnMo)} a month` : "",
      desc: "Custom multi-restaurant POS, kitchen KDS, central reservations, and fleet accounting.",
    },
  ];

  return (
    <div className="bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* 1. Grand Sovereign Hero */}
      <MarketingHero />

      {/* 2. The 7 Rings of Bhutan Hospitality */}
      <section id="ecosystem" className="scroll-mt-24 border-b border-border/80 bg-secondary/50 py-20 px-6 md:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
              <Layers className="size-3.5" />
              <span>The Bhutanese Reality</span>
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              The hotel sits in the middle of 7 stakeholders
            </h2>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Foreign PMS platforms assume a solo guest paying with an international credit card.
              Bhutan hospitality works completely differently: 80% of bookings arrive through
              travel agents on credit, with guides, drivers, local grocery suppliers, and DOT
              classification inspectors.
            </p>
          </div>

          <div className="mt-12">
            <BhutanEcosystemInteractive />
          </div>
        </div>
      </section>

      {/* 3. The 0-Latency Product Cockpit */}
      <section id="cockpit" className="scroll-mt-24 py-20 px-6 md:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between border-b border-border/80 pb-6">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-primary uppercase">
                <Zap className="size-3.5" />
                <span>Engineered for 0 Latency</span>
              </span>
              <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                The Product Experience Studio
              </h2>
            </div>
            <p className="max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Front desk stayview, dynamic split folios, restaurant till POS, and official DOT assessment — built with RAM-first execution for instant 0ms response.
            </p>
          </div>

          <div className="mt-10">
            <MarketingProductStudio />
          </div>
        </div>
      </section>

      {/* 4. Omnichannel Device Hardware Showcase */}
      <section id="hardware" className="border-y border-border/80 bg-secondary/30 py-20 px-6 md:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Laptop className="size-3.5 text-primary" />
              <span>Multi-Screen Ergonomics</span>
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              One desk, scaled across every device
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Receptionists work on laptops. Restaurant servers tap orders on tablets.
              Housekeepers and general managers update room turnover on phones.
              Everything synchronizes with 0 delay.
            </p>
          </div>

          <DeviceMockup />
        </div>
      </section>

      {/* 5. Bhutan Hotel Economics & OTA Calculator */}
      <section id="calculator" className="scroll-mt-24 py-20 px-6 md:px-10">
        <div className="mx-auto max-w-6xl">
          <BhutanRoiCalculator />
        </div>
      </section>

      {/* 6. Authentic Bhutan Case Studies & Testimonials */}
      <section id="testimonials" className="border-t border-border/80 bg-secondary/40 py-20 px-6 md:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold tracking-wider text-primary uppercase">
              Verified Operational Trust
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Proven in Thimphu, Paro & Punakha
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Hoteliers across the Kingdom share how switching to Hotel OS transformed their front desk and passed DOT audits.
            </p>
          </div>

          <BhutanTestimonials />
        </div>
      </section>

      {/* 7. Transparent BTN Pricing */}
      <section id="pricing" className="scroll-mt-24 py-20 px-6 md:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between border-b border-border/80 pb-6">
            <div>
              <span className="text-xs font-bold tracking-wider text-primary uppercase">
                Zero Hidden Surprises
              </span>
              <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Transparent pricing in Bhutanese Ngultrum
              </h2>
            </div>
            <p className="max-w-sm text-xs sm:text-sm text-muted-foreground">
              No foreign currency conversion fees. Pay in BTN via local bank transfer.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {buyers.map((row) => (
              <div
                key={row.href}
                className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card/70 p-6 shadow-xl backdrop-blur-xl transition hover:border-primary/40"
              >
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {row.subtitle}
                  </span>
                  <h3 className="mt-1 font-display text-2xl font-bold text-foreground">
                    {row.title}
                  </h3>
                  <p className="mt-3 font-mono text-xl font-bold text-primary">
                    {row.price}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                    {row.desc}
                  </p>
                </div>

                <div className="mt-6 border-t border-border/60 pt-4">
                  <Link
                    href={row.href}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline underline-offset-4"
                  >
                    <span>Read full specifications</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/80 bg-secondary/60 p-6">
            <div>
              <p className="font-semibold text-sm text-foreground">
                Need more than 30 rooms or on-site staff training in your Dzongkhag?
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                We provide hands-on setup, staff training, and data import from your old system.
              </p>
            </div>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition hover:bg-primary/90"
            >
              <span>Talk to our Bhutan Team</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 8. Grand Sovereign Glass CTA Banner */}
      <section className="relative overflow-hidden border-t border-border/80 bg-[#060A12] py-24 px-6 text-white md:px-10">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full blur-[160px] opacity-25"
          style={{
            background: "radial-gradient(circle, #059669 0%, #d97706 100%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-3.5 py-1 text-xs font-semibold text-amber-300">
            <Sparkles className="size-3.5" />
            <span>Ready for Immediate Deployment</span>
          </div>

          <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            Upgrade your hotel operations today
          </h2>

          <p className="mt-4 max-w-xl mx-auto text-sm sm:text-base text-slate-300 leading-relaxed">
            Stop losing 18% to foreign OTAs and hours to manual night audits.
            Experience the system built for how Bhutan sells rooms.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/demo"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground shadow-2xl transition hover:bg-primary/90 active:scale-[0.98]"
            >
              <span>Book a 20-Minute Live Demo</span>
              <ArrowRight className="size-4" />
            </Link>

            <Link
              href="/login"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-8 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20 active:scale-[0.98]"
            >
              <Lock className="size-4 text-amber-300" />
              <span>Sign In to Unified Portals</span>
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-emerald-400" />
              DRC Tax & Gapless Invoicing
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-amber-400" />
              Bhutan RMA QR Gateway
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-sky-400" />
              Offline RAM-First Resilient
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
