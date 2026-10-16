import "server-only";

import { deriveAgentPayStatus } from "@/lib/erp/daily-desk";
import { netFolioBalance } from "@/lib/folio/balance";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type UnpaidBillParty = "guest" | "agent";

export type UnpaidBillStatusLabel =
  | "Still unpaid"
  | "On agent account"
  | "Part paid";

export type UnpaidBillRow = {
  kind: "folio" | "orphan_agent";
  folioId: string | null;
  bookingId: string | null;
  invoiceId: string | null;
  amountDue: number;
  collectFrom: string;
  collectParty: UnpaidBillParty;
  guestName: string;
  checkIn: string | null;
  checkOut: string | null;
  rooms: string;
  phone: string | null;
  email: string | null;
  statusLabel: UnpaidBillStatusLabel;
  agentId: string | null;
  confirmationCode: string | null;
  folioLabel: string | null;
};

export type UnpaidBillsFilter = "all" | "agents" | "guests";

export type UnpaidBillsResult = {
  rows: UnpaidBillRow[];
  orphanAgents: UnpaidBillRow[];
  totals: {
    totalDue: number;
    billCount: number;
    agentDue: number;
    agentCount: number;
    guestDue: number;
    guestCount: number;
  };
};

function isAgentBillMode(mode: string | null | undefined): boolean {
  const m = (mode ?? "").toLowerCase();
  return (
    m.includes("agent") ||
    m === "credit" ||
    m === "on_account" ||
    m === "bill_to_agent"
  );
}

function one<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

function roomLabels(
  assigns:
    | {
        room_units?: { label?: string | null } | { label?: string | null }[] | null;
      }[]
    | null
    | undefined,
): string {
  if (!assigns?.length) return "";
  return assigns
    .map((a) => {
      const u = one(a.room_units);
      return u?.label?.trim() || "";
    })
    .filter(Boolean)
    .join(", ");
}

function statusLabelFromPay(
  balanceBtn: number,
  paymentMode: string | null,
): UnpaidBillStatusLabel {
  const pay = deriveAgentPayStatus({ balanceBtn, paymentMode });
  if (pay === "agent_ar_open") return "On agent account";
  // Any open balance with payments already applied still shows as unpaid;
  // "Part paid" when absolute balance is less than a typical full stay heuristic
  // is unreliable without original total — use payment lines presence via mode only.
  if (pay === "unpaid") return "Still unpaid";
  return "Still unpaid";
}

function partPaidHint(
  lines: { status: string; total_btn: number; source_type?: string | null }[],
  balance: number,
): boolean {
  const payments = lines.filter((l) => {
    if (l.status !== "posted") return false;
    const src = (l.source_type ?? "").toLowerCase();
    return (
      (src === "payment" || src === "deposit") && Number(l.total_btn) < -0.009
    );
  });
  return payments.length > 0 && Math.abs(balance) > 0.5;
}

