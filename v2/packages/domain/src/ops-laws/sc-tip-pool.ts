/**
 * 10% SC tip pool point distribution.
 * Share = pool / Σ(points × days) × (points × days)
 * Days worked come from biometric punch days.
 */

export type TipStaffInput = {
  staffId: string;
  tipPoints: number;
  daysWorked: number;
};

export type TipShareLine = TipStaffInput & {
  pointDays: number;
  shareBtn: number;
};

export type TipPoolResult = {
  totalPointDays: number;
  lines: TipShareLine[];
};

export function distributeScTipPool(
  poolBtn: number,
  staff: TipStaffInput[],
): TipPoolResult {
  const pool = Math.max(0, round2(poolBtn));
  const linesBase = staff
    .filter((s) => s.tipPoints > 0 && s.daysWorked > 0)
    .map((s) => ({
      ...s,
      pointDays: round4(s.tipPoints * s.daysWorked),
      shareBtn: 0,
    }));
  const totalPointDays = round4(
    linesBase.reduce((sum, l) => sum + l.pointDays, 0),
  );
  if (totalPointDays <= 0 || pool <= 0) {
    return { totalPointDays, lines: linesBase };
  }
  let allocated = 0;
  const lines = linesBase.map((l, i) => {
    const raw = (pool / totalPointDays) * l.pointDays;
    const shareBtn =
      i === linesBase.length - 1
        ? round2(pool - allocated)
        : round2(raw);
    allocated = round2(allocated + shareBtn);
    return { ...l, shareBtn };
  });
  return { totalPointDays, lines };
}

/** Unique calendar days with ≥1 punch in period (YYYY-MM). */
export function daysWorkedFromPunches(
  punchesIso: string[],
  periodYm: string,
): number {
  const days = new Set<string>();
  for (const iso of punchesIso) {
    const d = iso.slice(0, 10);
    if (d.startsWith(periodYm)) days.add(d);
  }
  return days.size;
}

/** Bhutan salary slip: NPPF employee 11% of (basic+allowances), GIS, CIT left as input. */
export function buildSalarySlip(input: {
  basicBtn: number;
  allowancesBtn: number;
  tipShareBtn: number;
  gisBtn?: number;
  citBtn?: number;
}): {
  nppfEmployeeBtn: number;
  gisBtn: number;
  citBtn: number;
  netPayBtn: number;
} {
  const basic = Math.max(0, input.basicBtn);
  const allow = Math.max(0, input.allowancesBtn);
  const tips = Math.max(0, input.tipShareBtn);
  const taxableBase = basic + allow;
  const nppfEmployeeBtn = round2(taxableBase * 0.11);
  const gisBtn = round2(input.gisBtn ?? 0);
  const citBtn = round2(input.citBtn ?? 0);
  const netPayBtn = round2(
    basic + allow + tips - nppfEmployeeBtn - gisBtn - citBtn,
  );
  return { nppfEmployeeBtn, gisBtn, citBtn, netPayBtn };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
