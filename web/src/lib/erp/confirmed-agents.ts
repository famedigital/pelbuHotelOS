import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ConfirmedAgentContact = {
  agent_id: string;
  company_name: string;
  market: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: string;
  /** Confirmed (+ optional checked-in) bookings in range */
  booking_count: number;
  rooms_sold: number;
  next_check_in: string | null;
  last_check_in: string | null;
  /** Earliest check-out still upcoming */
  next_check_out: string | null;
  missing_phone: boolean;
  missing_email: boolean;
};

/**
 * Agents with confirmed (and optionally checked-in) reservations in a date
 * overlap window — call/email list for FO during eZee migration.
 */
export async function loadConfirmedAgentsContactList(
  admin: SupabaseClient,
  opts: {
    propertyId: string;
    from: string;
    to: string;
    /** Include checked-in stays (in-house). Default true. */
    includeCheckedIn?: boolean;
  },
): Promise<ConfirmedAgentContact[]> {
  const statuses = opts.includeCheckedIn
    ? (["confirmed", "checked_in"] as const)
    : (["confirmed"] as const);

  const { data: rows, error } = await admin
    .from("bookings")
    .select(
      `id, check_in, check_out, status, rooms, agent_id,
       agents!inner(
         id, company_name, market, contact_name, contact_phone, contact_email, status
       )`,
    )
    .eq("property_id", opts.propertyId)
    .not("agent_id", "is", null)
    .in("status", [...statuses])
    .lt("check_in", opts.to)
    .gt("check_out", opts.from)
    .order("check_in", { ascending: true })
    .limit(4000);

  if (error) throw new Error(error.message);

  type Ag = {
    id?: string;
    company_name?: string;
    market?: string;
    contact_name?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
    status?: string;
  };

  const map = new Map<
    string,
    ConfirmedAgentContact & { _checkIns: string[]; _checkOuts: string[] }
  >();

  for (const row of rows ?? []) {
    const agentId = row.agent_id as string;
    if (!agentId) continue;
    const raw = row.agents as Ag | Ag[] | null;
    const a = Array.isArray(raw) ? raw[0] : raw;
    if (!a?.id && !agentId) continue;

    const id = (a?.id as string) || agentId;
    let entry = map.get(id);
    if (!entry) {
      const phone = (a?.contact_phone ?? null)?.trim() || null;
      const email = (a?.contact_email ?? null)?.trim() || null;
      entry = {
        agent_id: id,
        company_name: a?.company_name ?? "Agent",
        market: a?.market ?? "—",
        contact_name: a?.contact_name ?? null,
        contact_phone: phone,
        contact_email: email,
        status: a?.status ?? "approved",
        booking_count: 0,
        rooms_sold: 0,
        next_check_in: null,
        last_check_in: null,
        next_check_out: null,
        missing_phone: !phone,
        missing_email: !email,
        _checkIns: [],
        _checkOuts: [],
      };
      map.set(id, entry);
    }
    entry.booking_count += 1;
    entry.rooms_sold += Math.max(1, Number(row.rooms ?? 1));
    entry._checkIns.push(row.check_in as string);
    entry._checkOuts.push(row.check_out as string);
  }

  const today = opts.from; // caller passes sensible today for "next"
  const list: ConfirmedAgentContact[] = [];
  for (const e of map.values()) {
    const sortedIn = [...e._checkIns].sort();
    const sortedOut = [...e._checkOuts].sort();
    const nextIn =
      sortedIn.find((d) => d >= today) ?? sortedIn[0] ?? null;
    const nextOut =
      sortedOut.find((d) => d >= today) ?? sortedOut[0] ?? null;
    list.push({
      agent_id: e.agent_id,
      company_name: e.company_name,
      market: e.market,
      contact_name: e.contact_name,
      contact_phone: e.contact_phone,
      contact_email: e.contact_email,
      status: e.status,
      booking_count: e.booking_count,
      rooms_sold: e.rooms_sold,
      next_check_in: nextIn,
      last_check_in: sortedIn[sortedIn.length - 1] ?? null,
      next_check_out: nextOut,
      missing_phone: e.missing_phone,
      missing_email: e.missing_email,
    });
  }

  list.sort((a, b) => {
    // Need contact first (missing contact rises)
    const missA = Number(a.missing_phone || a.missing_email);
    const missB = Number(b.missing_phone || b.missing_email);
    if (missA !== missB) return missB - missA;
    if (b.booking_count !== a.booking_count) return b.booking_count - a.booking_count;
    return a.company_name.localeCompare(b.company_name);
  });

  return list;
}

export function confirmedAgentsCsv(rows: ConfirmedAgentContact[]): string {
  const header = [
    "company_name",
    "contact_name",
    "contact_phone",
    "contact_email",
    "market",
    "booking_count",
    "rooms_sold",
    "next_check_in",
    "last_check_in",
    "agent_status",
    "agent_id",
  ];
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.company_name,
        r.contact_name,
        r.contact_phone,
        r.contact_email,
        r.market,
        r.booking_count,
        r.rooms_sold,
        r.next_check_in,
        r.last_check_in,
        r.status,
        r.agent_id,
      ]
        .map(esc)
        .join(","),
    );
  }
  return lines.join("\n");
}
