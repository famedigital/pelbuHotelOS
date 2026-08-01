import { daysBetweenIso } from "@/lib/reports/ar-aging";
import {
  loadAgentDossier,
  loadAgentProductionReport,
} from "@/lib/reports/agent-dossier";
import type { SupabaseClient } from "@supabase/supabase-js";

export const REPORT_CATALOG = [
  {
    slug: "agent-production",
    title: "Agent production",
    blurb: "Bookings, room-nights, and quoted totals by agent.",
  },
  {
    slug: "agent-ar",
    title: "Agent AR & payment habit",
    blurb: "Outstanding balances, aging, and payment mix per agent.",
  },
  {
    slug: "staff-attendance",
    title: "Staff attendance summary",
    blurb: "Clock events and estimated hours by staff member.",
  },
  {
    slug: "inventory-movements",
    title: "Inventory movements",
    blurb: "Receive / issue / waste quantities by item (unit cost when recorded).",
  },
] as const;

export type ReportSlug = (typeof REPORT_CATALOG)[number]["slug"];

export function isReportSlug(raw: string): raw is ReportSlug {
  return REPORT_CATALOG.some((r) => r.slug === raw);
}

export type StaffAttendanceRow = {
  staff_id: string;
  full_name: string;
  clock_ins: number;
  clock_outs: number;
  events: number;
  estimated_hours: number;
};

export async function loadStaffAttendanceSummary(
  admin: SupabaseClient,
  opts: { propertyId: string; from: string; to: string; staffId?: string },
): Promise<StaffAttendanceRow[]> {
  const fromTs = `${opts.from}T00:00:00+06:00`;
  const toTs = `${opts.to}T23:59:59.999+06:00`;

  let q = admin
    .from("staff_attendance_events")
    .select(
      "id, staff_id, event_kind, occurred_at, staff_members(full_name)",
    )
    .eq("property_id", opts.propertyId)
    .gte("occurred_at", fromTs)
    .lte("occurred_at", toTs)
    .order("occurred_at", { ascending: true })
    .limit(5000);
  if (opts.staffId) q = q.eq("staff_id", opts.staffId);

  const { data } = await q;

  type Ev = {
    staff_id: string;
    event_kind: string;
    occurred_at: string;
    staff_members?:
      | { full_name?: string }
      | { full_name?: string }[]
      | null;
  };

  const byStaff = new Map<
    string,
    {
      full_name: string;
      events: Ev[];
      clock_ins: number;
      clock_outs: number;
    }
  >();

  for (const raw of data ?? []) {
    const e = raw as unknown as Ev;
    const sm = Array.isArray(e.staff_members)
      ? e.staff_members[0]
      : e.staff_members;
    const name = sm?.full_name ?? "Staff";
    let bucket = byStaff.get(e.staff_id);
    if (!bucket) {
      bucket = { full_name: name, events: [], clock_ins: 0, clock_outs: 0 };
      byStaff.set(e.staff_id, bucket);
    }
    bucket.events.push(e);
    if (e.event_kind === "clock_in") bucket.clock_ins += 1;
    if (e.event_kind === "clock_out") bucket.clock_outs += 1;
  }

  const rows: StaffAttendanceRow[] = [];
  for (const [staff_id, bucket] of byStaff) {
    let estimatedMs = 0;
    let openIn: number | null = null;
    for (const e of bucket.events) {
      const t = new Date(e.occurred_at).getTime();
      if (Number.isNaN(t)) continue;
      if (e.event_kind === "clock_in") {
        openIn = t;
      } else if (e.event_kind === "clock_out" && openIn != null) {
        estimatedMs += Math.max(0, t - openIn);
        openIn = null;
      }
    }
    rows.push({
      staff_id,
      full_name: bucket.full_name,
      clock_ins: bucket.clock_ins,
      clock_outs: bucket.clock_outs,
      events: bucket.events.length,
      estimated_hours: Math.round((estimatedMs / 3_600_000) * 10) / 10,
    });
  }

  return rows.sort((a, b) => b.estimated_hours - a.estimated_hours);
}

