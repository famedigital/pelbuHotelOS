/**
 * Ops / HR season glance — cost vs sell capacity, peak/lean staffing.
 */
import type { HrStaffRow } from "../enterprise-ops-store";
import type { Stay } from "../front-office-store";
import { daysBetweenIso, monthKey, monthLabel, nightsBetween } from "./outlook";

export type OpsHrStaySlice = Pick<
  Stay,
  "id" | "status" | "checkIn" | "checkOut" | "nightlyNet" | "folioLines" | "roomId"
>;

export type StaffDeptCount = {
  dept: string;
  active: number;
  recommendedPeak: number;
  recommendedLean: number;
};

export type SeasonMonthBucket = {
  key: string;
  label: string;
  roomNightsSold: number;
  occPct: number;
  revenue: number;
  suggestedFo: number;
  suggestedHk: number;
  suggestedFnb: number;
};

export type OpsHrIntelligenceReport = {
  from: string;
  to: string;
  asOf: string;
  totalRooms: number;
  roomNightsSold: number;
  roomNightsCapacity: number;
  occPct: number;
  adr: number;
  revpar: number;
  sellPotential: number;
  payrollNetMonthly: number | null;
  roomNightCostBtn: number;
  estimatedRoomCost: number;
  totalCostGlance: number | null;
  marginGlance: number | null;
  peakOccPct: number;
  leanOccPct: number;
  headcountActive: number;
  byDept: StaffDeptCount[];
  months: SeasonMonthBucket[];
  notes: string[];
};

/** Labor ratios: staff per occupied room at peak / lean. */
export const DEFAULT_LABOR_RATIOS = {
  fo: { peak: 0.08, lean: 0.04 },
  hk: { peak: 0.18, lean: 0.1 },
  fnb: { peak: 0.14, lean: 0.06 },
} as const;

export const DEFAULT_ROOM_NIGHT_COST_BTN = 850;

function stayRevenue(stay: OpsHrStaySlice): number {
  const open = stay.folioLines.filter((l) => !l.voided && l.stream === "master");
  const charges = open.filter((l) => l.kind !== "payment");
  const charged = charges.reduce((s, l) => s + l.totalAmount, 0);
  if (charged > 0) return charged;
  return Math.round(nightsBetween(stay.checkIn, stay.checkOut) * stay.nightlyNet);
}

function recommend(roomsOccupied: number, ratio: number): number {
  return Math.max(1, Math.ceil(roomsOccupied * ratio));
}

function normalizeDept(dept: string): "fo" | "hk" | "fnb" | "other" {
  const d = dept.toLowerCase();
  if (d.includes("front") || d.includes("fo") || d.includes("reception")) return "fo";
  if (d.includes("house") || d.includes("hk") || d.includes("clean")) return "hk";
  if (d.includes("f&b") || d.includes("fnb") || d.includes("kitchen") || d.includes("restaurant"))
    return "fnb";
  return "other";
}

