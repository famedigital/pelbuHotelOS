import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Clock,
  Download,
  Fingerprint,
  Lock,
  Printer,
  Users,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  GlassPanel,
  GlassTiltCard,
  ModuleFrame,
  MorphTabs,
  StatusLegend,
} from "@hos-v2/ui";
import { formatNu, useEnterpriseOpsStore } from "../lib/enterprise-ops-store";
import {
  buildAttendanceMatrix,
  buildSalarySheet,
  exportAttendanceCsv,
  exportSalarySheetCsv,
  type StaffRemark,
} from "../lib/hr-payroll";

type Tab =
  | "salary"
  | "attendance"
  | "rota"
  | "advances"
  | "sc"
  | "remarks"
  | "roster"
  | "biometric";

const DEPTS = ["all", "FO", "HK", "F&B", "Kitchen"] as const;
const SHIFT_CODES = ["morning", "evening", "night", "off"] as const;
const REMARK_CATS: StaffRemark["category"][] = [
  "general",
  "performance",
  "commendation",
  "disciplinary",
];

function outlierLine(
  shareBtn: number,
  lines: Array<{ shareBtn: number }>,
): boolean {
  if (lines.length < 2) return false;
  const avg = lines.reduce((s, l) => s + l.shareBtn, 0) / lines.length;
  return shareBtn > avg * 1.35;
}

function punchDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" });
}

