/**
 * Owner home glance — compose Finance + Intelligence for plain-language KPIs.
 * Period bounds live in owner-period.ts (unit-testable without FO/API).
 */
import type { Agent, Season } from "./commercial-store";
import type { HrStaffRow } from "./enterprise-ops-store";
import type { FiscalDoc } from "./extras-store";
import type { PurchaseBill } from "./fiscal-store";
import type { Stay } from "./front-office-store";
import {
  buildExpenseGlance,
  buildExpenseRows,
  buildIncomeGlance,
  buildIncomeRows,
  type ExpenseGlance,
  type IncomeGlance,
} from "./finance-reports";
import {
  buildAgentIntelligence,
  type AgentIntelligenceRow,
} from "./intelligence/agent-intelligence";
import {
  buildOpsHrIntelligence,
  type OpsHrIntelligenceReport,
  type SeasonMonthBucket,
} from "./intelligence/ops-hr-intelligence";
import {
  ownerProfitIdentity,
  resolveOwnerPeriod,
  type OwnerPeriod,
  type OwnerPeriodKind,
} from "./owner-period";

export type { OwnerPeriod, OwnerPeriodKind } from "./owner-period";
export {
  ownerProfitIdentity,
  resolveOwnerPeriod,
  rollupExpenseCategories,
} from "./owner-period";

export type OwnerSourceMixRow = {
  source: "agent" | "direct" | "ota" | "walk_in";
  label: string;
  stayCount: number;
  roomNights: number;
  revenue: number;
};

export type OwnerGlance = {
  period: OwnerPeriod;
  occPct: number;
  roomsFilledLabel: string;
  roomNightsSold: number;
  roomNightsCapacity: number;
  moneyIn: number;
  moneyOut: number;
  profit: number;
  income: IncomeGlance;
  expense: ExpenseGlance;
  topExpenseCategories: { category: string; amount: number; count: number }[];
  topAgents: AgentIntelligenceRow[];
  sourceMix: OwnerSourceMixRow[];
  monthBars: SeasonMonthBucket[];
  ops: OpsHrIntelligenceReport;
};

const SOURCE_LABEL: Record<OwnerSourceMixRow["source"], string> = {
  agent: "Travel agents",
  direct: "Direct",
  ota: "OTA",
  walk_in: "Walk-in",
};

function parseIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = parseIso(checkIn.slice(0, 10)).getTime();
  const b = parseIso(checkOut.slice(0, 10)).getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

export function buildOwnerSourceMix(
  stays: Stay[],
  from: string,
  to: string,
): OwnerSourceMixRow[] {
  const map = new Map<OwnerSourceMixRow["source"], OwnerSourceMixRow>();
  for (const src of ["agent", "direct", "ota", "walk_in"] as const) {
    map.set(src, {
      source: src,
      label: SOURCE_LABEL[src],
      stayCount: 0,
      roomNights: 0,
      revenue: 0,
    });
  }
  for (const s of stays) {
    if (["cancelled", "no_show"].includes(s.status)) continue;
    const anchor = (s.checkOut || s.checkIn).slice(0, 10);
    if (anchor < from || anchor > to) continue;
    const src =
      s.source === "agent" ||
      s.source === "direct" ||
      s.source === "ota" ||
      s.source === "walk_in"
        ? s.source
        : "direct";
    const row = map.get(src)!;
    row.stayCount += 1;
    row.roomNights += nightsBetween(s.checkIn, s.checkOut);
    const charged = s.folioLines
      .filter((l) => !l.voided && l.kind !== "payment")
      .reduce((sum, l) => sum + l.totalAmount, 0);
    row.revenue +=
      charged > 0
        ? charged
        : Math.round(nightsBetween(s.checkIn, s.checkOut) * s.nightlyNet);
  }
  return [...map.values()].sort((a, b) => b.roomNights - a.roomNights);
}

export function buildOwnerGlance(input: {
  kind: OwnerPeriodKind;
  asOf?: string;
  season?: Season;
  stays: Stay[];
  roomsCount: number;
  purchases: PurchaseBill[];
  fiscalDocs: FiscalDoc[];
  agents: Agent[];
  staff?: HrStaffRow[];
}): OwnerGlance {
  const period = resolveOwnerPeriod(input.kind, {
    asOf: input.asOf,
    season: input.season,
  });
  const filter = {
    from: period.from,
    to: period.to,
    query: "",
    status: "all" as const,
    dept: "all" as const,
  };

  const incomeRows = buildIncomeRows({
    stays: input.stays,
    fiscalDocs: input.fiscalDocs,
    filter,
  });
  const expenseRows = buildExpenseRows({
    purchases: input.purchases,
    filter,
  });
  const income = buildIncomeGlance(incomeRows);
  const expense = buildExpenseGlance(expenseRows);
  const moneyIn = income.income;
  const moneyOut = expense.expense;
  const profit = ownerProfitIdentity(moneyIn, moneyOut);

  const ops = buildOpsHrIntelligence({
    stays: input.stays,
    roomsCount: input.roomsCount,
    from: period.from,
    to: period.to,
    asOf: input.asOf,
    staff: input.staff ?? [],
  });

  const agents = buildAgentIntelligence({
    agents: input.agents,
    stays: input.stays,
    from: period.from,
    to: period.to,
    asOf: input.asOf,
    topN: 5,
    season: input.season,
  });

  return {
    period,
    occPct: ops.occPct,
    roomsFilledLabel: `${ops.occPct}% rooms filled`,
    roomNightsSold: ops.roomNightsSold,
    roomNightsCapacity: ops.roomNightsCapacity,
    moneyIn,
    moneyOut,
    profit,
    income,
    expense,
    topExpenseCategories: expense.categories.slice(0, 5),
    topAgents: agents.top,
    sourceMix: buildOwnerSourceMix(input.stays, period.from, period.to),
    monthBars: ops.months,
    ops,
  };
}
