import { deskLogout } from "@/app/actions/desk";
import { PropertySwitcher } from "@/components/erp/PropertySwitcher";
import { BRAND_ICONS } from "@/lib/brand";
import type { PropertyRow } from "@/lib/property-types";
import { SITE_NAME } from "@/lib/site";
import Link from "next/link";

export function DeskHeader({
  title,
  properties,
  activePropertyId,
}: {
  title: string;
  properties?: PropertyRow[];
  activePropertyId?: string;
}) {
  const active = properties?.find((p) => p.id === activePropertyId);
  const brand = active?.name ?? SITE_NAME;

  return (
    <header className="border-b border-black/30 bg-espresso text-ivory">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-5 md:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/erp" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND_ICONS.mark}
              alt=""
              className="h-9 w-9 object-contain"
              width={36}
              height={36}
            />
            <span className="text-[11px] font-semibold tracking-[0.3em] text-gold uppercase">
              {brand}
            </span>
          </Link>
          <span className="h-4 w-px bg-white/20" aria-hidden="true" />
          <h1 className="text-base font-medium tracking-wide text-white">{title}</h1>
          {properties && properties.length > 0 && activePropertyId ? (
            <PropertySwitcher
              properties={properties}
              activePropertyId={activePropertyId}
            />
          ) : null}
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          <Link
            href="/erp"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Inbox
          </Link>
          <Link
            href="/erp/group"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Group
          </Link>
          <Link
            href="/erp/properties/new"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Add hotel
          </Link>
          <Link
            href="/erp/check-in"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Check-in
          </Link>
          <Link
            href="/erp/arrivals"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Arrivals
          </Link>
          <Link
            href="/erp/guests"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Guests
          </Link>
          <Link
            href="/erp/reservations"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Reservations
          </Link>
          <Link
            href="/erp/invoices"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Invoices
          </Link>
          <Link
            href="/erp/payments"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Payments
          </Link>
          <Link
            href="/erp/pos"
            className="inline-flex min-h-10 items-center rounded-sm bg-gold px-4 text-sm font-medium text-espresso transition-colors hover:bg-gold/90"
          >
            POS
          </Link>
          <Link
            href="/erp/fast-book"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Fast book
          </Link>
          <Link
            href="/erp/agents"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Agents
          </Link>
          <Link
            href="/erp/finance"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Finance
          </Link>
          <Link
            href="/erp/gst"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            GST
          </Link>
          <Link
            href="/erp/calendar"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Calendar
          </Link>
          <Link
            href="/erp/housekeeping"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            HK
          </Link>
          <Link
            href="/erp/maintenance"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Maint
          </Link>
          <Link
            href="/erp/allotments"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Allotments
          </Link>
          <Link
            href="/erp/partners"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Partners
          </Link>
          <Link
            href="/erp/reports"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Reports
          </Link>
          <Link
            href="/erp/rooms"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Rooms
          </Link>
          <Link
            href="/erp/inventory"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Stock
          </Link>
          <Link
            href="/erp/hr"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            HR
          </Link>
          <Link
            href="/erp/channel"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Channel
          </Link>
          <Link
            href="/erp/night-audit"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Audit
          </Link>
          <span className="mx-1 hidden h-6 w-px bg-white/15 sm:block" aria-hidden="true" />
          <form action={deskLogout}>
            <button
              type="submit"
              className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