export function HrPage() {
  const reduce = useReducedMotion();
  const [, start] = useTransition();
  const hrStaff = useEnterpriseOpsStore((s) => s.hrStaff);
  const punches = useEnterpriseOpsStore((s) => s.punches);
  const ingestAttlog = useEnterpriseOpsStore((s) => s.ingestAttlog);
  const runTipPool = useEnterpriseOpsStore((s) => s.runTipPool);
  const runTipPoolRemote = useEnterpriseOpsStore((s) => s.runTipPoolRemote);
  const refreshPunchesFromApi = useEnterpriseOpsStore(
    (s) => s.refreshPunchesFromApi,
  );
  const lockTipPool = useEnterpriseOpsStore((s) => s.lockTipPool);
  const lockedTipPools = useEnterpriseOpsStore((s) => s.lockedTipPools);
  const salaryPreview = useEnterpriseOpsStore((s) => s.salaryPreview);
  const saveStaffPin = useEnterpriseOpsStore((s) => s.saveStaffPin);
  const remapEmployeeCode = useEnterpriseOpsStore((s) => s.remapEmployeeCode);
  const salaryAdvances = useEnterpriseOpsStore((s) => s.salaryAdvances);
  const rotaSlots = useEnterpriseOpsStore((s) => s.rotaSlots);
  const staffRemarks = useEnterpriseOpsStore((s) => s.staffRemarks);
  const issueSalaryAdvance = useEnterpriseOpsStore((s) => s.issueSalaryAdvance);
  const markSalaryAdvanceDeducted = useEnterpriseOpsStore(
    (s) => s.markSalaryAdvanceDeducted,
  );
  const setRotaShift = useEnterpriseOpsStore((s) => s.setRotaShift);
  const addStaffRemark = useEnterpriseOpsStore((s) => s.addStaffRemark);

  const [selectedId, setSelectedId] = useState(hrStaff[0]!.id);
  const [newPin, setNewPin] = useState("7890");
  const [tab, setTab] = useState<Tab>("salary");
  const [deptFilter, setDeptFilter] = useState<(typeof DEPTS)[number]>("all");
  const [periodYm, setPeriodYm] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [attlogPaste, setAttlogPaste] = useState(
    "101\t2026-11-08 08:12:00\t0\t1\n102\t2026-11-08 08:18:00\t0\t1\n999\t2026-11-08 08:45:00\t0\t1",
  );
  const [mapCode, setMapCode] = useState("");
  const [mapStaffId, setMapStaffId] = useState(hrStaff[0]!.id);
  const [poolPrint, setPoolPrint] = useState(false);
  const [advAmount, setAdvAmount] = useState(2500);
  const [advReason, setAdvReason] = useState("Salary advance");
  const [remarkBody, setRemarkBody] = useState("");
  const [remarkCat, setRemarkCat] =
    useState<StaffRemark["category"]>("general");

  const tipRun = useMemo(
    () => runTipPool(periodYm),
    [runTipPool, periodYm, punches.length, hrStaff.length],
  );
  const locked = useMemo(
    () => lockedTipPools.find((l) => l.periodYm === periodYm) ?? null,
    [lockedTipPools, periodYm],
  );
  const displayRun = locked ?? tipRun;

  const tipShares = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of displayRun.lines) m.set(l.staffId, l.shareBtn);
    return m;
  }, [displayRun]);

  const salaryRows = useMemo(
    () =>
      buildSalarySheet({
        staff: hrStaff,
        punches,
        tipShares,
        advances: salaryAdvances,
        periodYm,
        dept: deptFilter,
      }),
    [hrStaff, punches, tipShares, salaryAdvances, periodYm, deptFilter],
  );

  const filteredStaff = useMemo(
    () =>
      hrStaff.filter((s) => deptFilter === "all" || s.dept === deptFilter),
    [hrStaff, deptFilter],
  );

  const selected =
    hrStaff.find((s) => s.id === selectedId) ?? filteredStaff[0] ?? hrStaff[0]!;
  const selectedShare =
    displayRun.lines.find((l) => l.staffId === selected.id)?.shareBtn ?? 0;
  const slip = salaryPreview(selected.id, selectedShare);

  const attendance = useMemo(
    () =>
      buildAttendanceMatrix({
        staff: selected,
        punches,
        periodYm,
      }),
    [selected, punches, periodYm],
  );

  const staffRota = useMemo(
    () =>
      rotaSlots
        .filter((r) => r.staffId === selected.id)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [rotaSlots, selected.id],
  );

  const staffAdv = useMemo(
    () => salaryAdvances.filter((a) => a.staffId === selected.id),
    [salaryAdvances, selected.id],
  );

  const staffRmk = useMemo(
    () => staffRemarks.filter((r) => r.staffId === selected.id),
    [staffRemarks, selected.id],
  );

  const unmatchedCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const p of punches) {
      if (p.staffName.startsWith("Code ")) codes.add(p.employeeCode);
    }
    return [...codes];
  }, [punches]);

  const lateClusters = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const p of punches) {
      if (p.lateMinutes <= 0) continue;
      const d = punchDayKey(p.punchedAtIso);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
    return [...byDay.entries()]
      .filter(([, n]) => n >= 3)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [punches]);

  const staffOps = useMemo(() => {
    const monthPrefix = periodYm;
    const own = punches.filter((p) => p.employeeCode === selected.employeeCode);
    const monthPunches = own.filter((p) =>
      punchDayKey(p.punchedAtIso).startsWith(monthPrefix),
    );
    const lateCount = monthPunches.filter((p) => p.lateMinutes > 0).length;
    const last =
      own.length > 0
        ? own.reduce((a, b) =>
            a.punchedAtIso > b.punchedAtIso ? a : b,
          )
        : null;
    return { monthPunches: monthPunches.length, lateCount, last };
  }, [punches, selected, periodYm]);

  const activeCount = hrStaff.filter((s) => s.active).length;
  const openAdvances = salaryAdvances.filter((a) => a.status === "open").length;
  const payrollNet = salaryRows.reduce((s, r) => s + r.netPayBtn, 0);

  return (
    <ModuleFrame
      title="HR · Payroll & People"
      description="Salary sheet · attendance · rota · advances · SC tip pool · remarks · ADMS"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusLegend
            dense
            className="hidden md:flex"
            items={[
              { id: "on", label: "On duty", swatch: "var(--hos-emerald)" },
              { id: "leave", label: "Leave", swatch: "var(--hos-brass)" },
              { id: "abs", label: "Absent", swatch: "var(--hos-ruby)" },
            ]}
          />
          <Badge tone="default" className="border border-[var(--hos-primary)]">
            Rota · {periodYm}
          </Badge>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="hos-glass-card flex flex-wrap items-end gap-2 p-3">
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
            Payroll month
            <input
              type="month"
              value={periodYm}
              onChange={(e) => setPeriodYm(e.target.value)}
              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
            />
          </label>
          <div className="flex flex-wrap gap-1">
            {DEPTS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDeptFilter(d)}
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
                  deptFilter === d
                    ? "border-[var(--hos-primary)] text-[var(--hos-primary)]"
                    : "border-[var(--hos-line)] text-[var(--hos-ink-2)]"
                }`}
              >
                {d === "all" ? "All depts" : d}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <GlassTiltCard className="p-3.5" glowColor="brand">
            <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Active staff</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{activeCount}</div>
          </GlassTiltCard>
          <GlassTiltCard className="p-3.5" glowColor="emerald">
            <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Payroll net</div>
            <div className="mt-1 text-xl font-bold tabular-nums">{formatNu(payrollNet)}</div>
          </GlassTiltCard>
          <GlassTiltCard className="p-3.5" glowColor="brass">
            <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">SC tip pool</div>
            <div className="mt-1 text-xl font-bold tabular-nums">{formatNu(displayRun.poolBtn)}</div>
          </GlassTiltCard>
          <GlassTiltCard className="p-3.5" glowColor="brand">
            <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Open advances</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{openAdvances}</div>
          </GlassTiltCard>
        </div>

        <MorphTabs
          glowId="hrTabGlow"
          value={tab}
          onChange={setTab}
          size="md"
          items={[
            { id: "salary", label: "Salary sheet", count: salaryRows.length },
            { id: "attendance", label: "Attendance" },
            { id: "rota", label: "Rota", count: rotaSlots.length },
            { id: "advances", label: "Advances", count: salaryAdvances.length },
            { id: "sc", label: "S.C. pool" },
            { id: "remarks", label: "Remarks", count: staffRemarks.length },
            { id: "roster", label: "Roster" },
            { id: "biometric", label: "ADMS" },
          ]}
        />

        {tab === "salary" ? (
          <GlassPanel className="p-3.5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="m-0 text-sm font-bold">Staff salary sheet · {periodYm}</h3>
                <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                  Basic + allowances + SC tip − NPPF − GIS − advances
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const res = exportSalarySheetCsv(periodYm, salaryRows);
                  toast.success(`Exported ${res.rows} rows`, {
                    description: res.filename,
                  });
                }}
              >
                <Download className="mr-1 size-3.5" /> CSV
              </Button>
            </div>
            {salaryRows.length === 0 ? (
              <EmptyState title="No salary rows" description="Add active staff or clear dept filter." />
            ) : (
              <>
              <ul className="m-0 mb-2 grid list-none gap-2 p-0 md:hidden">
                {salaryRows.map((r) => (
                  <li key={r.staffId}>
                    <button
                      type="button"
                      className="hos-cell flex w-full flex-col gap-1 rounded-xl border border-[var(--hos-line)] p-3 text-left"
                      onClick={() => {
                        setSelectedId(r.staffId);
                        setTab("roster");
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="truncate text-[13px] text-[var(--hos-ink)]">
                          {r.name}
                        </strong>
                        <span className="font-mono text-[11px] text-[var(--hos-ink-3)]">
                          {r.employeeCode}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--hos-ink-3)]">
                        {r.dept} · {r.daysWorked}d
                      </div>
                      <div className="flex justify-between font-mono text-[12px] tabular-nums">
                        <span className="text-[var(--hos-ink-3)]">Net</span>
                        <span className="font-bold text-[var(--hos-ink)]">
                          {formatNu(r.netPayBtn)}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
                <li className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-surface)] px-3 py-2.5 text-right font-mono text-[12px] font-bold">
                  Total net {formatNu(payrollNet)}
                </li>
              </ul>
              <div className="hidden overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] md:block">
                <table className="w-full min-w-[980px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                      <th className="px-2 py-2">Code</th>
                      <th className="px-2 py-2">Name</th>
                      <th className="px-2 py-2">Dept</th>
                      <th className="px-2 py-2 text-right">Days</th>
                      <th className="px-2 py-2 text-right">Basic</th>
                      <th className="px-2 py-2 text-right">Allow</th>
                      <th className="px-2 py-2 text-right">SC tip</th>
                      <th className="px-2 py-2 text-right">Advance</th>
                      <th className="px-2 py-2 text-right">NPPF</th>
                      <th className="px-2 py-2 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--hos-line)]">
                    {salaryRows.map((r) => (
                      <tr
                        key={r.staffId}
                        className="cursor-pointer hover:bg-[rgba(37,99,235,0.06)]"
                        onClick={() => {
                          setSelectedId(r.staffId);
                          setTab("roster");
                        }}
                      >
                        <td className="px-2 py-2 font-mono">{r.employeeCode}</td>
                        <td className="px-2 py-2 font-semibold">{r.name}</td>
                        <td className="px-2 py-2">{r.dept}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{r.daysWorked}</td>
                        <td className="px-2 py-2 text-right font-mono">{formatNu(r.basicBtn)}</td>
                        <td className="px-2 py-2 text-right font-mono">{formatNu(r.allowancesBtn)}</td>
                        <td className="px-2 py-2 text-right font-mono text-[var(--hos-emerald)]">
                          {formatNu(r.tipShareBtn)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-[var(--hos-ruby)]">
                          {r.advanceDeductBtn ? formatNu(r.advanceDeductBtn) : "—"}
                        </td>
                        <td className="px-2 py-2 text-right font-mono">{formatNu(r.nppfEmployeeBtn)}</td>
                        <td className="px-2 py-2 text-right font-mono font-bold">
                          {formatNu(r.netPayBtn)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[var(--hos-line)] font-bold">
                      <td className="px-2 py-2.5" colSpan={9}>
                        Total net pay
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono">
                        {formatNu(payrollNet)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              </>
            )}
          </GlassPanel>
        ) : null}

        {tab === "attendance" ? (
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <GlassPanel className="p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--hos-ink-3)]">
                Staff
              </p>
              {filteredStaff.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`mb-1.5 w-full rounded-xl border px-3 py-2 text-left text-xs ${
                    s.id === selected.id
                      ? "border-[var(--hos-primary)] bg-[rgba(37,99,235,0.08)]"
                      : "border-[var(--hos-line)]"
                  }`}
                >
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-[10px] text-[var(--hos-ink-3)]">
                    {s.dept} · {s.employeeCode}
                  </div>
                </button>
              ))}
            </GlassPanel>
            <GlassPanel className="p-3.5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="m-0 text-sm font-bold">
                    Attendance · {selected.name}
                  </h3>
                  <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                    {attendance.filter((d) => d.present).length} present ·{" "}
                    {attendance.filter((d) => d.lateMinutes > 0).length} late days
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const res = exportAttendanceCsv(
                      selected.name,
                      periodYm,
                      attendance,
                    );
                    toast.success(`Exported ${res.rows} days`);
                  }}
                >
                  <Download className="mr-1 size-3.5" /> CSV
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10">
                {attendance.map((d) => (
                  <div
                    key={d.date}
                    title={`${d.date} · punches ${d.punchCount} · late ${d.lateMinutes}m`}
                    className={`rounded-lg border px-1 py-2 text-center text-[10px] ${
                      d.present
                        ? d.lateMinutes > 0
                          ? "border-[rgba(245,158,11,0.45)] bg-[rgba(245,158,11,0.14)]"
                          : "border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.12)]"
                        : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-3)]"
                    }`}
                  >
                    <div className="font-mono font-bold">{d.date.slice(-2)}</div>
                    <div>{d.present ? (d.lateMinutes > 0 ? "Late" : "OK") : "—"}</div>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </div>
        ) : null}

        {tab === "rota" ? (
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <GlassPanel className="p-3">
              {filteredStaff.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`mb-1.5 w-full rounded-xl border px-3 py-2 text-left text-xs ${
                    s.id === selected.id
                      ? "border-[var(--hos-primary)] bg-[rgba(37,99,235,0.08)]"
                      : "border-[var(--hos-line)]"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </GlassPanel>
            <GlassPanel className="p-3.5">
              <h3 className="m-0 mb-3 text-sm font-bold">Rota · {selected.name}</h3>
              {staffRota.length === 0 ? (
                <EmptyState title="No rota slots" description="Shift seeds load for the current week." />
              ) : (
                <div className="space-y-2">
                  {staffRota.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs"
                    >
                      <span className="font-mono font-semibold">{slot.date}</span>
                      <div className="flex flex-wrap gap-1">
                        {SHIFT_CODES.map((code) => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => {
                              const res = setRotaShift({
                                staffId: selected.id,
                                date: slot.date,
                                shiftCode: code,
                              });
                              if (!res.ok) toast.error(res.error);
                              else toast.message(`${slot.date} → ${code}`);
                            }}
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${
                              slot.shiftCode === code
                                ? "border-[var(--hos-ink)] bg-[var(--hos-ink)] text-white"
                                : "border-[var(--hos-line)] text-[var(--hos-ink-2)]"
                            }`}
                          >
                            {code}
                          </button>
                        ))}
                      </div>
                      <span className="ml-auto text-[var(--hos-ink-3)]">
                        {slot.startTime}–{slot.endTime}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </GlassPanel>
          </div>
        ) : null}

        {tab === "advances" ? (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <GlassPanel className="p-4">
              <h3 className="m-0 text-sm font-bold">Issue salary advance</h3>
              <label className="mt-3 grid gap-1 text-xs font-medium">
                Staff
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2"
                >
                  {hrStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-2 grid gap-1 text-xs font-medium">
                Amount (Nu.)
                <input
                  type="number"
                  min={0}
                  value={advAmount}
                  onChange={(e) => setAdvAmount(Number(e.target.value) || 0)}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 font-mono"
                />
              </label>
              <label className="mt-2 grid gap-1 text-xs font-medium">
                Reason
                <input
                  value={advReason}
                  onChange={(e) => setAdvReason(e.target.value)}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2"
                />
              </label>
              <Button
                className="mt-3 w-full"
                size="sm"
                onClick={() => {
                  const res = issueSalaryAdvance({
                    staffId: selectedId,
                    amountBtn: advAmount,
                    reason: advReason,
                    periodYm,
                  });
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success(`Advance ${formatNu(res.advance.amountBtn)}`, {
                    description: res.advance.staffName,
                  });
                }}
              >
                Issue advance
              </Button>
            </GlassPanel>
            <GlassPanel className="p-3.5">
              <h3 className="m-0 mb-3 text-sm font-bold">Advances register</h3>
              {salaryAdvances.length === 0 ? (
                <EmptyState title="No advances" description="Issue a salary advance to start." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                        <th className="px-3 py-2">Staff</th>
                        <th className="px-3 py-2">Reason</th>
                        <th className="px-3 py-2">Period</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hos-line)]">
                      {salaryAdvances.map((a) => (
                        <tr key={a.id}>
                          <td className="px-3 py-2 font-semibold">{a.staffName}</td>
                          <td className="px-3 py-2">{a.reason}</td>
                          <td className="px-3 py-2 font-mono">{a.periodYm}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {formatNu(a.amountBtn)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              tone={
                                a.status === "open"
                                  ? "vip"
                                  : a.status === "deducted"
                                    ? "success"
                                    : "muted"
                              }
                            >
                              {a.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            {a.status === "open" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const res = markSalaryAdvanceDeducted(a.id);
                                  if (!res.ok) toast.error(res.error);
                                  else toast.success("Marked deducted on payroll");
                                }}
                              >
                                Deduct
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {staffAdv.length > 0 ? (
                <p className="mt-2 text-[11px] text-[var(--hos-ink-3)]">
                  Selected staff open advances:{" "}
                  {formatNu(
                    staffAdv
                      .filter((a) => a.status === "open")
                      .reduce((s, a) => s + a.amountBtn, 0),
                  )}
                </p>
              ) : null}
            </GlassPanel>
          </div>
        ) : null}

        {tab === "sc" ? (
          <GlassPanel className="flex flex-col gap-3 p-3.5">
            <div className="no-print flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-xs font-medium">
                Pool period
                <input
                  type="month"
                  value={periodYm}
                  onChange={(e) => setPeriodYm(e.target.value)}
                  disabled={!!locked}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-sm"
                />
              </label>
              {locked ? (
                <Badge tone="vip" className="gap-1">
                  <Lock className="size-3" />
                  Locked {new Date(locked.lockedAt).toLocaleString()}
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    start(async () => {
                      const remote = await runTipPoolRemote(periodYm);
                      if (!remote.ok) {
                        toast.error("Tip pool persist failed", {
                          description: remote.error,
                        });
                        return;
                      }
                      const res = lockTipPool(periodYm);
                      if (!res.ok) {
                        toast.error("Cannot lock pool", { description: res.error });
                        return;
                      }
                      toast.success(`Tip pool locked · ${periodYm}`, {
                        description:
                          remote.persistence === "postgres"
                            ? "Saved to Postgres"
                            : "Local demo only",
                      });
                    });
                  }}
                >
                  <Lock className="mr-1 size-3.5" />
                  Lock run
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  setPoolPrint(true);
                  window.setTimeout(() => {
                    window.print();
                    window.setTimeout(() => setPoolPrint(false), 400);
                  }, 80);
                }}
              >
                <Printer className="mr-1 size-3.5" />
                Print pool sheet
              </Button>
            </div>
            <div
              id="hos-tip-pool-print"
              className={`overflow-x-auto rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] ${
                poolPrint ? "print:border-0 print:shadow-none" : ""
              }`}
            >
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                    <th className="px-2 py-2">Staff</th>
                    <th className="px-2 py-2 text-right">Points</th>
                    <th className="px-2 py-2 text-right">Days</th>
                    <th className="px-2 py-2 text-right">Point-days</th>
                    <th className="px-2 py-2 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hos-line)]">
                  {displayRun.lines.map((l) => {
                    const hot = outlierLine(l.shareBtn, displayRun.lines);
                    return (
                      <tr
                        key={l.staffId}
                        className={hot ? "bg-[rgba(245,158,11,0.12)]" : undefined}
                      >
                        <td className="px-2 py-2 font-semibold">
                          {l.name}
                          {hot ? (
                            <Badge tone="vip" className="ml-1.5 text-[9px]">
                              Outlier
                            </Badge>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{l.tipPoints}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{l.daysWorked}</td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {(l.tipPoints * l.daysWorked).toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-bold text-[var(--hos-emerald)]">
                          {formatNu(l.shareBtn)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
              Share = pool ÷ Σ(points × days) × (points × days). Pool{" "}
              {formatNu(displayRun.poolBtn)}.
              {locked ? " · Locked for payroll." : " · Lock before month-end payout."}
            </p>
          </GlassPanel>
        ) : null}

        {tab === "remarks" ? (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <GlassPanel className="p-4">
              <h3 className="m-0 text-sm font-bold">Add remark · {selected.name}</h3>
              <label className="mt-3 grid gap-1 text-xs font-medium">
                Category
                <select
                  value={remarkCat}
                  onChange={(e) =>
                    setRemarkCat(e.target.value as StaffRemark["category"])
                  }
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 capitalize"
                >
                  {REMARK_CATS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-2 grid gap-1 text-xs font-medium">
                Note
                <textarea
                  value={remarkBody}
                  onChange={(e) => setRemarkBody(e.target.value)}
                  rows={4}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-xs"
                />
              </label>
              <Button
                className="mt-3 w-full"
                size="sm"
                onClick={() => {
                  const res = addStaffRemark({
                    staffId: selected.id,
                    category: remarkCat,
                    body: remarkBody,
                    author: "HR Desk",
                  });
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("Remark saved");
                  setRemarkBody("");
                }}
              >
                Save remark
              </Button>
            </GlassPanel>
            <GlassPanel className="p-3.5">
              <h3 className="m-0 mb-3 text-sm font-bold">Remarks · {selected.name}</h3>
              {staffRmk.length === 0 ? (
                <EmptyState
                  title="No remarks yet"
                  description="Performance, disciplinary, or commendation notes land here."
                />
              ) : (
                <ul className="m-0 list-none space-y-2 p-0">
                  {staffRmk.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          tone={
                            r.category === "commendation"
                              ? "success"
                              : r.category === "disciplinary"
                                ? "danger"
                                : "default"
                          }
                        >
                          {r.category}
                        </Badge>
                        <span className="text-[var(--hos-ink-3)]">
                          {r.author} · {new Date(r.at).toLocaleString()}
                        </span>
                      </div>
                      <p className="m-0 mt-1.5 text-[var(--hos-ink)]">{r.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </GlassPanel>
          </div>
        ) : null}

        {tab === "roster" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
            <GlassPanel className="flex flex-col gap-2 p-3">
              {filteredStaff.length === 0 ? (
                <EmptyState title="No staff" description="Change dept filter." />
              ) : (
                filteredStaff.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left ${
                      s.id === selected.id
                        ? "border-[var(--hos-primary)] bg-[rgba(37,99,235,0.08)]"
                        : "border-[var(--hos-line)] bg-[var(--hos-cell)]"
                    }`}
                  >
                    <div className="text-xs font-semibold text-[var(--hos-ink)]">
                      {s.name}
                    </div>
                    <div className="text-[10px] text-[var(--hos-ink-3)]">
                      {s.dept} · code {s.employeeCode} · {s.tipPoints} pts
                    </div>
                  </button>
                ))
              )}
            </GlassPanel>
            <div className="flex flex-col gap-4">
              <GlassPanel className="p-4">
                <div className="flex items-start gap-2">
                  <Users className="mt-0.5 size-4 text-[var(--hos-primary)]" />
                  <div className="min-w-0 flex-1">
                    <h2 className="m-0 text-lg font-bold">{selected.name}</h2>
                    <p className="m-0 text-xs text-[var(--hos-ink-3)]">
                      {selected.phone} · tip points {selected.tipPoints} · basic{" "}
                      {formatNu(selected.basicBtn)}
                    </p>
                  </div>
                  <Badge tone={selected.active ? "success" : "muted"}>
                    {selected.role.replaceAll("_", " ")}
                  </Badge>
                </div>
                <div className="hos-cell mt-3 grid grid-cols-3 gap-2 rounded-xl p-3 text-center text-[10px]">
                  <div>
                    <div className="text-[var(--hos-ink-3)]">Month punches</div>
                    <strong className="text-sm tabular-nums">{staffOps.monthPunches}</strong>
                  </div>
                  <div>
                    <div className="text-[var(--hos-ink-3)]">Late</div>
                    <strong
                      className={`text-sm tabular-nums ${
                        staffOps.lateCount > 0 ? "text-[var(--hos-ruby)]" : ""
                      }`}
                    >
                      {staffOps.lateCount}
                    </strong>
                  </div>
                  <div>
                    <div className="text-[var(--hos-ink-3)]">Last punch</div>
                    <strong className="text-[10px] tabular-nums">
                      {staffOps.last
                        ? new Date(staffOps.last.punchedAtIso).toLocaleString(
                            undefined,
                            { dateStyle: "short", timeStyle: "short" },
                          )
                        : "—"}
                    </strong>
                  </div>
                </div>
                <label className="mt-3 grid gap-1 text-xs font-medium">
                  Reset PIN
                  <input
                    value={newPin}
                    onChange={(e) =>
                      setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    maxLength={4}
                    inputMode="numeric"
                    className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 tracking-[0.3em]"
                  />
                </label>
                <Button
                  className="mt-2"
                  size="sm"
                  onClick={() => {
                    start(() => {
                      const res = saveStaffPin(selected.id, newPin);
                      if (!res.ok) {
                        toast.error("PIN not saved", { description: res.error });
                        return;
                      }
                      toast.success(`PIN updated for ${selected.name}`);
                    });
                  }}
                >
                  Save PIN
                </Button>
              </GlassPanel>
              <GlassPanel className="p-4">
                <div className="hos-cell rounded-xl p-3 text-xs">
                  <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">
                    Salary slip preview · {periodYm}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <span>Tip share</span>
                    <span className="text-right font-mono">{formatNu(selectedShare)}</span>
                    <span>NPPF 11%</span>
                    <span className="text-right font-mono">
                      {formatNu(slip.nppfEmployeeBtn)}
                    </span>
                    <span>GIS</span>
                    <span className="text-right font-mono">{formatNu(slip.gisBtn)}</span>
                    <span className="font-semibold">Net pay</span>
                    <span className="text-right font-mono font-bold text-[var(--hos-emerald)]">
                      {formatNu(slip.netPayBtn)}
                    </span>
                  </div>
                </div>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    toast.success("Salary slip ready", {
                      description: `${slip.name} · net ${formatNu(slip.netPayBtn)}`,
                    })
                  }
                >
                  <Printer className="mr-1.5 inline size-3.5" />
                  Print salary slip
                </Button>
              </GlassPanel>
            </div>
          </div>
        ) : null}

        {tab === "biometric" ? (
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <GlassPanel className="flex flex-col gap-3 p-4">
              <strong className="flex items-center gap-1.5 text-sm">
                <Fingerprint className="size-4 text-[var(--hos-primary)]" />
                Paste ATTLOG body
              </strong>
              <textarea
                value={attlogPaste}
                onChange={(e) => setAttlogPaste(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 font-mono text-[11px]"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    start(() => {
                      const n = ingestAttlog(attlogPaste);
                      toast.success(`Ingested ${n} punch(es)`);
                    });
                  }}
                >
                  Parse ATTLOG
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    start(async () => {
                      const res = await refreshPunchesFromApi();
                      if (!res.ok) {
                        toast.error(res.error);
                        return;
                      }
                      toast.success(`Loaded ${res.count} punch(es) from API`);
                    });
                  }}
                >
                  Refresh from ADMS DB
                </Button>
              </div>
              {unmatchedCodes.length > 0 ? (
                <div className="hos-cell rounded-xl border border-[var(--hos-ruby)]/30 p-3 text-xs">
                  <div className="flex items-center gap-1 font-semibold text-[var(--hos-ruby)]">
                    <UserX className="size-3.5" />
                    Unmatched device codes
                  </div>
                  <p className="m-0 mt-1 text-[var(--hos-ink-3)]">
                    {unmatchedCodes.join(", ")}
                  </p>
                  <label className="mt-2 grid gap-1 text-[10px] font-medium">
                    Map code → staff
                    <div className="flex gap-1">
                      <input
                        value={mapCode}
                        onChange={(e) => setMapCode(e.target.value)}
                        placeholder="999"
                        className="min-w-0 flex-1 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-surface)] px-2 py-1.5 font-mono"
                      />
                      <select
                        value={mapStaffId}
                        onChange={(e) => setMapStaffId(e.target.value)}
                        className="min-w-0 flex-[2] rounded-lg border border-[var(--hos-line)] bg-[var(--hos-surface)] px-2 py-1.5"
                      >
                        {hrStaff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.employeeCode})
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2 w-full"
                    onClick={() => {
                      const code = mapCode.trim() || unmatchedCodes[0]!;
                      const res = remapEmployeeCode(code, mapStaffId);
                      if (!res.ok) {
                        toast.error("Mapping failed", { description: res.error });
                        return;
                      }
                      toast.success(`Mapped code ${code}`, {
                        description: `${res.updated} punch row(s) updated`,
                      });
                      setMapCode("");
                    }}
                  >
                    Fix mapping
                  </Button>
                </div>
              ) : null}
              {lateClusters.length > 0 ? (
                <div className="hos-cell rounded-xl p-3 text-xs">
                  <div className="flex items-center gap-1 font-semibold text-[var(--hos-brass)]">
                    <Clock className="size-3.5" />
                    Late clusters (≥3 staff / day)
                  </div>
                  <ul className="m-0 mt-2 list-none space-y-1 p-0">
                    {lateClusters.slice(0, 5).map((c) => (
                      <li key={c.date} className="flex justify-between tabular-nums">
                        <span>{c.date}</span>
                        <Badge tone="vip">{c.count} late</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </GlassPanel>
            <GlassPanel className="overflow-x-auto p-3.5">
              {punches.length === 0 ? (
                <EmptyState title="No punches yet" description="Paste ATTLOG or wait for ZK push." />
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                      <th className="px-2 py-2">Staff</th>
                      <th className="px-2 py-2">Code</th>
                      <th className="px-2 py-2">Punched</th>
                      <th className="px-2 py-2 text-right">Late</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--hos-line)]">
                    {punches.slice(0, 40).map((p) => {
                      const unmatched = p.staffName.startsWith("Code ");
                      return (
                        <tr
                          key={p.id}
                          className={unmatched ? "bg-[rgba(239,68,68,0.06)]" : undefined}
                        >
                          <td className="px-2 py-2 font-semibold">
                            {unmatched ? (
                              <span className="flex items-center gap-1 text-[var(--hos-ruby)]">
                                <AlertTriangle className="size-3" />
                                {p.staffName}
                              </span>
                            ) : (
                              p.staffName
                            )}
                          </td>
                          <td className="px-2 py-2 font-mono">{p.employeeCode}</td>
                          <td className="px-2 py-2 tabular-nums">
                            {new Date(p.punchedAtIso).toLocaleString()}
                          </td>
                          <td className="px-2 py-2 text-right">
                            {p.lateMinutes > 0 ? (
                              <Badge tone="vip">{p.lateMinutes}m</Badge>
                            ) : (
                              <span className="text-[var(--hos-ink-3)]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {!reduce && punches.length > 0 ? (
                <motion.p
                  className="mt-2 text-[11px] text-[var(--hos-ink-3)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Showing latest 40 of {punches.length}
                </motion.p>
              ) : null}
            </GlassPanel>
          </div>
        ) : null}

        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #hos-tip-pool-print, #hos-tip-pool-print * { visibility: visible !important; }
            #hos-tip-pool-print {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: white !important;
              color: black !important;
            }
          }
        `}</style>
      </div>
    </ModuleFrame>
  );
}
