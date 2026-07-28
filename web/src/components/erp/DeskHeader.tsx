import { deskLogout } from "@/app/actions/desk";
import Link from "next/link";

export function DeskHeader({ title }: { title: string }) {
  return (
    <header className="border-b border-black/30 bg-espresso text-ivory">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-5 md:px-8">
        <div className="flex items-baseline gap-3">
          <span className="text-[11px] font-semibold tracking-[0.3em] text-gold uppercase">
            Pelbu desk
          </span>
          <span className="h-4 w-px bg-white/20" aria-hidden="true" />
          <h1 className="text-base font-medium tracking-wide text-white">{title}</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          <Link
            href="/erp"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Inbox
          </Link>
          <Link
            href="/erp/check-in"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/20 px-4 text-sm text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Check-in
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
