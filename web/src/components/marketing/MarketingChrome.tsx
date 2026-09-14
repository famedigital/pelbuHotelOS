import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

const NAV = [
  { href: "/pricing", label: "Pricing" },
  { href: "/for/leased", label: "Leased" },
  { href: "/for/independent", label: "Independent" },
  { href: "/for/chain", label: "Chains" },
  { href: "/conditions", label: "Conditions" },
  { href: "/demo", label: "Demo" },
];

export function MarketingHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[var(--sky-ink)]/95 px-6 py-4 backdrop-blur md:px-10">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <Link
          href="/"
          className="font-display text-xl tracking-tight text-white md:text-2xl"
        >
          {SITE_NAME}
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-white/85 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="rounded-md bg-white/15 px-3 py-1.5 text-white hover:bg-white/25"
          >
            Login
          </Link>
        </nav>
        <Link
          href="/demo"
          className="rounded-md bg-[var(--citrus-500)] px-3 py-1.5 text-sm font-medium text-[var(--sky-ink)] lg:hidden"
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
          <p className="font-display text-2xl text-white">{SITE_NAME}</p>
          <p className="mt-2 max-w-sm text-sm text-white/70">
            Hotel ERP for Bhutan — independent hotels, chains, and leased
            multi-location owners.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm">
          <div className="flex flex-col gap-2">
            <Link href="/pricing" className="hover:text-white">
              Pricing
            </Link>
            <Link href="/conditions" className="hover:text-white">
              Conditions
            </Link>
            <Link href="/demo" className="hover:text-white">
              Request demo
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/status" className="hover:text-white">
              Status
            </Link>
            <Link href="/changelog" className="hover:text-white">
              Changelog
            </Link>
            <Link href="/login" className="hover:text-white">
              Login hub
            </Link>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-5xl text-xs text-white/50">
        © {new Date().getFullYear()} Fame Digital · {SITE_NAME}. Service starts
        after fees and conditions acceptance.
      </p>
    </footer>
  );
}
