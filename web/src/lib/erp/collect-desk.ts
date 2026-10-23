import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type CollectStay = {
  bookingId: string;
  folioId: string | null;
  confirmation: string | null;
  guest: string;
  agentId: string | null;
  agent: string;
  checkIn: string;
  checkOut: string;
  status: string;
  rate: number | null;
  bill: number;
  paid: number;
  due: number;
};

export type CollectAgent = {
  key: string;
  agentId: string | null;
  name: string;
  bill: number;
  paid: number;
  due: number;
  stays: CollectStay[];
};

export type CollectDesk = {
  from: string;
  bill: number;
  paid: number;
  due: number;
  agents: CollectAgent[];
};

type Line = {
  total_btn?: number | null;
  status?: string | null;
  source_type?: string | null;
};

function one<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

function moneyOf(lines: Line[]): { bill: number; paid: number } {
  let bill = 0;
  let paid = 0;
  for (const line of lines) {
    if ((line.status ?? "") !== "posted") continue;
    const total = Number(line.total_btn) || 0;
    const source = (line.source_type ?? "").toLowerCase();
    if (source === "payment" || source === "deposit") paid += -total;
    else bill += total;
  }
  return { bill, paid };
}

/** Stays in house or checked out since `from`, with what is still to collect. */
export async function loadCollectDesk(
  admin: Admin,
  propertyId: string,
  from = "2026-08-01",
): Promise<CollectDesk> {
  const { data, error } = await admin
    .from("bookings")
    .select(
      `id, confirmation_code, contact_name, check_in, check_out, status, agent_id,
       agreed_nightly_rate_btn, quoted_total_btn,
       agents(id, company_name),
       folios(id, status, folio_lines(total_btn, status, source_type))`,
    )
    .eq("property_id", propertyId)
    .gte("check_in", from)
    .in("status", ["checked_in", "checked_out"])
    .order("check_in", { ascending: true })
    .limit(1000);

  if (error) throw new Error(error.message);

  const stays: CollectStay[] = [];
  for (const row of data ?? []) {
    const agent = one(
      row.agents as { id?: string; company_name?: string | null } | { id?: string; company_name?: string | null }[] | null,
    );
    const folios =
      (row.folios as Array<{
        id: string;
        status?: string | null;
        folio_lines?: Line[] | null;
      }> | null) ?? [];
    let bill = 0;
    let paid = 0;
    let folioId: string | null = null;
    for (const folio of folios) {
      if (!folioId || folio.status === "open") folioId = folio.id;
      const money = moneyOf(folio.folio_lines ?? []);
      bill += money.bill;
      paid += money.paid;
    }
    const due = Math.round((bill - paid) * 100) / 100;
    if (due <= 0.5 && paid <= 0.5 && bill <= 0.5) continue;
    stays.push({
      bookingId: row.id as string,
      folioId,
      confirmation: (row.confirmation_code as string | null) ?? null,
      guest: (row.contact_name as string | null)?.trim() || "Guest",
      agentId: (row.agent_id as string | null) ?? agent?.id ?? null,
      agent: agent?.company_name?.trim() || "Direct",
      checkIn: String(row.check_in).slice(0, 10),
      checkOut: String(row.check_out).slice(0, 10),
      status: row.status as string,
      rate:
        row.agreed_nightly_rate_btn != null
          ? Number(row.agreed_nightly_rate_btn)
          : null,
      bill,
      paid,
      due: due > 0.5 ? due : 0,
    });
  }

  const groups = new Map<string, CollectAgent>();
  for (const stay of stays) {
    if (stay.due <= 0.5) continue;
    const key = stay.agentId ?? `direct:${stay.agent}`;
    const group = groups.get(key) ?? {
      key,
      agentId: stay.agentId,
      name: stay.agent,
      bill: 0,
      paid: 0,
      due: 0,
      stays: [],
    };
    group.bill += stay.bill;
    group.paid += stay.paid;
    group.due += stay.due;
    group.stays.push(stay);
    groups.set(key, group);
  }

  const agents = [...groups.values()].sort((a, b) => b.due - a.due);
  return {
    from,
    bill: agents.reduce((sum, agent) => sum + agent.bill, 0),
    paid: agents.reduce((sum, agent) => sum + agent.paid, 0),
    due: agents.reduce((sum, agent) => sum + agent.due, 0),
    agents,
  };
}
