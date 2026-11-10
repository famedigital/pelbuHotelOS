import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadHotelStatement } from "@/lib/finance/hotel-statement";
import {
  buildCanonicalNumbers,
  buildRrcoStatements,
  roundBtn,
  rrcoTreatmentForBank,
  type CanonSource,
  type RrcoStatements,
  type RrcoTreatment,
} from "@/lib/finance/statement-model";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type RrcoLine = {
  id: string;
  sourceKind: string;
  sourceId: string | null;
  date: string;
  description: string;
  amount: number;
  side: "credit" | "debit";
  category: string;
  treatment: RrcoTreatment;
  reason: string;
  originalRef: string;
  party: string;
};

export type RrcoDocRow = {
  docNo: string;
  docKind: "invoice" | "bill";
  date: string;
  description: string;
  category: string;
  amount: number;
  originalRef: string;
  sourceKind: string;
};

export type RrcoView = {
  filingId: string;
  year: number;
  cashInHand: number;
  tds: number;
  capital: number;
  preparedBy: string;
  status: string;
  lines: RrcoLine[];
  docs: RrcoDocRow[];
  files: { id: string; label: string; kind: string; notes: string; storagePath: string | null }[];
  statements: RrcoStatements;
  comps: RrcoLine[];
  reasons: RrcoLine[];
};

function num(v: unknown): number {
  return roundBtn(Number(v ?? 0));
}

export async function ensureFiling(
  admin: Admin,
  propertyId: string,
  year: number,
): Promise<string> {
  const { data: existing } = await admin
    .from("rrco_filings")
    .select("id")
    .eq("property_id", propertyId)
    .eq("tax_year", year)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data, error } = await admin
    .from("rrco_filings")
    .insert({ property_id: propertyId, tax_year: year })
    .select("id")
    .single();
  if (error || !data) {
    console.error("rrco filing insert failed", error);
    throw new Error("Could not open the RRCO year.");
  }
  return data.id as string;
}

export async function loadRrcoView(
  admin: Admin,
  propertyId: string,
  year: number,
): Promise<RrcoView> {
  const filingId = await ensureFiling(admin, propertyId, year);
  const [filingRes, linesRes, docsRes, filesRes, hotel] = await Promise.all([
    admin.from("rrco_filings").select("*").eq("id", filingId).single(),
    admin
      .from("rrco_lines")
      .select("*")
      .eq("filing_id", filingId)
      .order("txn_date", { ascending: true })
      .limit(5000),
    admin
      .from("rrco_canonical_docs")
      .select("*")
      .eq("filing_id", filingId)
      .order("doc_date", { ascending: true })
      .limit(5000),
    admin
      .from("rrco_assessment_files")
      .select("id, label, kind, notes, storage_path")
      .eq("filing_id", filingId)
      .order("created_at", { ascending: false }),
    loadHotelStatement(admin, propertyId, `${year}-01-01`, `${year}-12-31`),
  ]);
  if (filingRes.error || !filingRes.data) {
    throw new Error("Could not load the RRCO filing.");
  }
  const filing = filingRes.data;
  const lines: RrcoLine[] = (linesRes.data ?? []).map((row) => ({
    id: row.id as string,
    sourceKind: row.source_kind as string,
    sourceId: (row.source_id as string | null) ?? null,
    date: String(row.txn_date).slice(0, 10),
    description: row.description as string,
    amount: num(row.amount_btn),
    side: row.side as "credit" | "debit",
    category: row.category as string,
    treatment: row.treatment as RrcoTreatment,
    reason: (row.reason as string | null) ?? "",
    originalRef: (row.original_ref as string | null) ?? "",
    party: (row.party as string | null) ?? "",
  }));
  const docs: RrcoDocRow[] = (docsRes.data ?? []).map((row) => ({
    docNo: row.doc_no as string,
    docKind: row.doc_kind as "invoice" | "bill",
    date: String(row.doc_date).slice(0, 10),
    description: row.description as string,
    category: row.category as string,
    amount: num(row.amount_btn),
    originalRef: (row.original_ref as string | null) ?? "",
    sourceKind: row.source_kind as string,
  }));

  const loanNet = roundBtn(
    lines
      .filter((l) => l.treatment === "loan")
      .reduce((s, l) => s + (l.side === "credit" ? l.amount : -l.amount), 0),
  );
  const deposits = roundBtn(
    lines.filter((l) => l.treatment === "deposit").reduce((s, l) => s + l.amount, 0),
  );
  const ownerFunds = roundBtn(
    lines
      .filter((l) => l.treatment === "owner_transfer" && l.side === "credit")
      .reduce((s, l) => s + l.amount, 0),
  );
  const operating = hotel.perAccount.filter((a) =>
    hotel.accounts.some((acc) => acc.id === a.id && acc.role === "operating"),
  );
  const bank = roundBtn(
    operating.reduce((s, a) => s + a.closing, 0) ||
      hotel.perAccount.reduce((s, a) => s + a.closing, 0),
  );

  const statements = buildRrcoStatements({
    docs: docs.map((d) => ({ docKind: d.docKind, category: d.category, amount: d.amount })),
    cashInHand: num(filing.cash_in_hand_btn),
    bank,
    agentAr: hotel.cityLedgerTotal,
    loans: loanNet,
    deposits,
    ownerFunds,
    capital: num(filing.capital_btn),
  });

  return {
    filingId,
    year,
    cashInHand: num(filing.cash_in_hand_btn),
    tds: num(filing.tds_btn),
    capital: num(filing.capital_btn),
    preparedBy: (filing.prepared_by as string | null) ?? "",
    status: filing.status as string,
    lines,
    docs,
    files: (filesRes.data ?? []).map((f) => ({
      id: f.id as string,
      label: f.label as string,
      kind: f.kind as string,
      notes: (f.notes as string | null) ?? "",
      storagePath: (f.storage_path as string | null) ?? null,
    })),
    statements,
    comps: lines.filter((l) => l.treatment === "comp"),
    reasons: lines.filter((l) => l.treatment !== "include_income" && l.treatment !== "include_expense" && l.treatment !== "salary_sheet"),
  };
}

