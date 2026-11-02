import { AgentBookForm } from "@/components/erp/AgentBookForm";
import { AgentStaysCreditCapsule } from "@/components/erp/agent-portal/AgentStaysCreditCapsule";
import {
  AgentStaysFilterToolbar,
  type AgentStaysPreset,
} from "@/components/erp/agent-portal/AgentStaysFilterToolbar";
import {
  AgentGhostLink,
  AgentPageHero,
  AgentSection,
} from "@/components/erp/agent-portal/AgentPortalChrome";
import { AgentStaysTable } from "@/components/erp/agent-portal/AgentStaysTable";
import { requireAgentPropertySession } from "@/lib/agent-auth";
import {
  agentStayDateBounds,
  loadAgentStayRows,
  stayOverlapsRange,
} from "@/lib/agent-portal-stays";
import { resolveHoldTtlHours } from "@/lib/holds";
import { thimphuToday } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Bookings ledger · Partner",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{
    tab?: string;
    from?: string;
    to?: string;
    q?: string;
    preset?: string;
  }>;
};

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function AgentStaysPage({ searchParams }: Props) {
  const session = await requireAgentPropertySession();
  const sp = await searchParams;
  const tab = sp.tab === "new" ? "new" : "bookings";
  const preset = (sp.preset as AgentStaysPreset | undefined) ?? "all";
  const search = sp.q ?? "";

  const admin = createSupabaseAdminClient();
  const today = thimphuToday();

  let allRows: Awaited<ReturnType<typeof loadAgentStayRows>> = [];
  try {
    allRows = await loadAgentStayRows(admin, {
      agentId: session.agentId,
      propertyId: session.activePropertyId,
      sessionAgentId: session.agentId,
      limit: 300,
    });
  } catch (e) {
    console.error("agent stays page", e);
  }

  const bounds = agentStayDateBounds(allRows);
  const seasonFrom = `${today.slice(0, 4)}-01-01`;
  const seasonTo = today;
  const weekFrom = today;
  const weekTo = addDaysIso(today, 7);

  let from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : "";
  let to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : "";

  if (!from || !to) {
    if (preset === "season") {
      from = seasonFrom;
      to = seasonTo;
    } else if (preset === "arriving") {
      from = weekFrom;
      to = weekTo;
    } else {
      from = bounds.from ?? today;
      to = bounds.to ?? today;
    }
  }

  const rows =
    from && to
      ? allRows.filter((r) =>
          stayOverlapsRange(r.checkIn, r.checkOut, from, to),
        )
      : allRows;

  const link = session.links.find(
    (l) => l.propertyId === session.activePropertyId,
  );
  const hotelName = link?.propertyName ?? "Hotel";

  const roomNights = rows.reduce(
    (s, r) => s + r.nights * Math.max(1, r.roomsCount),
    0,
  );
  const guestPax = rows.reduce((s, r) => s + r.paxCount, 0);
  const quotedBtn = rows.reduce((s, r) => s + r.grandTotalBtn, 0);
  const paidBtn = rows.reduce((s, r) => s + r.paidBtn, 0);
  const dueBtn = rows.reduce(
    (s, r) => s + (Math.abs(r.dueBtn) > 0.5 ? r.dueBtn : 0),
    0,
  );

  const exportQs = new URLSearchParams({
    from,
    to,
    preset,
    ...(search ? { q: search } : {}),
  });
  const exportHref = `/api/agents/stays/export?${exportQs.toString()}`;
  const printHref = `/agents/app/stays/statement?${exportQs.toString()}`;

  const bookingsTabHref = `/agents/app/stays?tab=bookings&from=${from}&to=${to}&preset=${preset}${search ? `&q=${encodeURIComponent(search)}` : ""}`;

  const { hours, seasonKind } = await resolveHoldTtlHours(
    admin,
    session.activePropertyId,
    "agent",
    today,
  );

  return (
    <div className="space-y-6">
      <AgentPageHero
        eyebrow={`${hotelName} · Partner ledger`}
        title="Bookings & commercial statement"
        blurb="All stays for this hotel — filter by dates, export Excel, or print a B2B statement. New holds use your MoU rate."
        actions={
          <AgentGhostLink href="/agents/app/money">Money & dues</AgentGhostLink>
        }
      />

      <div
        role="tablist"
        aria-label="Stays hub"
        className="inline-flex h-10 items-center gap-1 rounded-lg bg-secondary p-1"
      >
        <Link
          role="tab"
          aria-selected={tab === "bookings"}
          href={bookingsTabHref}
          className={cn(
            "inline-flex h-8 items-center rounded-md px-4 text-sm font-medium transition-colors",
            tab === "bookings"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          All bookings
        </Link>
        <Link
          role="tab"
          aria-selected={tab === "new"}
          href="/agents/app/stays?tab=new"
          className={cn(
            "inline-flex h-8 items-center rounded-md px-4 text-sm font-medium transition-colors",
            tab === "new"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          New booking
        </Link>
      </div>

      {tab === "bookings" ? (
        <div className="space-y-4">
          <AgentStaysCreditCapsule
            staysCount={rows.length}
            roomNights={roomNights}
            guestPax={guestPax}
            quotedBtn={quotedBtn}
            paidBtn={paidBtn}
            dueBtn={dueBtn}
            creditLimit={session.creditLimit}
            creditUsed={session.creditUsed}
          />

          <AgentStaysFilterToolbar
            from={from}
            to={to}
            preset={preset}
            search={search}
            boundsFrom={bounds.from}
            boundsTo={bounds.to}
            seasonFrom={seasonFrom}
            seasonTo={seasonTo}
            weekFrom={weekFrom}
            weekTo={weekTo}
            exportHref={exportHref}
            printHref={printHref}
          />

          <AgentSection
            title="All bookings"
            description={`${from} → ${to} · opaque ledger · sticky totals`}
          >
            <AgentStaysTable
              rows={rows}
              search={search}
              pendingOnly={preset === "pending"}
            />
          </AgentSection>
        </div>
      ) : (
        <AgentSection
          title="New hold"
          description={`Rooms stay held for ${hours}h (${seasonKind} season) until the desk confirms against your credit.`}
        >
          <div className="neo-card p-4 sm:p-6">
            <AgentBookForm />
          </div>
        </AgentSection>
      )}
    </div>
  );
}
