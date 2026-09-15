"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { InnoraLogo } from "@/components/marketing/InnoraLogo";
import { MarketingMegaNav } from "@/components/marketing/MarketingMegaNav";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

export function MarketingHeader() {
  const pathname = usePathname();
  const onHome = pathname === "/";
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-30 px-6 py-3.5 backdrop-blur-md md:px-10",
        onHome
          ? "border-b border-white/15 bg-black/20"
          : "border-b border-border/60 bg-background/90",
      )}
    >
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="transition-opacity hover:opacity-90">
          <InnoraLogo
            variant={onHome ? "light" : "default"}
            size="sm"
            wordmarkClassName={onHome ? "text-white" : "text-foreground"}
          />
        </Link>
        <div className="flex flex-1 items-center justify-end gap-3 lg:justify-between lg:pl-8">
          <MarketingMegaNav onHome={onHome} />
          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/login"
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm transition",
                onHome
                  ? "bg-white/15 text-white hover:bg-white/25"
                  : "bg-secondary text-secondary-foreground hover:opacity-90",
              )}
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
        <div className="grid grid-cols-2 gap-10 text-sm">
          <div className="flex flex-col gap-2.5 text-muted-foreground">
            <Link href="/pricing" className="transition hover:text-foreground">
              Pricing
            </Link>
            <Link
              href="/conditions"
              className="transition hover:text-foreground"
            >
              Conditions
            </Link>
            <Link href="/demo" className="transition hover:text-foreground">
              Book a demo
            </Link>
          </div>
          <div className="flex flex-col gap-2.5 text-muted-foreground">
            <Link href="/status" className="transition hover:text-foreground">
              Status
            </Link>
            <Link
              href="/changelog"
              className="transition hover:text-foreground"
            >
              Changelog
            </Link>
            <Link href="/login" className="transition hover:text-foreground">
              Login
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
