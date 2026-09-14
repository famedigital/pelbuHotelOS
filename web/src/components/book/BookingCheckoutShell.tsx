import { BrandLockup } from "@/components/site/BrandLockup";
import { LockIcon, PhoneIcon, XIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Desk phone from the property record — never hardcode a number. */
  phone?: string | null;
  /** Identity logo (Cloudinary or local mark) — same source as the public header. */
  logoSrc?: string | null;
  /** Where the exit control returns to. */
  exitHref?: string;
};

/**
 * Focused checkout surface for the booking engine. Forest rail + mist canvas
 * so book stays on-brand without the marketing mega menu.
 */
export function BookingCheckoutShell({
  children,
  phone,
  logoSrc,
  exitHref = "/rooms",
}: Props) {
  return (
    <div className="flex min-h-dvh flex-col bg-mist-0">
      <header className="sticky top-0 z-40 overflow-visible">
        <div className="relative h-14 overflow-visible border-b border-forest bg-forest text-[#f2f4f3] md:h-16">
          <div
            className="absolute inset-x-0 bottom-0 h-0.5 bg-ember"
            aria-hidden
          />
          <div className="relative mx-auto flex h-full max-w-[1160px] items-center gap-3 px-4 md:px-6">
            <BrandLockup
              logoSrc={logoSrc}
              tone="hero"
              className="!text-[#f2f4f3]"
            />

            <span
              className="relative z-10 hidden items-center gap-1.5 border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-celadon sm:inline-flex"
              aria-label="Secure direct booking"
            >
              <LockIcon className="size-3" aria-hidden />
              Secure direct booking
            </span>

            <div className="relative z-10 ml-auto flex items-center gap-1">
              {phone ? (
                <a
                  href={`tel:${phone.replace(/\s+/g, "")}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <PhoneIcon className="size-4" aria-hidden />
                  <span className="hidden sm:inline">Need help</span>
                </a>
              ) : null}
              <Link
                href={exitHref}
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <XIcon className="size-4" aria-hidden />
                <span className="hidden sm:inline">Exit</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1160px] flex-1 px-4 pb-6 pt-5 md:px-6 md:pb-10 md:pt-12">
        {children}
      </main>

      <footer className="hidden border-t border-cedar-rule bg-white lg:block">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-6">
          <p>Rates in BTN. Rooms are held while the desk confirms payment.</p>
          <nav className="flex items-center gap-4" aria-label="Booking help">
            <Link href="/rooms" className="hover:text-juniper">
              Rooms
            </Link>
            <Link href="/faq" className="hover:text-juniper">
              FAQ
            </Link>
            <Link href="/contact" className="hover:text-juniper">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
