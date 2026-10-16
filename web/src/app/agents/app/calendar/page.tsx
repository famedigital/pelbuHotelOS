import { HoldCountdown } from "@/components/erp/HoldCountdown";
import {
  AgentGhostLink,
  AgentPageHero,
  AgentPrimaryLink,
  AgentSection,
  AgentStatusPill,
  bookingStatusTone,
} from "@/components/erp/agent-portal/AgentPortalChrome";
import { requireAgentPropertySession } from "@/lib/agent-auth";
import {
  addDaysIso,
  loadAgentBookings,
  loadOccupancyWindow,
  type DayOccupancy,
} from "@/lib/agent-occupancy";
import { formatBtn } from "@/lib/pricing";
import { thimphuToday } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

const WINDOW_NIGHTS = 30;

type Availability = "open" | "limited" | "full";

function availabilityFor(day: DayOccupancy): Availability {
  if (day.capacity === 0 || day.remaining === 0) return "full";
  if (day.remaining <= Math.max(1, Math.round(day.capacity * 0.2))) {
    return "limited";
  }
  return "open";
}

const AVAILABILITY_LABEL: Record<Availability, string> = {
  open: "Open",
  limited: "Limited",
  full: "Full",
};

const AVAILABILITY_TONE: Record<Availability, string> = {
  open: "bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-500/20",
  limited: "bg-amber-500/15 text-amber-900 ring-1 ring-amber-500/25",
  full: "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
};

export default async function AgentCalendarPage() {
  const session = await requireAgentPropertySession();
  const admin = createSupabaseAdminClient();
  const propertyId = session.activePropertyId;
  const today = thimphuToday();
  const start = today;
  const end = addDaysIso(start, WINDOW_NIGHTS);

  let occupancy: DayOccupancy[] = [];
  let bookings: Awaited<ReturnType<typeof loadAgentBookings>> = [];

  try {
    [occupancy, bookings] = await Promise.all([
      loadOccupancyWindow(admin, propertyId, start, end),
      loadAgentBookings(admin, session.agentId, 60, propertyId),
    ]);
  } catch (e) {
    console.error("agent calendar load failed", e);
  }

  const ownDates = new Set<string>();
  for (const booking of bookings) {
    let cursor = booking.checkIn;
    for (let i = 0; i < 400 && cursor < booking.checkOut; i += 1) {
      ownDates.add(cursor);
      cursor = addDaysIso(cursor, 1);
    }
  }

  const held = bookings.filter((b) => b.status === "held" && b.holdExpiresAt);

  return (
    <div className="space-y-7">
      <AgentPageHero
        eyebrow="Availability"
        title="Free-sell calendar"
        blurb={`Next ${WINDOW_NIGHTS} nights — bands only (Open / Limited / Full). Exact counts stay private.`}
        actions={
          <>
            <AgentPrimaryLink href="/agents/app/book">Hold rooms</AgentPrimaryLink>
            <AgentGhostLink href="/agents/app/stays">Stays table</AgentGhostLink>
          </>
        }
      />

      <AgentSection title="Hotel bands" description="Your nights ringed in sky">
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Legend className="bg-emerald-500/30" label="Open" />
          <Legend className="bg-amber-500/30" label="Limited" />
          <Legend className="bg-destructive/30" label="Full" />
          <Legend className="ring-2 ring-sky-600" label="Your stay" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">
          {occupancy.map((day) => {
            const availability = availabilityFor(day);
            const mine = ownDates.has(day.date);
            const date = new Date(`${day.date}T00:00:00Z`);
            return (
              <div
                key={day.date}
                className={`rounded-xl px-2 py-2.5 text-center ${AVAILABILITY_TONE[availability]} ${
                  mine ? "ring-2 ring-sky-600 ring-offset-2 ring-offset-background" : ""
                }`}
              >
                <p className="text-[10px] uppercase opacity-70">
                  {date.toLocaleDateString("en-US", {
                    timeZone: "UTC",
                    weekday: "short",
                  })}
                </p>
                <p className="text-sm font-semibold">{date.getUTCDate()}</p>
                <p className="text-[11px] font-medium">
                  {AVAILABILITY_LABEL[availability]}
                </p>
              </div>
            );
          })}
        </div>
      </AgentSection>

      {held.length > 0 ? (
        <AgentSection title="Open holds" description="Timer until desk confirms">
          <ul className="grid gap-2 sm:grid-cols-2">
            {held.map((b) => (
              <li
                key={b.id}
                className="rounded-2xl border border-amber-400/40 bg-amber-50/70 px-4 py-3"
              >
                <Link
                  href={`/agents/app/stays/${b.id}`}
                  className="text-sm font-semibold text-sky-900 underline-offset-4 hover:underline"
                >
                  {b.checkIn} → {b.checkOut}
                </Link>
                {b.holdExpiresAt ? (
                  <div className="mt-2">
                    <HoldCountdown expiresAt={b.holdExpiresAt} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </AgentSection>
      ) : null}

      <AgentSection
        title="Your bookings"
        description="Open the stays table for invoices & proofs"
        action={
          <Link
            href="/agents/app/stays"
            className="text-sm font-medium text-sky-700 underline-offset-4 hover:underline"
          >
            Full table
          </Link>
        }
      >
        {bookings.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            No bookings yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {bookings.slice(0, 12).map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card px-4 py-3"
              >
                <div>
                  <Link
                    href={`/agents/app/stays/${b.id}`}
                    className="text-sm font-semibold underline-offset-4 hover:underline"
                  >
                    {b.checkIn} → {b.checkOut}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <AgentStatusPill tone={bookingStatusTone(b.status)}>
                      {b.status.replace(/_/g, " ")}
                    </AgentStatusPill>
                    <span className="text-xs text-muted-foreground">
                      {b.rooms} room{b.rooms === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {b.quotedTotalBtn == null
                    ? "—"
                    : formatBtn(b.quotedTotalBtn)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AgentSection>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block size-3 rounded ${className}`} />
      {label}
    </span>
  );
}
