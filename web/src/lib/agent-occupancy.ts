import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { bookingCommitsInventory } from "@/lib/inventory-availability";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type DayOccupancy = {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  capacity: number;
  /** Rooms committed across ALL bookings — anonymous, no guest/agent identity. */
  sold: number;
  remaining: number;
};

export type AgentBookingSummary = {
  id: string;
  checkIn: string;
  checkOut: string;
  status: string;
  rooms: number;
  guideNumber: string | null;
  quotedTotalBtn: number | null;
  createdAt: string;
};

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function eachDate(startIso: string, endExclusiveIso: string): string[] {
  const out: string[] = [];
  let cursor = startIso;
  // Guard against runaway loops on bad input.
  for (let i = 0; i < 400 && cursor < endExclusiveIso; i += 1) {
    out.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return out;
}

/**
 * Anonymous per-day occupancy for a window. Returns only aggregate room counts
 * and total capacity — never guest names, other agents, or booking identities.
 * This is the ONLY property-wide data an agent may see.
 */
export async function loadOccupancyWindow(
  admin: Admin,
  propertyId: string,
  startIso: string,
  endExclusiveIso: string,
): Promise<DayOccupancy[]> {
  const now = new Date();

  const { data: types } = await admin
    .from("room_types")
    .select("unit_count")
    .eq("property_id", propertyId)
    .eq("inventory_kind", "sellable_guest");

  const capacity = (types ?? []).reduce(
    (sum, t) => sum + Number(t.unit_count ?? 0),
    0,
  );

  const { data: bookings } = await admin
    .from("bookings")
    .select(
      "check_in, check_out, status, hold_expires_at, booking_rooms(qty, inventory_kind)",
    )
    .eq("property_id", propertyId)
    .in("status", ["held", "confirmed", "checked_in"])
    .lt("check_in", endExclusiveIso)
    .gt("check_out", startIso);

  const soldByDate = new Map<string, number>();
  for (const booking of bookings ?? []) {
    if (
      !bookingCommitsInventory(
        {
          status: booking.status as string,
          hold_expires_at: (booking.hold_expires_at as string | null) ?? null,
        },
        now,
      )
    ) {
      continue;
    }
    const rooms = ((booking.booking_rooms ?? []) as {
      qty: number;
      inventory_kind: string;
    }[])
      .filter((line) => line.inventory_kind === "sellable_guest")
      .reduce((sum, line) => sum + Number(line.qty), 0);
    if (rooms === 0) continue;

    for (const date of eachDate(
      booking.check_in as string,
      booking.check_out as string,
    )) {
      if (date < startIso || date >= endExclusiveIso) continue;
      soldByDate.set(date, (soldByDate.get(date) ?? 0) + rooms);
    }
  }

  return eachDate(startIso, endExclusiveIso).map((date) => {
    const sold = Math.min(capacity, soldByDate.get(date) ?? 0);
    return {
      date,
      capacity,
      sold,
      remaining: Math.max(0, capacity - sold),
    };
  });
}

/** The agent's OWN bookings only, scoped by agent_id. */
export async function loadAgentBookings(
  admin: Admin,
  agentId: string,
  limit = 60,
): Promise<AgentBookingSummary[]> {
  const { data } = await admin
    .from("bookings")
    .select(
      "id, check_in, check_out, status, guide_number, quoted_total_btn, created_at, booking_rooms(qty)",
    )
    .eq("agent_id", agentId)
    .order("check_in", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    checkIn: row.check_in as string,
    checkOut: row.check_out as string,
    status: row.status as string,
    rooms: ((row.booking_rooms ?? []) as { qty: number }[]).reduce(
      (sum, line) => sum + Number(line.qty),
      0,
    ),
    guideNumber: (row.guide_number as string | null) ?? null,
    quotedTotalBtn:
      row.quoted_total_btn == null ? null : Number(row.quoted_total_btn),
    createdAt: row.created_at as string,
  }));
}

export { addDaysIso, eachDate };
