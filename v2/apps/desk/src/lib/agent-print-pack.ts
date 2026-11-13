/**
 * Agent Print Pack — shared pure builder for desk `/agents` and partner `/partner`.
 * Type-only imports from stores so unit tests do not load Vite/Zustand.
 */
import type { Agent, MealPlan, RateCell, Season } from "./commercial-store";
import type { FiscalDoc } from "./extras-store";
import type { FolioLine, Stay } from "./front-office-store";

export type AgentPrintPackSectionKey =
  | "master"
  | "unpaidInvoices"
  | "paidInvoices"
  | "summary"
  | "payments"
  | "aging"
  | "mou";

export type AgentPrintPackSections = Record<AgentPrintPackSectionKey, boolean>;

export type AgentPrintPackPreset =
  | "clientPack"
  | "fullArchive"
  | "unpaidOnly"
  | "clear";

export const AGENT_PRINT_PACK_SECTION_META: {
  key: AgentPrintPackSectionKey;
  label: string;
  hint: string;
}[] = [
  { key: "master", label: "Master statement", hint: "SOA cover + invoice lines" },
  { key: "unpaidInvoices", label: "Unpaid invoices", hint: "One A4 page per open bill" },
  { key: "paidInvoices", label: "Paid invoices", hint: "One A4 page per settled bill" },
  { key: "summary", label: "Summary reports", hint: "Nights · meal · room · paid/unpaid" },
  { key: "payments", label: "Payments ledger", hint: "mBoB / bank / folio receipts" },
  { key: "aging", label: "Aging waterfall", hint: "Current · 30 · 60 · 90+" },
  { key: "mou", label: "MoU & credit", hint: "Rate snapshot · limit · headroom" },
];

const ALL_ON: AgentPrintPackSections = {
  master: true,
  unpaidInvoices: true,
  paidInvoices: true,
  summary: true,
  payments: true,
  aging: true,
  mou: true,
};

const ALL_OFF: AgentPrintPackSections = {
  master: false,
  unpaidInvoices: false,
  paidInvoices: false,
  summary: false,
  payments: false,
  aging: false,
  mou: false,
};

export function sectionsForPreset(
  preset: AgentPrintPackPreset,
): AgentPrintPackSections {
  if (preset === "fullArchive") return { ...ALL_ON };
  if (preset === "clear") return { ...ALL_OFF };
  if (preset === "unpaidOnly") {
    return { ...ALL_OFF, unpaidInvoices: true };
  }
  return {
    master: true,
    unpaidInvoices: true,
    paidInvoices: false,
    summary: true,
    payments: true,
    aging: true,
    mou: true,
  };
}

export function anySectionOn(sections: AgentPrintPackSections): boolean {
  return (Object.keys(sections) as AgentPrintPackSectionKey[]).some(
    (k) => sections[k],
  );
}

export type AgentStatementLine = {
  id: string;
  invDate: string;
  folioNo: string;
  guestRef: string;
  roomPlan: string;
  stayDates: string;
  nights: number;
  amount: number;
  paid: number;
  balance: number;
};

export type AgentStatementDoc = {
  agentId: string;
  agentName: string;
  agentCode: string;
  agentContact: string;
  from: string;
  to: string;
  statementDate: string;
  lines: AgentStatementLine[];
  totalAmount: number;
  totalPaid: number;
  totalDue: number;
};

export type AgentPrintInvoiceLine = {
  id: string;
  kind: FolioLine["kind"] | "fiscal";
  description: string;
  netAmount: number;
  scAmount: number;
  bstAmount: number;
  totalAmount: number;
};

export type AgentPrintInvoicePage = {
  id: string;
  status: "paid" | "unpaid";
  invDate: string;
  folioNo: string;
  taxInvoiceNo: string | null;
  guestRef: string;
  roomPlan: string;
  roomNumber: string | null;
  stayDates: string;
  checkIn: string | null;
  checkOut: string | null;
  nights: number;
  confirmationNo: string | null;
  stayId: string | null;
  lines: AgentPrintInvoiceLine[];
  net: number;
  sc: number;
  bst: number;
  amount: number;
  paid: number;
  balance: number;
};

