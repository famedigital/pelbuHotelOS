/**
 * FO desk-facing report loaders (eZee meal count / FO occ / room move / guest aging).
 */

import { computeMealCovers } from "@/lib/kitchen/covers";
import { addToAging, type AgingAmounts, emptyAging } from "@/lib/reports/ar-aging";
import type { SupabaseClient } from "@supabase/supabase-js";

function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  if (!from || !to || to < from) return out;
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 400) {
    out.push(cur);
    cur = addDaysIso(cur, 1);
    guard += 1;
  }
  return out;
}

export type MealCountReportRow = {
  guest_name: string;
  booking_id: string;
  rooms: string;
  meal_plan: string;
  status: string;
  pax: number;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
};

export type MealCountReport = {
  businessDate: string;
  totals: { breakfast: number; lunch: number; dinner: number; eventCovers: number };
  rows: MealCountReportRow[];
};

export async function loadMealCountReport(
  admin: SupabaseClient,
  opts: { propertyId: string; businessDate: string },
): Promise<MealCountReport> {
  const covers = await computeMealCovers(
    // covers.ts typed against createSupabaseAdminClient ReturnType — compatible client
    admin as Parameters<typeof computeMealCovers>[0],
    opts.propertyId,
    opts.businessDate,
  );
  return {
    businessDate: opts.businessDate,
    totals: {
      breakfast: covers.breakfast,
      lunch: covers.lunch,
      dinner: covers.dinner,
      eventCovers: covers.eventCovers,
    },
    rows: covers.guests.map((g) => ({
      guest_name: g.guestName,
      booking_id: g.bookingId,
      rooms: g.rooms,
      meal_plan: g.mealPlanCode,
      status: g.status,
      pax: g.adults,
      breakfast: g.inclusions.breakfast,
      lunch: g.inclusions.lunch,
      dinner: g.inclusions.dinner,
    })),
  };
}

export type FoOccupancyDayRow = {
  date: string;
  sellable_capacity: number;
  rooms_occupied: number;
  rooms_comp: number;
  occupancy_pct: number;
  arrivals: number;
  departures: number;
};

export async function loadFoOccupancyReport(
  admin: SupabaseClient,
  opts: { propertyId: string; from: string; to: string },
): Promise<FoOccupancyDayRow[]> {
  const dates = daysInclusive(opts.from, opts.to);
  if (dates.length === 0) return [];

  const [{ data: roomTypes }, { data: units }, { data: assigns }, { data: bookings }] =
    await Promise.all([
      admin
        .from("room_types")
        .select("id, inventory_kind, unit_count")
        .eq("property_id", opts.propertyId),
      admin
        .from("room_units")
        .select("id, room_type_id, room_types(inventory_kind)")
        .eq("property_id", opts.propertyId)
        .limit(500),
      admin
        .from("room_assignments")
        .select(
          `id, room_unit_id, from_date, to_date, chargeable,
           booking_id, room_units(room_type_id, room_types(inventory_kind))`,
        )
        .eq("property_id", opts.propertyId)
        .lt("from_date", addDaysIso(opts.to, 1))
        .gt("to_date", opts.from)
        .limit(5000),
      admin
        .from("bookings")
        .select("id, check_in, check_out, status, rooms")
        .eq("property_id", opts.propertyId)
        .lt("check_in", addDaysIso(opts.to, 1))
        .gt("check_out", opts.from)
        .in("status", [
          "confirmed",
          "checked_in",
          "checked_out",
          "pending",
          "held",
        ])
        .limit(3000),
    ]);

  const sellableCapacity = (roomTypes ?? [])
    .filter((r) => r.inventory_kind === "sellable_guest")
    .reduce((s, r) => s + Number(r.unit_count ?? 0), 0);

  const unitSellable = new Map<string, boolean>();
  for (const u of units ?? []) {
    const rt = u.room_types as
      | { inventory_kind?: string }
      | { inventory_kind?: string }[]
      | null;
    const kind = Array.isArray(rt) ? rt[0]?.inventory_kind : rt?.inventory_kind;
    unitSellable.set(u.id as string, kind === "sellable_guest" || kind == null);
  }

  return dates.map((date) => {
    let occupied = 0;
    let comp = 0;
    for (const a of assigns ?? []) {
      const from = String(a.from_date).slice(0, 10);
      const to = String(a.to_date).slice(0, 10);
      if (!(from <= date && date < to)) continue;
      const unitId = a.room_unit_id as string;
      const sellable =
        unitSellable.get(unitId) ??
        (() => {
          const ru = a.room_units as
            | {
                room_types?:
                  | { inventory_kind?: string }
                  | { inventory_kind?: string }[]
                  | null;
              }
            | {
                room_types?:
                  | { inventory_kind?: string }
                  | { inventory_kind?: string }[]
                  | null;
              }[]
            | null;
          const u = Array.isArray(ru) ? ru[0] : ru;
          const rt = u?.room_types;
          const rto = Array.isArray(rt) ? rt[0] : rt;
          return rto?.inventory_kind !== "guide_comp" &&
            rto?.inventory_kind !== "driver_comp";
        })();
      if (!sellable) {
        comp += 1;
        continue;
      }
      if (a.chargeable === false) {
        comp += 1;
      } else {
        occupied += 1;
      }
    }

    let arrivals = 0;
    let departures = 0;
    for (const b of bookings ?? []) {
      const st = (b.status as string) ?? "";
      if (["cancelled", "no_show", "expired"].includes(st)) continue;
      if (String(b.check_in).slice(0, 10) === date) {
        arrivals += Math.max(1, Number(b.rooms ?? 1));
      }
      if (String(b.check_out).slice(0, 10) === date) {
        departures += Math.max(1, Number(b.rooms ?? 1));
      }
    }

    const cap = Math.max(0, sellableCapacity);
    const occPct =
      cap > 0 ? Math.round((occupied / cap) * 1000) / 10 : 0;

    return {
      date,
      sellable_capacity: cap,
      rooms_occupied: occupied,
      rooms_comp: comp,
      occupancy_pct: occPct,
      arrivals,
      departures,
    };
  });
}

