import { requireAgentSession } from "@/lib/agent-auth";
import {
  addDaysIso,
  loadAgentBookings,
  loadOccupancyWindow,
  type DayOccupancy,
} from "@/lib/agent-occupancy";
import { formatBtn } from "@/lib/pricing";
import { pelbuPropertyId } from "@/lib/rates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const WINDOW_NIGHTS = 30;

function thimphuTodayIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Thimphu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}

type Availability = "open" | "limited" | "full";

/**
 * Collapse occupancy into a coarse band. Agents must not be able to read the
 * hotel's booking volume, so exact sold/remaining counts never reach the page —
 * only whether they can still ask for rooms that night.
 */
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
  open: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  limited: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  full: "bg-destructive/10 text-destructive",
};

export default async function AgentCalendarPage() {
  const session = await requireAgentSession();
  const admin = createSupabaseAdminClient();
  const propertyId = await pelbuPropertyId(admin);

  const start = thimphuTodayIso();
  const end = addDaysIso(start, WINDOW_NIGHTS);

  const [occupancy, bookings] = await Promise.all([
    loadOccupancyWindow(admin, propertyId, start, end),
    loadAgentBookings(admin, session.agentId, 60),
  ]);

  const ownDates = new Set<string>();
  for (const booking of bookings) {
    let cursor = booking.checkIn;
    for (let i = 0; i < 400 && cursor < booking.checkOut; i += 1) {
      ownDates.add(cursor);
      cursor = addDaysIso(cursor, 1);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h1 className="text-lg font-semibold">Availability</h1>
          <p className="text-sm text-muted-foreground">
            Whether we can take rooms over the next {WINDOW_NIGHTS} nights. Room
            numbers, other guests, and other partners stay private.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Legend className="bg-emerald-500/20" label="Open" />
          <Legend className="bg-amber-500/20" label="Limited" />
          <Legend className="bg-destructive/20" label="Full" />
          <Legend className="border border-primary" label="Your stay" />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">
          {occupancy.map((day) => {
            const availability = availabilityFor(day);
            const mine = ownDates.has(day.date);
            const date = new Date(`${day.date}T00:00:00Z`);
            return (
              <div
                key={day.date}
                className={`rounded-lg px-2 py-2 text-center ${AVAILABILITY_TONE[availability]} ${
                  mine ? "ring-2 ring-primary ring-offset-1" : ""
                }`}
              >
                <p className="text-[10px] uppercase opacity-70">
                  {date.toLocaleDateString("en-US", {
                    timeZone: "UTC",
                    weekday: "short",
                  })}
                </p>
                <p className="text-sm font-semibold">{date.getUTCDate()}</p>
                <p className="text-[11px]">
                  {AVAILABILITY_LABEL[availability]}
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Ask for exact rooms on the Book tab — we confirm what is free for your
          dates there.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Your bookings</h2>
        {bookings.length === 0 ? (
          <p className="rounded-xl border border-border px-4 py-5 text-sm text-muted-foreground">
            No bookings yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {bookings.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {b.checkIn} → {b.checkOut}
                  </p>
                  <p className="text-muted-foreground">
                    {b.rooms} room{b.rooms === 1 ? "" : "s"} · {b.status}
                    {b.guideNumber ? ` · guide ${b.guideNumber}` : ""}
                  </p>
                </div>
                <span className="tabular-nums text-muted-foreground">
                  {b.quotedTotalBtn == null ? "—" : formatBtn(b.quotedTotalBtn)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
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
