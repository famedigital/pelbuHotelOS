/**
 * Partner Portal intelligence — allotment heat, MoU quote advisor, SLA pressure.
 */

import { nightsBetween } from "@hos-v2/domain";
import type { Stay } from "./front-office-store";
import type { Agent } from "./commercial-store";
import type { FiscalDoc } from "./extras-store";
import type { PartnerChangeRequest } from "./partner-portal-store";

/** Local Nu. format — avoids loading front-office-store (Vite env) in unit tests. */
function formatNu(n: number): string {
  return `Nu. ${Math.round(n).toLocaleString("en-BT")}`;
}

function masterOpenLines(stay: Stay) {
  return stay.folioLines.filter((l) => !l.voided && l.stream === "master");
}

function masterFolioBalance(stay: Stay): number {
  return masterOpenLines(stay).reduce((sum, l) => sum + l.totalAmount, 0);
}

function masterFolioTotals(stay: Stay) {
  const open = masterOpenLines(stay);
  const charges = open.filter((l) => l.kind !== "payment");
  const payments = open.filter((l) => l.kind === "payment");
  return {
    charged: charges.reduce((s, l) => s + l.totalAmount, 0),
    paid: Math.abs(payments.reduce((s, l) => s + l.totalAmount, 0)),
  };
}

export type PartnerPayFilter = "all" | "unpaid" | "paid";

/** Orthogonal to pay status — fiscal city-ledger docs vs working stay folios. */
export type PartnerLedgerSource = "all" | "fiscal" | "working";

/** Open AR / paid history threshold for working folios (Nu.). */
const WORKING_FOLIO_GATE_BTN = 0.5;

export type PartnerInvoiceRow = {
  id: string;
  kind: "PSBN" | "INV" | "FOLIO";
  docNo: string;
  guest: string;
  stayRef: string | null;
  /** Resolved stay for open / print fiscal paper. */
  stayId: string | null;
  amount: number;
  balance: number;
  status: "paid" | "unpaid" | "void";
  at: string;
  source: "fiscal" | "stay";
};

function resolveStayId(
  stays: Stay[],
  stayId: string | undefined,
  stayRef: string | undefined,
): string | null {
  if (stayId && stays.some((s) => s.id === stayId)) return stayId;
  if (!stayRef) return null;
  const hit = stays.find(
    (s) =>
      s.confirmationNo === stayRef ||
      s.confirmationNo.replace(/^PS-?/i, "") ===
        stayRef.replace(/^PS-?/i, ""),
  );
  return hit?.id ?? null;
}