export type RoomMoveAuditRow = {
  at: string;
  actor: string;
  summary: string;
  booking_id: string | null;
  assignment_id: string | null;
  action: string;
};

export async function loadRoomMoveAuditReport(
  admin: SupabaseClient,
  opts: { propertyId: string; from: string; to: string },
): Promise<RoomMoveAuditRow[]> {
  const fromTs = `${opts.from}T00:00:00+06:00`;
  const toTs = `${opts.to}T23:59:59.999+06:00`;

  const { data } = await admin
    .from("audit_events")
    .select("created_at, actor, action, summary, entity_id, meta")
    .eq("property_id", opts.propertyId)
    .gte("created_at", fromTs)
    .lte("created_at", toTs)
    .or(
      "action.ilike.%move%,action.ilike.%assignment%,summary.ilike.%→%",
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  return (data ?? [])
    .filter((r) => {
      const act = String(r.action ?? "").toLowerCase();
      return (
        act.includes("move") ||
        act.includes("assignment") ||
        String(r.summary ?? "").includes("→")
      );
    })
    .map((r) => {
      const meta = (r.meta ?? {}) as Record<string, unknown>;
      return {
        at: (r.created_at as string) ?? "",
        actor: (r.actor as string) ?? "desk",
        summary: (r.summary as string) ?? r.action ?? "",
        booking_id:
          typeof meta.booking_id === "string" ? meta.booking_id : null,
        assignment_id: (r.entity_id as string | null) ?? null,
        action: (r.action as string) ?? "",
      };
    });
}

export type GuestArAgingRow = {
  booking_id: string;
  folio_id: string;
  contact_name: string;
  status: string;
  check_out: string;
  balance_btn: number;
  aging_current: number;
  aging_d30: number;
  aging_d60: number;
  aging_d90: number;
  agent_name: string | null;
};

/** Direct-billing / guest ledger aging slabs (open folio balances). */
export async function loadGuestArAgingReport(
  admin: SupabaseClient,
  opts: { propertyId: string; asOf: string },
): Promise<{ rows: GuestArAgingRow[]; totals: AgingAmounts }> {
  const { data: folios } = await admin
    .from("folios")
    .select(
      `id, status, booking_id,
       bookings(id, contact_name, status, check_out, agents(company_name)),
       folio_lines(total_btn, status, created_at, business_date)`,
    )
    .eq("property_id", opts.propertyId)
    .eq("status", "open")
    .limit(800);

  const rows: GuestArAgingRow[] = [];
  let totals = emptyAging();

  for (const f of folios ?? []) {
    const lines = (f.folio_lines as
      | Array<{
          total_btn?: number;
          status?: string;
          created_at?: string;
          business_date?: string | null;
        }>
      | null) ?? [];
    const posted = lines.filter((l) => l.status === "posted");
    const balance = posted.reduce((s, l) => s + Number(l.total_btn ?? 0), 0);
    if (Math.abs(balance) < 0.01) continue;

    // Age the whole balance using earliest posted line as open date anchor
    let openDate = opts.asOf;
    for (const l of posted) {
      const d = (l.business_date ?? l.created_at ?? "").toString().slice(0, 10);
      if (d && d < openDate) openDate = d;
    }
    const aging = addToAging(emptyAging(), balance, opts.asOf, openDate);
    totals = {
      current: totals.current + aging.current,
      d30: totals.d30 + aging.d30,
      d60: totals.d60 + aging.d60,
      d90: totals.d90 + aging.d90,
      total: totals.total + aging.total,
    };

    const bRaw = f.bookings as
      | {
          id?: string;
          contact_name?: string;
          status?: string;
          check_out?: string;
          agents?:
            | { company_name?: string }
            | { company_name?: string }[]
            | null;
        }
      | {
          id?: string;
          contact_name?: string;
          status?: string;
          check_out?: string;
          agents?:
            | { company_name?: string }
            | { company_name?: string }[]
            | null;
        }[]
      | null;
    const b = Array.isArray(bRaw) ? bRaw[0] : bRaw;
    const agentRaw = b?.agents;
    const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;

    rows.push({
      booking_id: (b?.id as string) ?? (f.booking_id as string) ?? "",
      folio_id: f.id as string,
      contact_name: b?.contact_name ?? "Guest",
      status: b?.status ?? "",
      check_out: (b?.check_out ?? "").toString().slice(0, 10),
      balance_btn: balance,
      aging_current: aging.current,
      aging_d30: aging.d30,
      aging_d60: aging.d60,
      aging_d90: aging.d90,
      agent_name: agent?.company_name ?? null,
    });
  }

  rows.sort((a, b) => Math.abs(b.balance_btn) - Math.abs(a.balance_btn));
  return { rows, totals };
}

export type GroupOutstandingRow = {
  group_id: string;
  group_name: string;
  room_label: string;
  contact_name: string;
  booking_id: string;
  folio_id: string;
  status: string;
  balance_btn: number;
};

export async function loadGroupOutstandingReport(
  admin: SupabaseClient,
  opts: { propertyId: string },
): Promise<{ rows: GroupOutstandingRow[]; total_due_btn: number }> {
  const { data: groups } = await admin
    .from("booking_groups")
    .select("id, name, status")
    .eq("property_id", opts.propertyId)
    .not("status", "eq", "cancelled")
    .order("created_at", { ascending: false })
    .limit(80);

  const rows: GroupOutstandingRow[] = [];
  for (const g of groups ?? []) {
    const { data: members } = await admin
      .from("booking_group_members")
      .select("booking_id")
      .eq("group_id", g.id as string);
    const bookingIds = (members ?? []).map((m) => m.booking_id as string);
    if (!bookingIds.length) continue;

    const { data: bookings } = await admin
      .from("bookings")
      .select(
        `id, contact_name, status,
         room_assignments(room_units(label))`,
      )
      .in("id", bookingIds);

    const { data: folios } = await admin
      .from("folios")
      .select(
        "id, booking_id, status, folio_lines(total_btn, status, reverses_line_id)",
      )
      .eq("property_id", opts.propertyId)
      .eq("status", "open")
      .in("booking_id", bookingIds);

    for (const f of folios ?? []) {
      const lines =
        (f.folio_lines as Array<{
          total_btn?: number;
          status?: string;
          reverses_line_id?: string | null;
        }> | null) ?? [];
      const balance = lines.reduce((n, l) => {
        if (l.status === "void" || l.reverses_line_id) return n;
        return n + Number(l.total_btn ?? 0);
      }, 0);
      if (Math.abs(balance) < 0.5) continue;

      const b = (bookings ?? []).find((x) => x.id === f.booking_id);
      const assigns =
        (b?.room_assignments as
          | Array<{
              room_units?:
                | { label?: string }
                | { label?: string }[]
                | null;
            }>
          | null) ?? [];
      const ru = assigns[0]?.room_units;
      const unit = Array.isArray(ru) ? ru[0] : ru;

      rows.push({
        group_id: g.id as string,
        group_name: (g.name as string) || "Party",
        room_label: unit?.label?.trim() || "—",
        contact_name: (b?.contact_name as string) || "Guest",
        booking_id: (f.booking_id as string) || "",
        folio_id: f.id as string,
        status: (b?.status as string) || "",
        balance_btn: balance,
      });
    }
  }

  rows.sort((a, b) => Math.abs(b.balance_btn) - Math.abs(a.balance_btn));
  const total_due_btn = rows.reduce((n, r) => n + r.balance_btn, 0);
  return { rows, total_due_btn };
}

export type GroupPartyListRow = {
  group_id: string;
  group_name: string;
  check_in: string;
  check_out: string;
  room_count: number;
  status_mix: string;
  agent_name: string | null;
  leader_name: string | null;
};

export async function loadGroupArrivalsReport(
  admin: SupabaseClient,
  opts: { propertyId: string; from: string; to: string },
): Promise<GroupPartyListRow[]> {
  const { data: groups } = await admin
    .from("booking_groups")
    .select("id, name, check_in, check_out, agent_id, agents(company_name)")
    .eq("property_id", opts.propertyId)
    .gte("check_in", opts.from)
    .lte("check_in", opts.to)
    .not("status", "eq", "cancelled")
    .order("check_in", { ascending: true })
    .limit(200);

  return await mapGroupPartyRows(admin, groups ?? []);
}

export async function loadGroupInHouseReport(
  admin: SupabaseClient,
  opts: { propertyId: string; asOf: string },
): Promise<GroupPartyListRow[]> {
  const { data: groups } = await admin
    .from("booking_groups")
    .select("id, name, check_in, check_out, agent_id, agents(company_name)")
    .eq("property_id", opts.propertyId)
    .lte("check_in", opts.asOf)
    .gt("check_out", opts.asOf)
    .not("status", "eq", "cancelled")
    .order("check_in", { ascending: true })
    .limit(200);

  const mapped = await mapGroupPartyRows(admin, groups ?? []);
  return mapped.filter((r) => r.status_mix.includes("checked_in"));
}

async function mapGroupPartyRows(
  admin: SupabaseClient,
  groups: Array<Record<string, unknown>>,
): Promise<GroupPartyListRow[]> {
  const out: GroupPartyListRow[] = [];
  for (const g of groups) {
    const gid = g.id as string;
    const { data: members } = await admin
      .from("booking_group_members")
      .select("booking_id")
      .eq("group_id", gid);
    const ids = (members ?? []).map((m) => m.booking_id as string);
    if (!ids.length) continue;

    const { data: bookings } = await admin
      .from("bookings")
      .select("id, contact_name, status")
      .in("id", ids);

    const statuses = (bookings ?? []).map((b) => b.status as string);
    const mix = [...new Set(statuses)].join(" · ");
    const agentRaw = g.agents as
      | { company_name?: string }
      | { company_name?: string }[]
      | null;
    const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;

    out.push({
      group_id: gid,
      group_name: (g.name as string) || "Party",
      check_in: String(g.check_in ?? "").slice(0, 10),
      check_out: String(g.check_out ?? "").slice(0, 10),
      room_count: ids.length,
      status_mix: mix || "—",
      agent_name: agent?.company_name ?? null,
      leader_name: (bookings?.[0]?.contact_name as string | null) ?? null,
    });
  }
  return out;
}