export type InventoryMovementRow = {
  item_id: string;
  item_name: string;
  category: string;
  movement_kind: string;
  qty: number;
  value_btn: number | null;
  has_cost: boolean;
};

export async function loadInventoryMovementsSummary(
  admin: SupabaseClient,
  opts: {
    propertyId: string;
    from: string;
    to: string;
    category?: string;
  },
): Promise<{ rows: InventoryMovementRow[]; missingCostCount: number }> {
  const fromTs = `${opts.from}T00:00:00+06:00`;
  const toTs = `${opts.to}T23:59:59.999+06:00`;

  const { data } = await admin
    .from("inventory_movements")
    .select(
      "item_id, movement_kind, qty_delta, unit_cost_btn, inventory_items(name, category)",
    )
    .eq("property_id", opts.propertyId)
    .gte("created_at", fromTs)
    .lte("created_at", toTs)
    .limit(5000);

  const agg = new Map<string, InventoryMovementRow>();
  let missingCostCount = 0;

  for (const raw of data ?? []) {
    const item = raw.inventory_items as
      | { name?: string; category?: string }
      | { name?: string; category?: string }[]
      | null;
    const itemObj = Array.isArray(item) ? item[0] : item;
    const category = itemObj?.category ?? "other";
    if (opts.category && category !== opts.category) continue;

    const kind = (raw.movement_kind as string) ?? "adjust";
    const itemId = raw.item_id as string;
    const key = `${itemId}|${kind}`;
    const qty = Math.abs(Number(raw.qty_delta ?? 0));
    const unitCost =
      raw.unit_cost_btn == null ? null : Number(raw.unit_cost_btn);
    if (unitCost == null) missingCostCount += 1;

    const existing = agg.get(key);
    if (existing) {
      existing.qty += qty;
      if (unitCost != null) {
        existing.value_btn = (existing.value_btn ?? 0) + qty * unitCost;
        existing.has_cost = true;
      }
    } else {
      agg.set(key, {
        item_id: itemId,
        item_name: itemObj?.name ?? "Item",
        category,
        movement_kind: kind,
        qty,
        value_btn: unitCost == null ? null : qty * unitCost,
        has_cost: unitCost != null,
      });
    }
  }

  return {
    rows: [...agg.values()].sort((a, b) => b.qty - a.qty),
    missingCostCount,
  };
}

export async function loadAgentArReport(
  admin: SupabaseClient,
  opts: { propertyId: string; from: string; to: string; today: string },
): Promise<
  {
    agent_id: string;
    company_name: string;
    outstanding: number;
    aging_total: number;
    credit_used: number;
    credit_limit: number;
    habit: string;
    bookings_in_range: number;
  }[]
> {
  const { data: agents } = await admin
    .from("agents")
    .select("id, company_name, credit_limit, credit_used, status")
    .in("status", ["approved", "demo"])
    .order("company_name")
    .limit(120);

  const rows = [];
  for (const a of agents ?? []) {
    const dossier = await loadAgentDossier(admin, {
      propertyId: opts.propertyId,
      agentId: a.id as string,
      from: opts.from,
      to: opts.to,
      today: opts.today,
    });
    if (!dossier) continue;
    if (
      dossier.summary.bookingCount === 0 &&
      Math.abs(dossier.money.outstanding) < 0.01 &&
      Number(a.credit_used ?? 0) === 0
    ) {
      continue;
    }
    rows.push({
      agent_id: a.id as string,
      company_name: (a.company_name as string) ?? "Agent",
      outstanding: dossier.money.outstanding,
      aging_total: dossier.money.aging.total,
      credit_used: Number(a.credit_used ?? 0),
      credit_limit: Number(a.credit_limit ?? 0),
      habit: dossier.money.habit.blurb,
      bookings_in_range: dossier.summary.bookingCount,
    });
  }

  return rows.sort((a, b) => b.outstanding - a.outstanding);
}

/** Re-export for catalog page convenience. */
export { loadAgentProductionReport, daysBetweenIso };