export type AgentPrintPaymentRow = {
  id: string;
  at: string;
  ref: string;
  guestRef: string;
  method: string;
  amount: number;
};

export type AgentPrintMonthBucket = {
  key: string;
  label: string;
  nights: number;
  amount: number;
  stays: number;
};

export type AgentPrintMixRow = {
  key: string;
  label: string;
  nights: number;
  amount: number;
  count: number;
};

export type AgentPrintSummary = {
  totalNights: number;
  stayCount: number;
  grossAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  byMonth: AgentPrintMonthBucket[];
  byMealPlan: AgentPrintMixRow[];
  byRoomType: AgentPrintMixRow[];
};

export type AgentPrintMouRateRow = {
  typeCode: string;
  typeLabel: string;
  mealPlan: MealPlan;
  singleNet: number;
  doubleNet: number;
};

export type AgentPrintMouBlock = {
  rateCardCode: string;
  season: Season;
  creditLimit: number;
  usedCredit: number;
  headroom: number;
  termsDays: number;
  rates: AgentPrintMouRateRow[];
};

export type AgentPrintAgingBlock = {
  current: number;
  d30: number;
  d60: number;
  d90: number;
  total: number;
};

export type AgentPrintBankBlock = {
  accountName: string;
  accountNo: string;
  mbobMerchantId: string;
  note: string;
};

