"use client";

import Link from "next/link";
import { InnoraLogo } from "@/components/marketing/InnoraLogo";
import { MarketingMegaNav } from "@/components/marketing/MarketingMegaNav";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export function MarketingHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-border/60 bg-background/90 px-6 py-3.5 backdrop-blur-md md:px-10">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="transition-opacity hover:opacity-90">
          <InnoraLogo size="sm" wordmarkClassName="text-foreground" />
        </Link>
        <div className="flex flex-1 items-center justify-end gap-2 lg:justify-between lg:gap-3 lg:pl-8">
          <Link
            href="/erp/login"
              className="rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:opacity-90 lg:hidden"
          >
            Login
          </Link>
          <MarketingMegaNav />
          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/erp/login"
              className="rounded-full bg-secondary px-3.5 py-1.5 text-sm text-secondary-foreground transition hover:opacity-90"
            >
              Login
            </Link>
            <Link
              href="/demo"
              className="rounded-full bg-cta px-3.5 py-1.5 text-sm font-semibold transition"
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
        </div>
        <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-4">
          <div className="flex flex-col gap-2.5 text-muted-foreground">
            <p className="border-t-2 border-foreground pt-3 font-display text-lg text-foreground">Product</p>
            <Link href="/#desk" className="transition hover:text-foreground">
              Front desk
            </Link>
            <Link href="/#folio" className="transition hover:text-foreground">
              Folio and night audit
            </Link>
            <Link href="/#pos" className="transition hover:text-foreground">
              POS
            </Link>
            <Link href="/#answers" className="transition hover:text-foreground">
              DOT assessment
            </Link>
          </div>
          <div className="flex flex-col gap-2.5 text-muted-foreground">
            <p className="border-t-2 border-foreground pt-3 font-display text-lg text-foreground">Hotels</p>
            <Link href="/for/leased" className="transition hover:text-foreground">
              Leased
            </Link>
            <Link href="/for/independent" className="transition hover:text-foreground">
              Independent
            </Link>
            <Link href="/for/chain" className="transition hover:text-foreground">
              Chain
            </Link>
            <Link href="/pricing" className="transition hover:text-foreground">
              Pricing
            </Link>
          </div>
          <div className="flex flex-col gap-2.5 text-muted-foreground">
            <p className="border-t-2 border-foreground pt-3 font-display text-lg text-foreground">Company</p>
            <Link href="/demo" className="transition hover:text-foreground">
              Demo
            </Link>
            <Link href="/conditions" className="transition hover:text-foreground">
              Conditions
            </Link>
            <Link href="/status" className="transition hover:text-foreground">
              Status
            </Link>
            <Link href="/changelog" className="transition hover:text-foreground">
              Changelog
            </Link>
          </div>
          <div className="flex flex-col gap-2.5 text-muted-foreground">
            <p className="border-t-2 border-foreground pt-3 font-display text-lg text-foreground">Desk</p>
            <Link href="/erp/login" className="transition hover:text-foreground">
              Login
            </Link>
            <Link href="/demo" className="transition hover:text-foreground">
              Book a demo
            </Link>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-12 max-w-6xl text-xs text-muted-foreground">
        © {new Date().getFullYear()} Fame Digital · {SITE_NAME}
      </p>
    </footer>
  );
}
