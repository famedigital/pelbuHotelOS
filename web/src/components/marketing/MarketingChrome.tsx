"use client";

import Link from "next/link";
import { InnoraLogo } from "@/components/marketing/InnoraLogo";
import { MarketingMegaNav } from "@/components/marketing/MarketingMegaNav";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { Lock } from "lucide-react";

export function MarketingHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md px-6 py-3.5 md:px-10">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="transition-opacity hover:opacity-90">
          <InnoraLogo size="sm" wordmarkClassName="text-foreground" />
        </Link>
        <div className="flex flex-1 items-center justify-end gap-2 lg:justify-between lg:gap-3 lg:pl-8">
          <Link
            href="/login"
            className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:opacity-90 lg:hidden"
          >
            Sign In
          </Link>
          <MarketingMegaNav />
          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/80 px-4 py-1.5 text-xs font-semibold text-secondary-foreground transition hover:bg-secondary hover:text-foreground active:scale-[0.98]"
            >
              <Lock className="size-3 text-amber-500" />
              <span>Sign In</span>
            </Link>
            <Link
              href="/demo"
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 shadow-sm active:scale-[0.98]"
            >
              Book a demo
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-secondary px-6 py-14 text-foreground md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:justify-between">
        <div>
          <InnoraLogo size="md" wordmarkClassName="text-foreground" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {SITE_DESCRIPTION}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-emerald-500" />
            <span>Certified for Bhutan DRC Invoicing (10% BST + 10% SC)</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-4">
          <div className="flex flex-col gap-2.5 text-muted-foreground">
            <p className="border-t-2 border-foreground pt-3 font-display text-lg text-foreground">Product</p>
            <Link href="/#stayview" className="transition hover:text-foreground">
              Front desk & rack
            </Link>
            <Link href="/#folio" className="transition hover:text-foreground">
              Folio & city ledger
            </Link>
            <Link href="/#pos" className="transition hover:text-foreground">
              Point of sale (POS)
            </Link>
            <Link href="/#dot" className="transition hover:text-foreground">
              DOT & BAFRA assessment
            </Link>
          </div>
          <div className="flex flex-col gap-2.5 text-muted-foreground">
            <p className="border-t-2 border-foreground pt-3 font-display text-lg text-foreground">Hotels</p>
            <Link href="/for/leased" className="transition hover:text-foreground">
              Leased properties
            </Link>
            <Link href="/for/independent" className="transition hover:text-foreground">
              Independent hotels
            </Link>
            <Link href="/for/chain" className="transition hover:text-foreground">
              Hotel chains
            </Link>
            <Link href="/pricing" className="transition hover:text-foreground">
              Pricing in BTN
            </Link>
          </div>
          <div className="flex flex-col gap-2.5 text-muted-foreground">
            <p className="border-t-2 border-foreground pt-3 font-display text-lg text-foreground">Company</p>
            <Link href="/demo" className="transition hover:text-foreground">
              Live Demo
            </Link>
            <Link href="/conditions" className="transition hover:text-foreground">
              Conditions
            </Link>
            <Link href="/status" className="transition hover:text-foreground">
              System status
            </Link>
            <Link href="/changelog" className="transition hover:text-foreground">
              Changelog
            </Link>
          </div>
          <div className="flex flex-col gap-2.5 text-muted-foreground">
            <p className="border-t-2 border-foreground pt-3 font-display text-lg text-foreground">Portals</p>
            <Link href="/login" className="transition hover:text-foreground font-medium text-foreground">
              All Portals Hub →
            </Link>
            <Link href="/erp/login" className="transition hover:text-foreground">
              Front desk login
            </Link>
            <Link href="/erp/pos/login" className="transition hover:text-foreground">
              Till POS login
            </Link>
            <Link href="/agents/login" className="transition hover:text-foreground">
              Travel partner portal
            </Link>
            <Link href="/staff/login" className="transition hover:text-foreground">
              Staff HR portal
            </Link>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
        <p>
          © {new Date().getFullYear()} Fame Digital · {SITE_NAME} · Kingdom of Bhutan
        </p>
        <p>Priced in BTN · Supported in Thimphu & Paro</p>
      </div>
    </footer>
  );
}
