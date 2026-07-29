import Link from "next/link";
import { BRAND_ICONS } from "@/lib/brand";

/** Compact footer — brand + two link columns. No hairlines, no section labels. */
export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-ink text-ivory">
      <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-12 md:grid-cols-[1.5fr_1fr_1fr] md:px-8 md:py-14">
        <div className="space-y-3">
          <Link href="/" className="inline-flex items-center gap-2.5 text-[13px] font-medium">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND_ICONS.mark}
              alt=""
              className="h-8 w-8 object-contain"
              width={32}
              height={32}
            />
            Pelbu Suites
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-ivory/55">
            Olakha, Thimphu — rooms, cafe, restaurant, spa, and meeting under one
            roof.
          </p>
        </div>

        <div className="flex flex-col gap-2 text-sm text-ivory/70">
          <Link href="/rooms" className="hover:text-ivory">
            Rooms
          </Link>
          <Link href="/dine" className="hover:text-ivory">
            Dine
          </Link>
          <Link href="/spa" className="hover:text-ivory">
            Spa
          </Link>
          <Link href="/meeting" className="hover:text-ivory">
            Meeting
          </Link>
        </div>

        <div className="flex flex-col gap-2 text-sm text-ivory/70">
          <Link href="/book" className="hover:text-ivory">
            Book a stay
          </Link>
          <Link href="/order" className="hover:text-ivory">
            Order food
          </Link>
          <Link href="/agents" className="hover:text-ivory">
            Agents
          </Link>
          <Link href="/contact" className="hover:text-ivory">
            Contact
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-[1120px] px-5 pb-8 text-xs text-ivory/35 md:px-8">
        © {new Date().getFullYear()} Pelbu Suites
      </div>
    </footer>
  );
}