export type AgentPrintPackDoc = {
  agentId: string;
  agentName: string;
  agentCode: string;
  agentContact: string;
  from: string;
  to: string;
  statementDate: string;
  sections: AgentPrintPackSections;
  master: AgentStatementDoc | null;
  unpaidInvoices: AgentPrintInvoicePage[];
  paidInvoices: AgentPrintInvoicePage[];
  summary: AgentPrintSummary | null;
  payments: AgentPrintPaymentRow[];
  aging: AgentPrintAgingBlock | null;
  mou: AgentPrintMouBlock | null;
  bank: AgentPrintBankBlock | null;
  counts: {
    soaLines: number;
    unpaid: number;
    paid: number;
    payments: number;
    nights: number;
  };
  hasPrintableContent: boolean;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function agencyToken(name: string): string {
  return name.split(" ")[0]?.toLowerCase() ?? name.toLowerCase();
}

function stayMatchesAgent(stay: Stay, agent: Agent): boolean {
  if (stay.source !== "agent" && !stay.agencyName) return false;
  const token = agencyToken(agent.name);
  const hay = (stay.agencyName ?? "").toLowerCase();
  return (
    hay.includes(token) ||
    token.includes(hay.split(" ")[0] ?? "") ||
    (stay.agencyName?.includes(agent.code) ?? false)
  );
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn.slice(0, 10)}T12:00:00`);
  const b = Date.parse(`${checkOut.slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 1;
  return Math.round((b - a) / 86_400_000);
}

function folioTotals(stay: Stay) {
  const open = stay.folioLines.filter((l) => !l.voided && l.stream === "master");
  const charges = open.filter((l) => l.kind !== "payment");
  const payments = open.filter((l) => l.kind === "payment");
  const charged = charges.reduce((s, l) => s + l.totalAmount, 0);
  const paid = Math.abs(payments.reduce((s, l) => s + l.totalAmount, 0));
  const balance = open.reduce((s, l) => s + l.totalAmount, 0);
  return {
    net: charges.reduce((s, l) => s + l.netAmount, 0),
    sc: charges.reduce((s, l) => s + l.scAmount, 0),
    bst: charges.reduce((s, l) => s + l.bstAmount, 0),
    charged,
    paid,
    balance,
  };
}

function fmtStayRange(checkIn: string, checkOut: string): string {
  const a = checkIn.slice(0, 10).split("-").reverse().join("/");
  const b = checkOut.slice(0, 10).split("-").reverse().join("/");
  return `${a} - ${b}`;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  if (!y || !m) return key;
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function lineIsPaid(line: AgentStatementLine): boolean {
  return line.balance <= 0.5;
}

function buildStatementLines(input: {
  agent: Agent;
  stays: Stay[];
  fiscalDocs: FiscalDoc[];
  from: string;
  to: string;
}): AgentStatementLine[] {
  const { agent, from, to } = input;
  const lines: AgentStatementLine[] = [];

  for (const s of input.stays.filter((x) => stayMatchesAgent(x, agent))) {
    if (["cancelled", "no_show"].includes(s.status)) continue;
    const anchor = (s.checkOut || s.checkIn).slice(0, 10);
    if (anchor < from || anchor > to) continue;
    const t = folioTotals(s);
    if (t.charged <= 0) continue;
    const nts = Math.max(1, nightsBetween(s.checkIn, s.checkOut));
    lines.push({
      id: `stay-${s.id}`,
      invDate: anchor,
      folioNo: s.folioNo || s.taxInvoiceNo || s.confirmationNo,
      guestRef: s.guestName || s.confirmationNo,
      roomPlan: `${s.typeCode} ${s.mealPlan}`,
      stayDates: fmtStayRange(s.checkIn, s.checkOut),
      nights: nts,
      amount: t.charged,
      paid: t.paid,
      balance: Math.max(0, t.balance),
    });
  }

  const token = agencyToken(agent.name);
  for (const d of input.fiscalDocs) {
    if (d.partyType !== "agent" || d.status === "void") continue;
    const hit =
      d.party.toLowerCase().includes(token) ||
      agent.name.toLowerCase().includes(d.party.toLowerCase().split(" ")[0] ?? "");
    if (!hit) continue;
    const day = d.at.slice(0, 10);
    if (day < from || day > to) continue;
    if (lines.some((l) => l.folioNo === d.docNo)) continue;
    lines.push({
      id: `doc-${d.id}`,
      invDate: day,
      folioNo: d.docNo,
      guestRef: d.guestName?.trim() || d.party,
      roomPlan: d.kind,
      stayDates: "—",
      nights: 0,
      amount: d.amount,
      paid: d.status === "paid" ? d.amount : 0,
      balance: d.status === "paid" ? 0 : d.amount,
    });
  }

  lines.sort(
    (a, b) => a.invDate.localeCompare(b.invDate) || a.folioNo.localeCompare(b.folioNo),
  );
  return lines;
}

/** First invoice/stay anchor → today (or statementDate). */
export function defaultPeriodForAgent(input: {
  agent: Agent;
  stays: Stay[];
  fiscalDocs: FiscalDoc[];
  statementDate?: string;
}): { from: string; to: string } {
  const to = input.statementDate ?? todayIso();
  const dates: string[] = [];
  for (const s of input.stays.filter((x) => stayMatchesAgent(x, input.agent))) {
    if (["cancelled", "no_show"].includes(s.status)) continue;
    dates.push(s.checkIn.slice(0, 10));
    dates.push((s.checkOut || s.checkIn).slice(0, 10));
  }
  const token = agencyToken(input.agent.name);
  for (const d of input.fiscalDocs) {
    if (d.partyType !== "agent" || d.status === "void") continue;
    const hit =
      d.party.toLowerCase().includes(token) ||
      input.agent.name
        .toLowerCase()
        .includes(d.party.toLowerCase().split(" ")[0] ?? "");
    if (!hit) continue;
    dates.push(d.at.slice(0, 10));
  }
  dates.sort();
  const from = dates[0] ?? to;
  return { from, to };
}

function chargeLinesForStay(stay: Stay): FolioLine[] {
  return stay.folioLines.filter(
    (l) => !l.voided && l.kind !== "payment" && l.stream === "master",
  );
}

function paymentLinesForStay(stay: Stay): FolioLine[] {
  return stay.folioLines.filter(
    (l) => !l.voided && l.kind === "payment" && l.stream === "master",
  );
}

function invoiceFromStay(
  stay: Stay,
  status: "paid" | "unpaid",
): AgentPrintInvoicePage {
  const t = folioTotals(stay);
  const charged =
    t.charged > 0
      ? t.charged
      : Math.round(nightsBetween(stay.checkIn, stay.checkOut) * stay.nightlyNet);
  const charges = chargeLinesForStay(stay);
  const lines: AgentPrintInvoiceLine[] =
    charges.length > 0
      ? charges.map((l) => ({
          id: l.id,
          kind: l.kind,
          description: l.description?.trim() || l.kind,
          netAmount: l.netAmount,
          scAmount: l.scAmount,
          bstAmount: l.bstAmount,
          totalAmount: l.totalAmount,
        }))
      : [
          {
            id: `synth-${stay.id}`,
            kind: "room",
            description: `${stay.typeCode} · ${stay.mealPlan} · ${nightsBetween(stay.checkIn, stay.checkOut)}n`,
            netAmount: charged,
            scAmount: 0,
            bstAmount: 0,
            totalAmount: charged,
          },
        ];
  const anchor = (stay.checkOut || stay.checkIn).slice(0, 10);
  return {
    id: `stay-${stay.id}`,
    status,
    invDate: anchor,
    folioNo: stay.folioNo || stay.taxInvoiceNo || stay.confirmationNo,
    taxInvoiceNo: stay.taxInvoiceNo ?? null,
    guestRef: stay.guestName || stay.confirmationNo,
    roomPlan: `${stay.typeCode} ${stay.mealPlan}`,
    roomNumber: stay.roomNumber,
    stayDates: fmtStayRange(stay.checkIn, stay.checkOut),
    checkIn: stay.checkIn.slice(0, 10),
    checkOut: stay.checkOut.slice(0, 10),
    nights: Math.max(1, nightsBetween(stay.checkIn, stay.checkOut)),
    confirmationNo: stay.confirmationNo,
    stayId: stay.id,
    lines,
    net: t.net || charged,
    sc: t.sc,
    bst: t.bst,
    amount: charged,
    paid: t.paid,
    balance: status === "paid" ? 0 : Math.max(0, t.balance),
  };
}

function invoiceFromStatementLine(
  line: AgentStatementLine,
  status: "paid" | "unpaid",
): AgentPrintInvoicePage {
  return {
    id: line.id,
    status,
    invDate: line.invDate,
    folioNo: line.folioNo,
    taxInvoiceNo: null,
    guestRef: line.guestRef,
    roomPlan: line.roomPlan,
    roomNumber: null,
    stayDates: line.stayDates,
    checkIn: null,
    checkOut: null,
    nights: line.nights,
    confirmationNo: null,
    stayId: line.id.startsWith("stay-") ? line.id.slice(5) : null,
    lines: [
      {
        id: `${line.id}-line`,
        kind: "fiscal",
        description: `${line.guestRef} · ${line.roomPlan}`,
        netAmount: line.amount,
        scAmount: 0,
        bstAmount: 0,
        totalAmount: line.amount,
      },
    ],
    net: line.amount,
    sc: 0,
    bst: 0,
    amount: line.amount,
    paid: line.paid,
    balance: status === "paid" ? 0 : line.balance,
  };
}

function buildSummaryFromLines(
  lines: AgentStatementLine[],
  staysById: Map<string, Stay>,
): AgentPrintSummary {
  const byMonth = new Map<string, AgentPrintMonthBucket>();
  const byMeal = new Map<string, AgentPrintMixRow>();
  const byRoom = new Map<string, AgentPrintMixRow>();
  let totalNights = 0;
  let grossAmount = 0;
  let paidAmount = 0;
  let unpaidAmount = 0;

  for (const line of lines) {
    grossAmount += line.amount;
    paidAmount += line.paid;
    unpaidAmount += line.balance;
    totalNights += line.nights;
    const mk = monthKey(line.invDate);
    const month = byMonth.get(mk) ?? {
      key: mk,
      label: monthLabel(mk),
      nights: 0,
      amount: 0,
      stays: 0,
    };
    month.nights += line.nights;
    month.amount += line.amount;
    month.stays += 1;
    byMonth.set(mk, month);

    const stay = line.id.startsWith("stay-")
      ? staysById.get(line.id.slice(5))
      : undefined;
    const meal = stay?.mealPlan ?? "—";
    const mealRow = byMeal.get(meal) ?? {
      key: meal,
      label: meal,
      nights: 0,
      amount: 0,
      count: 0,
    };
    mealRow.nights += line.nights;
    mealRow.amount += line.amount;
    mealRow.count += 1;
    byMeal.set(meal, mealRow);

    const room = stay?.typeCode ?? line.roomPlan.split(" ")[0] ?? "—";
    const roomRow = byRoom.get(room) ?? {
      key: room,
      label: room,
      nights: 0,
      amount: 0,
      count: 0,
    };
    roomRow.nights += line.nights;
    roomRow.amount += line.amount;
    roomRow.count += 1;
    byRoom.set(room, roomRow);
  }

  return {
    totalNights,
    stayCount: lines.length,
    grossAmount,
    paidAmount,
    unpaidAmount,
    byMonth: [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key)),
    byMealPlan: [...byMeal.values()].sort((a, b) => b.amount - a.amount),
    byRoomType: [...byRoom.values()].sort((a, b) => b.amount - a.amount),
  };
}

function buildPayments(input: {
  agent: Agent;
  stays: Stay[];
  fiscalDocs: FiscalDoc[];
  from: string;
  to: string;
}): AgentPrintPaymentRow[] {
  const rows: AgentPrintPaymentRow[] = [];
  for (const s of input.stays.filter((x) => stayMatchesAgent(x, input.agent))) {
    if (["cancelled", "no_show"].includes(s.status)) continue;
    for (const l of paymentLinesForStay(s)) {
      const day = (l.postedAt || s.checkOut || s.checkIn).slice(0, 10);
      if (day < input.from || day > input.to) continue;
      rows.push({
        id: l.id,
        at: day,
        ref: s.folioNo || s.confirmationNo,
        guestRef: s.guestName,
        method: l.description?.trim() || "Payment",
        amount: Math.abs(l.totalAmount),
      });
    }
  }
  const token = agencyToken(input.agent.name);
  for (const d of input.fiscalDocs) {
    if (d.partyType !== "agent" || d.status !== "paid") continue;
    const hit =
      d.party.toLowerCase().includes(token) ||
      input.agent.name
        .toLowerCase()
        .includes(d.party.toLowerCase().split(" ")[0] ?? "");
    if (!hit) continue;
    const day = d.at.slice(0, 10);
    if (day < input.from || day > input.to) continue;
    rows.push({
      id: `doc-pay-${d.id}`,
      at: day,
      ref: d.docNo,
      guestRef: d.guestName?.trim() || d.party,
      method: d.kind === "PSBN" ? "PSBN settled" : "INV settled",
      amount: d.amount,
    });
  }
  rows.sort((a, b) => a.at.localeCompare(b.at) || a.ref.localeCompare(b.ref));
  return rows;
}

function buildMouBlock(input: {
  agent: Agent;
  cells: RateCell[];
  season: Season;
  rateCardCode: string;
}): AgentPrintMouBlock {
  const plans: MealPlan[] = ["CP", "MAP"];
  const rates: AgentPrintMouRateRow[] = [];
  for (const plan of plans) {
    const slice = input.cells.filter(
      (c) =>
        c.rateCardId === input.agent.rateCardId &&
        c.season === input.season &&
        c.mealPlan === plan,
    );
    for (const cell of slice) {
      rates.push({
        typeCode: cell.typeCode,
        typeLabel: String(cell.typeCode).replace(/_/g, " "),
        mealPlan: plan,
        singleNet: cell.singleNet,
        doubleNet: cell.doubleNet ?? cell.netAmount,
      });
    }
  }
  rates.sort(
    (a, b) =>
      a.mealPlan.localeCompare(b.mealPlan) ||
      a.typeCode.localeCompare(b.typeCode),
  );
  return {
    rateCardCode: input.rateCardCode,
    season: input.season,
    creditLimit: input.agent.creditLimit,
    usedCredit: input.agent.usedCredit,
    headroom: Math.max(0, input.agent.creditLimit - input.agent.usedCredit),
    termsDays: input.agent.termsDays,
    rates,
  };
}

export function buildAgentPrintPack(input: {
  agent: Agent;
  stays: Stay[];
  fiscalDocs: FiscalDoc[];
  sections: AgentPrintPackSections;
  from: string;
  to: string;
  statementDate?: string;
  cells?: RateCell[];
  season?: Season;
  rateCardCode?: string;
  bank?: AgentPrintBankBlock | null;
}): AgentPrintPackDoc {
  const statementDate = input.statementDate ?? todayIso();
  const sections = { ...input.sections };
  const lines = buildStatementLines({
    agent: input.agent,
    stays: input.stays,
    fiscalDocs: input.fiscalDocs,
    from: input.from,
    to: input.to,
  });
  const masterDoc: AgentStatementDoc = {
    agentId: input.agent.id,
    agentName: input.agent.name,
    agentCode: input.agent.code,
    agentContact: input.agent.contact,
    from: input.from,
    to: input.to,
    statementDate,
    lines,
    totalAmount: lines.reduce((n, l) => n + l.amount, 0),
    totalPaid: lines.reduce((n, l) => n + l.paid, 0),
    totalDue: lines.reduce((n, l) => n + l.balance, 0),
  };

  const unpaidLines = masterDoc.lines.filter((l) => !lineIsPaid(l));
  const paidLines = masterDoc.lines.filter((l) => lineIsPaid(l));
  const staysById = new Map(input.stays.map((s) => [s.id, s] as const));

  const unpaidInvoices: AgentPrintInvoicePage[] = [];
  const paidInvoices: AgentPrintInvoicePage[] = [];

  if (sections.unpaidInvoices) {
    for (const line of unpaidLines) {
      const stayId = line.id.startsWith("stay-") ? line.id.slice(5) : null;
      const stay = stayId ? staysById.get(stayId) : undefined;
      unpaidInvoices.push(
        stay
          ? invoiceFromStay(stay, "unpaid")
          : invoiceFromStatementLine(line, "unpaid"),
      );
    }
  }
  if (sections.paidInvoices) {
    for (const line of paidLines) {
      const stayId = line.id.startsWith("stay-") ? line.id.slice(5) : null;
      const stay = stayId ? staysById.get(stayId) : undefined;
      paidInvoices.push(
        stay
          ? invoiceFromStay(stay, "paid")
          : invoiceFromStatementLine(line, "paid"),
      );
    }
  }

  const summary =
    sections.summary && masterDoc.lines.length > 0
      ? buildSummaryFromLines(masterDoc.lines, staysById)
      : null;

  const payments = sections.payments
    ? buildPayments({
        agent: input.agent,
        stays: input.stays,
        fiscalDocs: input.fiscalDocs,
        from: input.from,
        to: input.to,
      })
    : [];

  const aging = sections.aging
    ? {
        current: input.agent.aging.current,
        d30: input.agent.aging.d30,
        d60: input.agent.aging.d60,
        d90: input.agent.aging.d90,
        total:
          input.agent.aging.current +
          input.agent.aging.d30 +
          input.agent.aging.d60 +
          input.agent.aging.d90,
      }
    : null;

  const mou = sections.mou
    ? input.cells
      ? buildMouBlock({
          agent: input.agent,
          cells: input.cells,
          season: input.season ?? "peak",
          rateCardCode: input.rateCardCode ?? input.agent.rateCardId,
        })
      : {
          rateCardCode: input.rateCardCode ?? input.agent.rateCardId,
          season: input.season ?? "peak",
          creditLimit: input.agent.creditLimit,
          usedCredit: input.agent.usedCredit,
          headroom: Math.max(0, input.agent.creditLimit - input.agent.usedCredit),
          termsDays: input.agent.termsDays,
          rates: [],
        }
    : null;

  const bank =
    sections.master || sections.payments ? (input.bank ?? null) : null;

  const master =
    sections.master && masterDoc.lines.length > 0 ? masterDoc : null;

  const nights = masterDoc.lines.reduce((n, l) => n + l.nights, 0);
  const hasPrintableContent = Boolean(
    master ||
      unpaidInvoices.length ||
      paidInvoices.length ||
      (summary && summary.stayCount > 0) ||
      payments.length ||
      (aging && aging.total > 0) ||
      (mou && (mou.rates.length > 0 || mou.creditLimit > 0)),
  );

  return {
    agentId: input.agent.id,
    agentName: input.agent.name,
    agentCode: input.agent.code,
    agentContact: input.agent.contact,
    from: input.from,
    to: input.to,
    statementDate,
    sections,
    master,
    unpaidInvoices,
    paidInvoices,
    summary,
    payments,
    aging,
    mou,
    bank,
    counts: {
      soaLines: masterDoc.lines.length,
      unpaid: unpaidLines.length,
      paid: paidLines.length,
      payments: payments.length,
      nights,
    },
    hasPrintableContent,
  };
}