/** Merge city-ledger fiscal docs + open stay folios for the partner Money tab. */
export function buildPartnerInvoices(input: {
  agencyToken: string;
  agencyLabel: string;
  fiscalDocs: FiscalDoc[];
  stays: Stay[];
}): PartnerInvoiceRow[] {
  const token = input.agencyToken.toLowerCase();
  const label = input.agencyLabel.toLowerCase();
  const fromFiscal: PartnerInvoiceRow[] = input.fiscalDocs
    .filter(
      (d) =>
        d.partyType === "agent" &&
        (d.party.toLowerCase().includes(token) ||
          d.party.toLowerCase().includes(label) ||
          label.includes(d.party.toLowerCase().split(" ")[0] ?? "")),
    )
    .map((d) => ({
      id: d.id,
      kind: d.kind,
      docNo: d.docNo,
      guest: d.guestName?.trim() || d.party,
      stayRef: d.stayRef ?? null,
      stayId: resolveStayId(input.stays, d.stayId, d.stayRef),
      amount: d.amount,
      balance: d.status === "paid" || d.status === "void" ? 0 : d.amount,
      status:
        d.status === "paid" ? "paid" : d.status === "void" ? "void" : "unpaid",
      at: d.at,
      source: "fiscal" as const,
    }));

  const coveredRefs = new Set(
    fromFiscal.map((r) => r.stayRef).filter((x): x is string => Boolean(x)),
  );

  const fromStays: PartnerInvoiceRow[] = [];
  for (const s of input.stays) {
    if (!["checked_in", "checked_out", "confirmed"].includes(s.status)) continue;
    if (coveredRefs.has(s.confirmationNo)) continue;

    const totals = masterFolioTotals(s);
    const bal = Math.max(0, masterFolioBalance(s));
    const paid =
      bal <= WORKING_FOLIO_GATE_BTN &&
      (s.status === "checked_out" || totals.paid > WORKING_FOLIO_GATE_BTN);

    // Hygiene: never invent AR from nightly estimates. Empty holds stay off the ledger.
    if (!paid && bal <= WORKING_FOLIO_GATE_BTN) continue;
    if (paid && totals.charged <= WORKING_FOLIO_GATE_BTN && totals.paid <= WORKING_FOLIO_GATE_BTN) {
      continue;
    }

    const amount =
      totals.charged > WORKING_FOLIO_GATE_BTN
        ? totals.charged
        : paid
          ? totals.paid
          : bal;

    fromStays.push({
      id: `stay-${s.id}`,
      kind: "FOLIO",
      docNo: `FOL-${s.confirmationNo.replace(/^PS-?/i, "")}`,
      guest: s.guestName,
      stayRef: s.confirmationNo,
      stayId: s.id,
      amount,
      balance: paid ? 0 : bal,
      status: paid ? "paid" : "unpaid",
      at: `${s.checkOut}T12:00:00.000Z`,
      source: "stay",
    });
  }

  return [...fromFiscal, ...fromStays].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

/** Excel-ready CSV (UTF-8 BOM) for partner city-ledger invoices. */
export function exportPartnerInvoicesExcel(
  agencyCode: string,
  rows: PartnerInvoiceRow[],
): { filename: string; rows: number } {
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `partner-invoices-${agencyCode}-${stamp}.csv`;
  const headers = [
    "DocNo",
    "Kind",
    "Guest",
    "StayRef",
    "Date",
    "Amount",
    "Balance",
    "Status",
    "Source",
  ];
  const body = rows.map((r) => [
    r.docNo,
    r.kind,
    r.guest,
    r.stayRef ?? "",
    r.at.slice(0, 10),
    String(r.amount),
    String(r.balance),
    r.status,
    r.source,
  ]);
  const esc = (c: string) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  const csv = [headers.map(esc).join(","), ...body.map((r) => r.map(esc).join(","))].join(
    "\n",
  );
  if (typeof document !== "undefined") {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return { filename, rows: rows.length };
}

export function filterPartnerInvoices(
  rows: PartnerInvoiceRow[],
  filter: PartnerPayFilter,
): PartnerInvoiceRow[] {
  if (filter === "paid") return rows.filter((r) => r.status === "paid");
  if (filter === "unpaid") return rows.filter((r) => r.status === "unpaid");
  return rows.filter((r) => r.status !== "void");
}

export function filterPartnerInvoicesBySource(
  rows: PartnerInvoiceRow[],
  source: PartnerLedgerSource,
): PartnerInvoiceRow[] {
  if (source === "fiscal") return rows.filter((r) => r.source === "fiscal");
  if (source === "working") return rows.filter((r) => r.source === "stay");
  return rows;
}

export type PartnerInsightTone = "emerald" | "brass" | "ruby" | "lapis";

export type PartnerInsight = {
  id: string;
  tone: PartnerInsightTone;
  title: string;
  detail: string;
  action?: { label: string; tab: string };
};

export type InventoryHeatRow = {
  typeCode: string;
  typeName: string;
  byDate: Array<{ date: string; sellable: number; heat: "open" | "tight" | "sold" }>;
  minSellable: number;
  tightNights: number;
};

export type SmartBookAdvice = {
  nights: number;
  sellableTonight: number;
  netPerNight: number;
  allInPerNight: number;
  allInStay: number;
  creditOk: boolean;
  creditHeadroom: number;
  recommendation: string;
  preferredType: string;
};

function heatOf(sellable: number): "open" | "tight" | "sold" {
  if (sellable <= 0) return "sold";
  if (sellable <= 1) return "tight";
  return "open";
}

export function buildInventoryHeat(
  inventory: Array<{
    type: { code: string; name: string };
    byDate: Array<{ date: string; sellable: number }>;
  }>,
): InventoryHeatRow[] {
  return inventory.map((row) => {
    const byDate = row.byDate.map((c) => ({
      ...c,
      heat: heatOf(c.sellable),
    }));
    const mins = byDate.map((c) => c.sellable);
    return {
      typeCode: row.type.code,
      typeName: row.type.name,
      byDate,
      minSellable: mins.length ? Math.min(...mins) : 0,
      tightNights: byDate.filter((c) => c.heat !== "open").length,
    };
  });
}

export function buildPartnerInsights(input: {
  agent: Agent;
  ownStays: Stay[];
  pendingChanges: PartnerChangeRequest[];
  inventory: Array<{
    type: { code: string; name: string };
    byDate: Array<{ date: string; sellable: number }>;
  }>;
  roomingCount: number;
  today: string;
}): PartnerInsight[] {
  const { agent, ownStays, pendingChanges, inventory, roomingCount, today } =
    input;
  const out: PartnerInsight[] = [];
  const util =
    agent.creditLimit > 0
      ? Math.round((agent.usedCredit / agent.creditLimit) * 100)
      : 0;
  const headroom = Math.max(0, agent.creditLimit - agent.usedCredit);

  if (util >= 85) {
    out.push({
      id: "credit-hot",
      tone: "ruby",
      title: "Credit pressure",
      detail: `${util}% of MoU limit used · ${formatNu(headroom)} headroom — upload a deposit before new blocks.`,
      action: { label: "Money", tab: "money" },
    });
  } else if (util >= 70) {
    out.push({
      id: "credit-warm",
      tone: "brass",
      title: "Credit warming",
      detail: `${util}% utilized · ${formatNu(headroom)} left on ${agent.code} MoU.`,
      action: { label: "Money", tab: "money" },
    });
  } else {
    out.push({
      id: "credit-ok",
      tone: "emerald",
      title: "Credit healthy",
      detail: `${formatNu(headroom)} available · terms ${agent.termsDays}d.`,
    });
  }

  const held = ownStays.filter((s) => s.status === "held");
  if (held.length > 0) {
    out.push({
      id: "holds",
      tone: "brass",
      title: `${held.length} hold${held.length === 1 ? "" : "s"} awaiting desk`,
      detail: held
        .slice(0, 2)
        .map((s) => `${s.guestName} · ${s.confirmationNo}`)
        .join(" · "),
      action: { label: "Bookings", tab: "bookings" },
    });
  }

  const breach = pendingChanges.filter((c) => {
    if (c.status !== "pending") return false;
    const ageH = (Date.now() - new Date(c.submittedAt).getTime()) / 3_600_000;
    return ageH >= 24;
  });
  if (breach.length > 0) {
    out.push({
      id: "sla",
      tone: "ruby",
      title: "SLA breach on change queue",
      detail: `${breach.length} request(s) pending >24h — chase desk on Agents dossier.`,
      action: { label: "Changes", tab: "changes" },
    });
  } else if (pendingChanges.some((c) => c.status === "pending")) {
    const n = pendingChanges.filter((c) => c.status === "pending").length;
    out.push({
      id: "sla-ok",
      tone: "lapis",
      title: `${n} change(s) in desk queue`,
      detail: "Within SLA · desk reviews from Operator 360.",
      action: { label: "Changes", tab: "changes" },
    });
  }

  const heat = buildInventoryHeat(inventory);
  const tight = heat
    .filter((h) => h.tightNights > 0)
    .sort((a, b) => b.tightNights - a.tightNights)[0];
  if (tight && tight.tightNights > 0) {
    out.push({
      id: "inv",
      tone: tight.minSellable === 0 ? "ruby" : "brass",
      title: `${tight.typeCode} allotment tightening`,
      detail: `${tight.tightNights} night(s) ≤1 sellable in next window · book early.`,
      action: { label: "Inventory", tab: "inventory" },
    });
  } else {
    const openTypes = heat.filter((h) => h.minSellable >= 2).length;
    out.push({
      id: "inv-ok",
      tone: "emerald",
      title: "Inventory open",
      detail: `${openTypes} type(s) with healthy sellable · ${today} forward.`,
      action: { label: "Book", tab: "book" },
    });
  }

  if (roomingCount > 0) {
    out.push({
      id: "rooming",
      tone: "lapis",
      title: "Rooming list ready",
      detail: `${roomingCount} guest row(s) — suggest rooms from mask, then submit to desk.`,
      action: { label: "Rooming", tab: "rooming" },
    });
  }

  if (agent.aging.d90 > 0) {
    out.push({
      id: "aging",
      tone: "ruby",
      title: "90d+ AR outstanding",
      detail: `${formatNu(agent.aging.d90)} past terms — prioritize deposit match.`,
      action: { label: "Money", tab: "money" },
    });
  }

  return out.slice(0, 5);
}

export function adviseSmartBook(input: {
  agent: Agent;
  bookIn: string;
  bookOut: string;
  bookType: string;
  inventory: Array<{
    type: { code: string; name: string };
    byDate: Array<{ date: string; sellable: number }>;
  }>;
  netPerNight: number;
  allInPerNight: number;
}): SmartBookAdvice {
  const nights = Math.max(0, nightsBetween(input.bookIn, input.bookOut));
  const typeRow = input.inventory.find((r) => r.type.code === input.bookType);
  const window = typeRow?.byDate.filter(
    (c) => c.date >= input.bookIn && c.date < input.bookOut,
  ) ?? [];
  const sellableTonight = window.length
    ? Math.min(...window.map((c) => c.sellable))
    : 0;
  const allInStay = input.allInPerNight * nights;
  const creditHeadroom = Math.max(
    0,
    input.agent.creditLimit - input.agent.usedCredit,
  );
  const creditOk = allInStay <= creditHeadroom;

  const ranked = input.inventory
    .map((r) => {
      const w = r.byDate.filter(
        (c) => c.date >= input.bookIn && c.date < input.bookOut,
      );
      const min = w.length ? Math.min(...w.map((c) => c.sellable)) : 0;
      return { code: r.type.code, min };
    })
    .sort((a, b) => b.min - a.min);
  const preferredType = ranked[0]?.code ?? input.bookType;

  let recommendation: string;
  if (nights < 1) {
    recommendation = "Pick a valid stay window.";
  } else if (sellableTonight <= 0) {
    recommendation = `${input.bookType} sold out for these nights — try ${preferredType}.`;
  } else if (!creditOk) {
    recommendation = `Stay all-in ${formatNu(allInStay)} exceeds credit headroom ${formatNu(creditHeadroom)} — upload deposit first.`;
  } else if (sellableTonight <= 1) {
    recommendation = `Only ${sellableTonight} ${input.bookType} left — place hold now.`;
  } else {
    recommendation = `MoU path clear · ${nights}n · ${formatNu(allInStay)} all-in.`;
  }

  return {
    nights,
    sellableTonight,
    netPerNight: input.netPerNight,
    allInPerNight: input.allInPerNight,
    allInStay,
    creditOk,
    creditHeadroom,
    recommendation,
    preferredType,
  };
}

export function exportPartnerBookingsCsv(
  agencyCode: string,
  stays: Stay[],
): { filename: string; rows: number } {
  const header = [
    "Confirmation",
    "Guest",
    "Status",
    "CheckIn",
    "CheckOut",
    "Nights",
    "Room",
    "Type",
    "Meal",
    "NightlyNet",
    "Agency",
  ];
  const lines = stays.map((s) =>
    [
      s.confirmationNo,
      s.guestName,
      s.status,
      s.checkIn,
      s.checkOut,
      String(nightsBetween(s.checkIn, s.checkOut)),
      s.roomNumber ?? "TBA",
      s.typeCode,
      s.mealPlan,
      String(s.nightlyNet),
      s.agencyName ?? "",
    ]
      .map((c) => {
        const v = String(c);
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      })
      .join(","),
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const filename = `partner-bookings-${agencyCode}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { filename, rows: stays.length };
}