type InsertLine = {
  filing_id: string;
  property_id: string;
  source_kind: string;
  source_id: string | null;
  txn_date: string;
  description: string;
  amount_btn: number;
  side: "credit" | "debit";
  category: string;
  treatment: RrcoTreatment;
  original_ref: string | null;
  party: string | null;
  reason: string | null;
};

export async function pullBooksIntoFiling(
  admin: Admin,
  propertyId: string,
  year: number,
): Promise<number> {
  const filingId = await ensureFiling(admin, propertyId, year);
  const { data: filing } = await admin
    .from("rrco_filings")
    .select("status")
    .eq("id", filingId)
    .single();
  if (filing?.status === "locked") throw new Error("This RRCO year is locked.");

  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const hotel = await loadHotelStatement(admin, propertyId, from, to);

  const { data: folios } = await admin
    .from("folio_lines")
    .select("id, description, total_btn, created_at, source_type, status, folios!inner(property_id)")
    .eq("folios.property_id", propertyId)
    .eq("status", "posted")
    .in("source_type", ["room", "order", "service", "guest_service"])
    .gte("created_at", `${from}T00:00:00`)
    .lte("created_at", `${to}T23:59:59`)
    .limit(5000);

  const { data: expenses } = await admin
    .from("expenses")
    .select("id, description, amount_btn, expense_date, payment_method, reference, category")
    .eq("property_id", propertyId)
    .gte("expense_date", from)
    .lte("expense_date", to)
    .eq("payment_method", "cash")
    .limit(2000);

  const { data: payroll } = await admin
    .from("payroll_runs")
    .select("id, net_total_btn, status, payroll_periods!inner(label, period_start, period_end)")
    .eq("property_id", propertyId)
    .in("status", ["approved", "finalized"])
    .limit(50);

  const lines: InsertLine[] = [];

  for (const row of folios ?? []) {
    const amount = num(row.total_btn);
    if (amount <= 0) continue;
    lines.push({
      filing_id: filingId,
      property_id: propertyId,
      source_kind: "folio",
      source_id: row.id as string,
      txn_date: String(row.created_at).slice(0, 10),
      description: String(row.description ?? "Folio charge"),
      amount_btn: amount,
      side: "credit",
      category: "Room and guest receipts",
      treatment: "include_income",
      original_ref: row.id as string,
      party: null,
      reason: null,
    });
  }

  const posCashKeys = new Set(
    hotel.walkInPos
      .filter((s) => !s.onFolio && s.method === "cash" && s.party !== "Cash desk")
      .map((s) => `${s.date}|${s.amount}`),
  );
  for (const sale of hotel.walkInPos) {
    if (sale.onFolio) continue;
    const cashDesk = sale.method === "cash" && sale.party === "Cash desk";
    if (cashDesk && posCashKeys.has(`${sale.date}|${sale.amount}`)) continue;
    lines.push({
      filing_id: filingId,
      property_id: propertyId,
      source_kind: cashDesk ? "cash_payment" : "pos",
      source_id: sale.sourceId,
      txn_date: sale.date,
      description: cashDesk ? `Cash ${sale.ref}` : `${sale.party} · ${sale.method}`,
      amount_btn: sale.amount,
      side: "credit",
      category: "Room and guest receipts",
      treatment: "include_income",
      original_ref: sale.ref,
      party: sale.party,
      reason: null,
    });
  }

  for (const comp of hotel.comps) {
    lines.push({
      filing_id: filingId,
      property_id: propertyId,
      source_kind: "comp",
      source_id: comp.sourceId,
      txn_date: comp.date || from,
      description: `${comp.party} · ${comp.method}`,
      amount_btn: comp.amount,
      side: "credit",
      category: "Complimentary",
      treatment: "comp",
      original_ref: comp.sourceId,
      party: comp.party,
      reason: "Complimentary, staff meal, owner meal, or no charge",
    });
  }

  for (const row of hotel.ledger) {
    if (!row.saved) continue;
    const mapped = rrcoTreatmentForBank(row.treatment);
    if (!mapped) continue;
    const amount = row.income || row.expense;
    if (amount <= 0) continue;
    lines.push({
      filing_id: filingId,
      property_id: propertyId,
      source_kind: "bank",
      source_id: row.id,
      txn_date: row.date,
      description: row.detail,
      amount_btn: amount,
      side: row.income > 0 ? "credit" : "debit",
      category: row.category,
      treatment: mapped,
      original_ref: row.id,
      party: row.party || null,
      reason: mapped === "agent_settlement" ? "Clears city ledger" : null,
    });
  }

  for (const exp of expenses ?? []) {
    lines.push({
      filing_id: filingId,
      property_id: propertyId,
      source_kind: "cash_expense",
      source_id: exp.id as string,
      txn_date: String(exp.expense_date).slice(0, 10),
      description: String(exp.description),
      amount_btn: num(exp.amount_btn),
      side: "debit",
      category: "Others",
      treatment: "include_expense",
      original_ref: (exp.reference as string | null) ?? (exp.id as string),
      party: null,
      reason: null,
    });
  }

  for (const run of payroll ?? []) {
    const period = run.payroll_periods as
      | { label: string; period_start: string; period_end: string }
      | { label: string; period_start: string; period_end: string }[];
    const p = Array.isArray(period) ? period[0] : period;
    if (!p) continue;
    const start = String(p.period_start).slice(0, 10);
    const end = String(p.period_end).slice(0, 10);
    if (end < from || start > to) continue;
    lines.push({
      filing_id: filingId,
      property_id: propertyId,
      source_kind: "salary_sheet",
      source_id: run.id as string,
      txn_date: end,
      description: `Salary ${p.label || end}`,
      amount_btn: num(run.net_total_btn),
      side: "debit",
      category: "Salary",
      treatment: "salary_sheet",
      original_ref: p.label || (run.id as string),
      party: null,
      reason: "Payroll sheet, not the bank name payments",
    });
  }

  await admin
    .from("rrco_lines")
    .delete()
    .eq("filing_id", filingId)
    .neq("source_kind", "manual");

  const sourced = lines.filter((l) => l.source_id);
  const unsourced = lines.filter((l) => !l.source_id);
  for (let i = 0; i < sourced.length; i += 400) {
    const chunk = sourced.slice(i, i + 400);
    const { error } = await admin.from("rrco_lines").insert(chunk);
    if (error) {
      console.error("rrco line insert failed", error);
      throw new Error("Could not pull books into the RRCO year.");
    }
  }
  if (unsourced.length) {
    const { error } = await admin.from("rrco_lines").insert(unsourced);
    if (error) {
      console.error("rrco comp insert failed", error);
      throw new Error("Could not pull complimentary lines.");
    }
  }
  return lines.length;
}

