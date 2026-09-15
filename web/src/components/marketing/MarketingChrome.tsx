"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { InnoraLogo } from "@/components/marketing/InnoraLogo";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/pricing", label: "Pricing" },
  { href: "/for/leased", label: "Leased" },
  { href: "/for/independent", label: "Independent" },
  { href: "/for/chain", label: "Chains" },
  { href: "/conditions", label: "Conditions" },
  { href: "/demo", label: "Demo" },
];

export function MarketingHeader() {
  const pathname = usePathname();
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-border/60 bg-background/80 px-6 py-3.5 backdrop-blur-md md:px-10">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <Link href="/" className="transition-opacity hover:opacity-90">
          <InnoraLogo size="sm" wordmarkClassName="text-foreground" />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative transition-colors hover:text-foreground",
                  active && "text-foreground",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "absolute -bottom-1 left-0 h-0.5 w-full origin-left rounded-full bg-primary transition-transform duration-300",
                    active ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </Link>
            );
          })}
          <Link
            href="/login"
            className="rounded-full bg-secondary px-3.5 py-1.5 text-secondary-foreground transition hover:opacity-90"
          >
            Login
          </Link>
        </nav>
        <Link
          href="/demo"
          className="rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 lg:hidden"
        >
          Demo
        </Link>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-secondary/40 px-6 py-14 text-foreground md:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 md:flex-row md:justify-between">
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
              Request demo
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
      <p className="mx-auto mt-12 max-w-5xl text-xs text-muted-foreground">
        © {new Date().getFullYear()} Fame Digital · {SITE_NAME}
      </p>
    </footer>
  );
}
