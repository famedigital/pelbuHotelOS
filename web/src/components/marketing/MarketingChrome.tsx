"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BhoLogo } from "@/components/marketing/BhoLogo";
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
    <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[var(--sky-ink)]/95 px-6 py-3.5 backdrop-blur md:px-10">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <Link href="/" className="transition-opacity hover:opacity-90">
          <BhoLogo variant="light" size="sm" wordmarkClassName="text-white" />
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-white/85 lg:flex">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative transition-colors hover:text-white",
                  active && "text-white",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "absolute -bottom-1 left-0 h-px w-full origin-left bg-[var(--citrus-500)] transition-transform duration-300",
                    active ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </Link>
            );
          })}
          <Link
            href="/login"
            className="rounded-md bg-white/15 px-3 py-1.5 text-white transition hover:bg-white/25"
          >
            Login
          </Link>
        </nav>
        <Link
          href="/demo"
          className="rounded-md bg-[var(--citrus-500)] px-3 py-1.5 text-sm font-medium text-[var(--sky-ink)] transition hover:bg-[var(--citrus-soft)] lg:hidden"
        >
          Demo
        </Link>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--ink-rule)] bg-[var(--sky-ink)] px-6 py-12 text-[var(--frost-2)] md:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 md:flex-row md:justify-between">
        <div>
          <BhoLogo variant="light" size="md" wordmarkClassName="text-white" />
          <p className="mt-3 max-w-sm text-sm text-white/70">{SITE_DESCRIPTION}</p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm">
          <div className="flex flex-col gap-2">
            <Link href="/pricing" className="transition hover:text-white">
              Pricing
            </Link>
            <Link href="/conditions" className="transition hover:text-white">
              Conditions
            </Link>
            <Link href="/demo" className="transition hover:text-white">
              Request demo
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/status" className="transition hover:text-white">
              Status
            </Link>
            <Link href="/changelog" className="transition hover:text-white">
              Changelog
            </Link>
            <Link href="/login" className="transition hover:text-white">
              Login
            </Link>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-5xl text-xs text-white/45">
        © {new Date().getFullYear()} Fame Digital · {SITE_NAME}
      </p>
    </footer>
  );
}