export async function loadUnpaidBills(
  admin: Admin,
  opts: { propertyId: string; filter?: UnpaidBillsFilter },
): Promise<UnpaidBillsResult> {
  const filter = opts.filter ?? "all";

  const { data: folios } = await admin
    .from("folios")
    .select(
      `id, label, status, booking_id, agent_id, folio_type,
       agents(id, company_name, contact_name, contact_phone, contact_email),
       bookings(
         id, confirmation_code, contact_name, contact_phone, contact_email,
         check_in, check_out, payment_mode, agent_id, status,
         agents(id, company_name, contact_name, contact_phone, contact_email),
         room_assignments(room_units(label))
       ),
       folio_lines(id, total_btn, status, reverses_line_id, source_type)`,
    )
    .eq("property_id", opts.propertyId)
    .eq("status", "open")
    .limit(800);

  const folioIds = (folios ?? []).map((f) => f.id as string);
  const invoiceByFolio = new Map<string, string>();
  if (folioIds.length > 0) {
    const { data: docs } = await admin
      .from("fiscal_documents")
      .select("id, folio_id, doc_kind, status, issued_at")
      .in("folio_id", folioIds)
      .eq("doc_kind", "invoice")
      .in("status", ["issued", "sent"])
      .order("issued_at", { ascending: false })
      .limit(2000);
    for (const d of docs ?? []) {
      const fid = d.folio_id as string;
      if (!invoiceByFolio.has(fid)) {
        invoiceByFolio.set(fid, d.id as string);
      }
    }
  }

  const rows: UnpaidBillRow[] = [];
  const agentIdsWithOpenFolio = new Set<string>();

  for (const f of folios ?? []) {
    const lines =
      (f.folio_lines as
        | {
            id: string;
            total_btn: number;
            status: string;
            reverses_line_id?: string | null;
            source_type?: string | null;
          }[]
        | null) ?? [];
    const balance = netFolioBalance(lines);
    if (balance <= 0.5) continue;

    const booking = one(
      f.bookings as
        | {
            id?: string;
            confirmation_code?: string | null;
            contact_name?: string | null;
            contact_phone?: string | null;
            contact_email?: string | null;
            check_in?: string | null;
            check_out?: string | null;
            payment_mode?: string | null;
            agent_id?: string | null;
            agents?:
              | {
                  id?: string;
                  company_name?: string | null;
                  contact_name?: string | null;
                  contact_phone?: string | null;
                  contact_email?: string | null;
                }
              | {
                  id?: string;
                  company_name?: string | null;
                  contact_name?: string | null;
                  contact_phone?: string | null;
                  contact_email?: string | null;
                }[]
              | null;
            room_assignments?:
              | {
                  room_units?:
                    | { label?: string | null }
                    | { label?: string | null }[]
                    | null;
                }[]
              | null;
          }
        | null
        | undefined,
    );

    const folioAgent = one(
      f.agents as
        | {
            id?: string;
            company_name?: string | null;
            contact_name?: string | null;
            contact_phone?: string | null;
            contact_email?: string | null;
          }
        | {
            id?: string;
            company_name?: string | null;
            contact_name?: string | null;
            contact_phone?: string | null;
            contact_email?: string | null;
          }[]
        | null,
    );
    const bookingAgent = one(booking?.agents ?? null);
    const agent = folioAgent ?? bookingAgent;

    const paymentMode = booking?.payment_mode ?? null;
    const onAgent =
      Boolean(agent?.id || f.agent_id || booking?.agent_id) &&
      (isAgentBillMode(paymentMode) ||
        (f.folio_type as string) === "master" ||
        (f.folio_type as string) === "walk_in" ||
        Boolean(f.agent_id));

    const guestName =
      booking?.contact_name?.trim() ||
      (f.label as string)?.trim() ||
      "Guest";

    const agentName =
      agent?.company_name?.trim() ||
      agent?.contact_name?.trim() ||
      null;

    const collectParty: UnpaidBillParty = onAgent ? "agent" : "guest";
    const collectFrom =
      collectParty === "agent"
        ? agentName || guestName
        : guestName;

    const phone =
      collectParty === "agent"
        ? agent?.contact_phone?.trim() ||
          booking?.contact_phone?.trim() ||
          null
        : booking?.contact_phone?.trim() || null;

    const email =
      collectParty === "agent"
        ? agent?.contact_email?.trim() ||
          booking?.contact_email?.trim() ||
          null
        : booking?.contact_email?.trim() || null;

    let label = statusLabelFromPay(balance, paymentMode);
    if (onAgent) label = "On agent account";
    else if (partPaidHint(lines, balance)) label = "Part paid";

    const agentId =
      (agent?.id as string | undefined) ??
      (f.agent_id as string | null) ??
      (booking?.agent_id as string | null) ??
      null;
    if (agentId) agentIdsWithOpenFolio.add(agentId);

    rows.push({
      kind: "folio",
      folioId: f.id as string,
      bookingId: (booking?.id as string | undefined) ?? (f.booking_id as string | null),
      invoiceId: invoiceByFolio.get(f.id as string) ?? null,
      amountDue: balance,
      collectFrom,
      collectParty,
      guestName,
      checkIn: booking?.check_in?.toString().slice(0, 10) ?? null,
      checkOut: booking?.check_out?.toString().slice(0, 10) ?? null,
      rooms: roomLabels(booking?.room_assignments),
      phone,
      email,
      statusLabel: label,
      agentId,
      confirmationCode: booking?.confirmation_code ?? null,
      folioLabel: (f.label as string | null) ?? null,
    });
  }

  rows.sort((a, b) => {
    if (b.amountDue !== a.amountDue) return b.amountDue - a.amountDue;
    const ao = a.checkOut ?? "9999";
    const bo = b.checkOut ?? "9999";
    return ao.localeCompare(bo);
  });

  // Orphan agent credit (no open folio row on this property)
  const { data: links } = await admin
    .from("agent_property_links")
    .select(
      `agent_id, credit_used, status,
       agents(id, company_name, contact_name, contact_phone, contact_email, credit_used, status)`,
    )
    .eq("property_id", opts.propertyId)
    .in("status", ["approved", "invited"])
    .limit(300);

  const orphanAgents: UnpaidBillRow[] = [];
  for (const link of links ?? []) {
    const agent = one(
      link.agents as
        | {
            id?: string;
            company_name?: string | null;
            contact_name?: string | null;
            contact_phone?: string | null;
            contact_email?: string | null;
            credit_used?: number | null;
            status?: string | null;
          }
        | {
            id?: string;
            company_name?: string | null;
            contact_name?: string | null;
            contact_phone?: string | null;
            contact_email?: string | null;
            credit_used?: number | null;
            status?: string | null;
          }[]
        | null,
    );
    const agentId = (agent?.id as string | undefined) ?? (link.agent_id as string);
    if (!agentId || agentIdsWithOpenFolio.has(agentId)) continue;
    const used = Math.max(
      Number(link.credit_used ?? 0),
      Number(agent?.credit_used ?? 0),
    );
    if (used <= 0.5) continue;
    const name =
      agent?.company_name?.trim() ||
      agent?.contact_name?.trim() ||
      "Travel agent";
    orphanAgents.push({
      kind: "orphan_agent",
      folioId: null,
      bookingId: null,
      invoiceId: null,
      amountDue: used,
      collectFrom: name,
      collectParty: "agent",
      guestName: "—",
      checkIn: null,
      checkOut: null,
      rooms: "",
      phone: agent?.contact_phone?.trim() || null,
      email: agent?.contact_email?.trim() || null,
      statusLabel: "On agent account",
      agentId,
      confirmationCode: null,
      folioLabel: null,
    });
  }
  orphanAgents.sort((a, b) => b.amountDue - a.amountDue);

  const filtered =
    filter === "agents"
      ? rows.filter((r) => r.collectParty === "agent")
      : filter === "guests"
        ? rows.filter((r) => r.collectParty === "guest")
        : rows;

  const orphanFiltered =
    filter === "guests" ? [] : orphanAgents;

  const allForTotals = [...filtered, ...orphanFiltered];
  const agentRows = allForTotals.filter((r) => r.collectParty === "agent");
  const guestRows = allForTotals.filter((r) => r.collectParty === "guest");

  return {
    rows: filtered,
    orphanAgents: orphanFiltered,
    totals: {
      totalDue: allForTotals.reduce((s, r) => s + r.amountDue, 0),
      billCount: allForTotals.length,
      agentDue: agentRows.reduce((s, r) => s + r.amountDue, 0),
      agentCount: agentRows.length,
      guestDue: guestRows.reduce((s, r) => s + r.amountDue, 0),
      guestCount: guestRows.length,
    },
  };
}
