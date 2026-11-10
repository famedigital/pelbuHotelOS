/**
 * HR payroll sheet, rota, attendance matrix, salary advances, remarks.
 * Pure builders over enterprise ops staff + punches + tip pool.
 */
import { buildSalarySlip, daysWorkedFromPunches } from "@hos-v2/domain";
import type { HrStaffRow, PunchRow } from "./enterprise-ops-store";
import { formatNu } from "./enterprise-ops-store";
import { exportCsv } from "./finance-reports";

export type SalaryAdvanceRow = {
  id: string;
  staffId: string;
  staffName: string;
  amountBtn: number;
  issuedAt: string;
  reason: string;
  status: "open" | "deducted" | "written_off";
  periodYm: string;
};

export type RotaSlot = {
  id: string;
  staffId: string;
  staffName: string;
  dept: string;
  date: string;
  shiftCode: "morning" | "evening" | "night" | "off";
  startTime: string;
  endTime: string;
  note?: string;
};

export type StaffRemark = {
  id: string;
  staffId: string;
  staffName: string;
  at: string;
  author: string;
  category: "performance" | "disciplinary" | "commendation" | "general";
  body: string;
};

export type SalarySheetRow = {
  staffId: string;
  name: string;
  dept: string;
  employeeCode: string;
  daysWorked: number;
  tipPoints: number;
  basicBtn: number;
  allowancesBtn: number;
  tipShareBtn: number;
  advanceDeductBtn: number;
  nppfEmployeeBtn: number;
  gisBtn: number;
  citBtn: number;
  grossBtn: number;
  netPayBtn: number;
};

export type AttendanceDay = {
  date: string;
  present: boolean;
  lateMinutes: number;
  punchCount: number;
};

const SHIFT_TIMES: Record<
  RotaSlot["shiftCode"],
  { startTime: string; endTime: string }
> = {
  morning: { startTime: "08:00", endTime: "16:00" },
  evening: { startTime: "14:00", endTime: "22:00" },
  night: { startTime: "22:00", endTime: "06:00" },
  off: { startTime: "—", endTime: "—" },
};

export function seedRotaForWeek(
  staff: HrStaffRow[],
  weekStartYmd: string,
): RotaSlot[] {
  const slots: RotaSlot[] = [];
  const codes: RotaSlot["shiftCode"][] = ["morning", "evening", "night", "off"];
  for (let d = 0; d < 7; d++) {
    const date = addDaysYmd(weekStartYmd, d);
    staff
      .filter((s) => s.active)
      .forEach((s, i) => {
        const shiftCode = codes[(i + d) % codes.length]!;
        const t = SHIFT_TIMES[shiftCode];
        slots.push({
          id: `rota-${s.id}-${date}`,
          staffId: s.id,
          staffName: s.name,
          dept: s.dept,
          date,
          shiftCode,
          startTime: t.startTime,
          endTime: t.endTime,
        });
      });
  }
  return slots;
}

export function seedSalaryAdvances(staff: HrStaffRow[]): SalaryAdvanceRow[] {
  const ym = new Date().toISOString().slice(0, 7);
  const a = staff[1];
  const b = staff[3];
  if (!a || !b) return [];
  return [
    {
      id: "sadv-1",
      staffId: a.id,
      staffName: a.name,
      amountBtn: 3500,
      issuedAt: `${ym}-03T10:00:00+06:00`,
      reason: "Family medical",
      status: "open",
      periodYm: ym,
    },
    {
      id: "sadv-2",
      staffId: b.id,
      staffName: b.name,
      amountBtn: 2000,
      issuedAt: `${ym}-05T14:30:00+06:00`,
      reason: "Festival advance",
      status: "deducted",
      periodYm: ym,
    },
  ];
}

export function seedStaffRemarks(staff: HrStaffRow[]): StaffRemark[] {
  const a = staff[0];
  const b = staff[2];
  if (!a || !b) return [];
  return [
    {
      id: "rmk-1",
      staffId: a.id,
      staffName: a.name,
      at: new Date().toISOString(),
      author: "GM",
      category: "commendation",
      body: "Handled Yangphel group arrival smoothly under pressure.",
    },
    {
      id: "rmk-2",
      staffId: b.id,
      staffName: b.name,
      at: new Date(Date.now() - 86_400_000).toISOString(),
      author: "HK Supervisor",
      category: "performance",
      body: "Room turnaround under 18 min average this week.",
    },
  ];
}

