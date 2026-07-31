import { BRAND_ICONS } from "@/lib/brand";
import { LockIcon, PhoneIcon, XIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Desk phone from the property record — never hardcode a number. */
  phone?: string | null;
  /** Where the exit control returns to. */
  exitHref?: string;
};

/**
 * Focused checkout surface for the booking engine. Deliberately drops the
 * marketing header, hero and site footer: navigation escape routes lower
 * completion on a task the guest has already committed to. The only ways out
 * are an explicit exit control and a help phone.
 */
export function BookingCheckoutShell({
  children,
  phone,
  exitHref = "/rooms",
}: Props) {
  return (
    <div className="flex min-h-dvh flex-col bg-frost-1">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1160px] items-center gap-3 px-4 md:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND_ICONS.mark}
              alt="Pelbu Suites"
              width={28}
              height={28}
              className="size-7 rounded-md object-contain"
            />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Pelbu Suites
            </span>
          </Link>

          <span
            className="hidden items-center gap-1.5 rounded-full bg-mint-100 px-2.5 py-1 text-[11px] font-medium text-mint-600 sm:inline-flex"
            aria-label="Secure direct booking"
          >
            <LockIcon className="size-3" aria-hidden />
            Secure direct booking
          </span>

          <div className="ml-auto flex items-center gap-1">
            {phone ? (
              <a
                href={`tel:${phone.replace(/\s+/g, "")}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <PhoneIcon className="size-4" aria-hidden />
                <span className="hidden sm:inline">Need help</span>
              </a>
            ) : null}
            <Link
              href={exitHref}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <XIcon className="size-4" aria-hidden />
              <span className="hidden sm:inline">Exit</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1160px] flex-1 px-4 py-6 md:px-6 md:py-10">
        {children}
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-6">
          <p>Rates in BTN. Rooms are held while the desk confirms payment.</p>
          <nav className="flex items-center gap-4" aria-label="Booking help">
            <Link href="/rooms" className="hover:text-foreground">
              Rooms
            </Link>
            <Link href="/faq" className="hover:text-foreground">
              FAQ
            </Link>
            <Link href="/contact" className="hover:text-foreground">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