export async function rebuildCanonical(
  admin: Admin,
  propertyId: string,
  year: number,
): Promise<number> {
  const filingId = await ensureFiling(admin, propertyId, year);
  const { data: filing } = await admin
    .from("rrco_filings")
    .select("status")
    .eq("id", filingId)
    .single();
  if (filing?.status === "locked") throw new Error("This RRCO year is locked.");

  const { data, error } = await admin
    .from("rrco_lines")
    .select("*")
    .eq("filing_id", filingId)
    .in("treatment", ["include_income", "include_expense", "salary_sheet"]);
  if (error) throw new Error("Could not read RRCO lines.");

  const sources: CanonSource[] = (data ?? []).map((row) => ({
    sourceKind: row.source_kind as string,
    sourceId: (row.source_id as string | null) ?? (row.id as string),
    date: String(row.txn_date).slice(0, 10),
    description: row.description as string,
    amount: num(row.amount_btn),
    category: row.category as string,
    originalRef: (row.original_ref as string | null) ?? "",
    docKind:
      row.treatment === "include_income" ? ("invoice" as const) : ("bill" as const),
  }));
  const docs = buildCanonicalNumbers(year, sources);
  await admin.from("rrco_canonical_docs").delete().eq("filing_id", filingId);
  if (!docs.length) return 0;
  const rows = docs.map((d) => ({
    filing_id: filingId,
    property_id: propertyId,
    doc_kind: d.docKind,
    seq: d.seq,
    doc_no: d.docNo,
    doc_date: d.date,
    source_kind: d.sourceKind,
    source_id: d.sourceId,
    original_ref: d.originalRef,
    description: d.description,
    category: d.category,
    amount_btn: d.amount,
  }));
  for (let i = 0; i < rows.length; i += 400) {
    const { error: insErr } = await admin
      .from("rrco_canonical_docs")
      .insert(rows.slice(i, i + 400));
    if (insErr) {
      console.error("canonical insert failed", insErr);
      throw new Error("Could not write canonical documents.");
    }
  }
  return docs.length;
}