export function buildSalarySheet(input: {
  staff: HrStaffRow[];
  punches: PunchRow[];
  tipShares: Map<string, number>;
  advances: SalaryAdvanceRow[];
  periodYm: string;
  dept?: string;
}): SalarySheetRow[] {
  return input.staff
    .filter((s) => s.active)
    .filter((s) => !input.dept || input.dept === "all" || s.dept === input.dept)
    .map((s) => {
      const daysWorked = Math.max(
        1,
        daysWorkedFromPunches(
          input.punches
            .filter((p) => p.employeeCode === s.employeeCode)
            .map((p) => p.punchedAtIso),
          input.periodYm,
        ),
      );
      const tipShareBtn = input.tipShares.get(s.id) ?? 0;
      const advanceDeductBtn = input.advances
        .filter(
          (a) =>
            a.staffId === s.id &&
            a.periodYm === input.periodYm &&
            (a.status === "open" || a.status === "deducted"),
        )
        .reduce((sum, a) => sum + a.amountBtn, 0);
      const allowancesBtn = 2000;
      const slip = buildSalarySlip({
        basicBtn: s.basicBtn,
        allowancesBtn,
        tipShareBtn,
        gisBtn: 150,
        citBtn: 0,
      });
      const grossBtn = s.basicBtn + allowancesBtn + tipShareBtn;
      return {
        staffId: s.id,
        name: s.name,
        dept: s.dept,
        employeeCode: s.employeeCode,
        daysWorked,
        tipPoints: s.tipPoints,
        basicBtn: s.basicBtn,
        allowancesBtn,
        tipShareBtn,
        advanceDeductBtn,
        nppfEmployeeBtn: slip.nppfEmployeeBtn,
        gisBtn: slip.gisBtn,
        citBtn: slip.citBtn,
        grossBtn,
        netPayBtn: Math.max(0, slip.netPayBtn - advanceDeductBtn),
      };
    })
    .sort((a, b) => a.dept.localeCompare(b.dept) || a.name.localeCompare(b.name));
}

export function buildAttendanceMatrix(input: {
  staff: HrStaffRow;
  punches: PunchRow[];
  periodYm: string;
}): AttendanceDay[] {
  const daysInMonth = daysInYm(input.periodYm);
  const own = input.punches.filter(
    (p) => p.employeeCode === input.staff.employeeCode,
  );
  const byDay = new Map<string, PunchRow[]>();
  for (const p of own) {
    const d = p.punchedAtIso.slice(0, 10);
    if (!d.startsWith(input.periodYm)) continue;
    const list = byDay.get(d) ?? [];
    list.push(p);
    byDay.set(d, list);
  }
  const rows: AttendanceDay[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${input.periodYm}-${String(day).padStart(2, "0")}`;
    const hits = byDay.get(date) ?? [];
    rows.push({
      date,
      present: hits.length > 0,
      lateMinutes: hits.reduce((s, p) => s + p.lateMinutes, 0),
      punchCount: hits.length,
    });
  }
  return rows;
}

export function exportSalarySheetCsv(
  periodYm: string,
  rows: SalarySheetRow[],
): { filename: string; rows: number } {
  return exportCsv(
    `salary-sheet-${periodYm}.csv`,
    [
      "Code",
      "Name",
      "Dept",
      "Days",
      "Basic",
      "Allowances",
      "SC tip",
      "Advance",
      "NPPF",
      "GIS",
      "Gross",
      "Net",
    ],
    rows.map((r) => [
      r.employeeCode,
      r.name,
      r.dept,
      String(r.daysWorked),
      String(r.basicBtn),
      String(r.allowancesBtn),
      String(r.tipShareBtn),
      String(r.advanceDeductBtn),
      String(r.nppfEmployeeBtn),
      String(r.gisBtn),
      String(r.grossBtn),
      String(r.netPayBtn),
    ]),
  );
}

export function exportAttendanceCsv(
  staffName: string,
  periodYm: string,
  days: AttendanceDay[],
): { filename: string; rows: number } {
  const safe = staffName.replace(/\s+/g, "-").toLowerCase();
  return exportCsv(
    `attendance-${safe}-${periodYm}.csv`,
    ["Date", "Present", "LateMinutes", "Punches"],
    days.map((d) => [
      d.date,
      d.present ? "Y" : "N",
      String(d.lateMinutes),
      String(d.punchCount),
    ]),
  );
}

export { formatNu };

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysInYm(periodYm: string): number {
  const [y, m] = periodYm.split("-").map(Number);
  if (!y || !m) return 28;
  return new Date(y, m, 0).getDate();
}

export function mondayOfWeek(ymd = new Date().toISOString().slice(0, 10)): string {
  const d = new Date(`${ymd}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