export function buildOpsHrIntelligence(input: {
  stays: OpsHrStaySlice[];
  roomsCount: number;
  from: string;
  to: string;
  asOf?: string;
  staff?: HrStaffRow[];
  payrollNetMonthly?: number | null;
  roomNightCostBtn?: number;
}): OpsHrIntelligenceReport {
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const totalRooms = Math.max(1, input.roomsCount);
  const roomNightCostBtn = input.roomNightCostBtn ?? DEFAULT_ROOM_NIGHT_COST_BTN;
  const periodDays = Math.max(1, daysBetweenIso(input.from, input.to) + 1);
  const roomNightsCapacity = totalRooms * periodDays;

  const live = input.stays.filter((s) => !["cancelled", "no_show"].includes(s.status));
  let roomNightsSold = 0;
  let revenue = 0;
  const months = new Map<
    string,
    { key: string; label: string; roomNightsSold: number; revenue: number }
  >();

  for (const s of live) {
    const anchor = (s.checkOut || s.checkIn).slice(0, 10);
    if (anchor < input.from || anchor > input.to) continue;
    const nts = nightsBetween(s.checkIn, s.checkOut);
    const rev = stayRevenue(s);
    roomNightsSold += nts;
    revenue += rev;
    const mk = monthKey(s.checkIn);
    const m = months.get(mk) ?? {
      key: mk,
      label: monthLabel(mk),
      roomNightsSold: 0,
      revenue: 0,
    };
    m.roomNightsSold += nts;
    m.revenue += rev;
    months.set(mk, m);
  }

  const occPct = Math.round((roomNightsSold / roomNightsCapacity) * 100);
  const adr = roomNightsSold > 0 ? Math.round(revenue / roomNightsSold) : 0;
  const revpar = Math.round((revenue / roomNightsCapacity) * 100) / 100;
  const sellPotential = Math.round(roomNightsCapacity * (adr || 0));

  const monthBuckets: SeasonMonthBucket[] = [...months.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((m) => {
      const daysInMonth = 30;
      const cap = totalRooms * daysInMonth;
      const occ = Math.round((m.roomNightsSold / cap) * 100);
      const avgOccRooms = Math.round(m.roomNightsSold / daysInMonth);
      return {
        key: m.key,
        label: m.label,
        roomNightsSold: m.roomNightsSold,
        occPct: occ,
        revenue: m.revenue,
        suggestedFo: recommend(avgOccRooms, DEFAULT_LABOR_RATIOS.fo.peak),
        suggestedHk: recommend(avgOccRooms, DEFAULT_LABOR_RATIOS.hk.peak),
        suggestedFnb: recommend(avgOccRooms, DEFAULT_LABOR_RATIOS.fnb.peak),
      };
    });

  const occList = monthBuckets.map((m) => m.occPct).sort((a, b) => a - b);
  const leanOccPct = occList[0] ?? occPct;
  const peakOccPct = occList[occList.length - 1] ?? occPct;

  const peakRooms = Math.round((peakOccPct / 100) * totalRooms);
  const leanRooms = Math.round((leanOccPct / 100) * totalRooms);

  const staff = (input.staff ?? []).filter((s) => s.active);
  const deptMap = new Map<string, number>();
  for (const s of staff) {
    const key = s.dept || "Other";
    deptMap.set(key, (deptMap.get(key) ?? 0) + 1);
  }

  const byDept: StaffDeptCount[] = [];
  const seen = new Set<string>();
  for (const [dept, active] of deptMap) {
    seen.add(normalizeDept(dept));
    const kind = normalizeDept(dept);
    const ratios =
      kind === "fo"
        ? DEFAULT_LABOR_RATIOS.fo
        : kind === "hk"
          ? DEFAULT_LABOR_RATIOS.hk
          : kind === "fnb"
            ? DEFAULT_LABOR_RATIOS.fnb
            : { peak: 0.05, lean: 0.03 };
    byDept.push({
      dept,
      active,
      recommendedPeak: recommend(peakRooms, ratios.peak),
      recommendedLean: recommend(leanRooms, ratios.lean),
    });
  }
  // Ensure FO/HK/F&B appear even if no staff rows
  for (const [label, kind] of [
    ["Front Office", "fo"],
    ["Housekeeping", "hk"],
    ["F&B", "fnb"],
  ] as const) {
    if ([...deptMap.keys()].some((d) => normalizeDept(d) === kind)) continue;
    const ratios = DEFAULT_LABOR_RATIOS[kind];
    byDept.push({
      dept: label,
      active: 0,
      recommendedPeak: recommend(peakRooms, ratios.peak),
      recommendedLean: recommend(leanRooms, ratios.lean),
    });
  }

  const payrollNetMonthly =
    input.payrollNetMonthly != null && input.payrollNetMonthly > 0
      ? input.payrollNetMonthly
      : staff.length === 0
        ? null
        : null;

  const estimatedRoomCost = Math.round(roomNightsSold * roomNightCostBtn);
  const totalCostGlance =
    payrollNetMonthly != null ? payrollNetMonthly + estimatedRoomCost : null;
  const marginGlance =
    totalCostGlance != null ? Math.round(revenue - totalCostGlance) : null;

  const notes: string[] = [];
  if (staff.length === 0) {
    notes.push(
      "No active HR staff on file — peak/lean recommendations shown without payroll cost.",
    );
  }
  if (payrollNetMonthly == null) {
    notes.push("Wire monthly payroll net from HR salary sheet for full cost glance.");
  }
  notes.push(
    `Room-night variable cost assumed Nu ${roomNightCostBtn} (utilities/linen/consumables).`,
  );

  return {
    from: input.from,
    to: input.to,
    asOf,
    totalRooms,
    roomNightsSold,
    roomNightsCapacity,
    occPct,
    adr,
    revpar: Math.round(revpar),
    sellPotential,
    payrollNetMonthly,
    roomNightCostBtn,
    estimatedRoomCost,
    totalCostGlance,
    marginGlance,
    peakOccPct,
    leanOccPct,
    headcountActive: staff.length,
    byDept,
    months: monthBuckets,
    notes,
  };
}
