import { create } from "zustand";
import {
  assertCashBillHasAdvance,
  buildSalarySlip,
  canIssueCashAdvance,
  daysWorkedFromPunches,
  distributeScTipPool,
  lateMinutesForPunch,
  maskPartnerCalendar,
  parseAttlogBody,
  pickShiftForPunch,
  reconcileCashAdvance,
  type CashAdvance,
  type MaskedPartnerCell,
  type PartnerCalendarCell,
} from "@hos-v2/domain";
import { formatNu, useFrontOfficeStore } from "./front-office-store";
import { useFnbStore } from "./fnb-store";
import {
  type PurchaseBill,
  type PurchaseCategoryId,
  type PurchasePaymentMode,
  suggestPurchaseJournalNo,
  useFiscalStore,
} from "./fiscal-store";
import { parseBankStatementText } from "./bank-parsers";
import {
  apiGet,
  isOpsDbUnavailable,
  newIdempotencyKey,
  runCommand,
  sessionPropertyId,
} from "./api";
import {
  mondayOfWeek,
  seedRotaForWeek,
  seedSalaryAdvances,
  seedStaffRemarks,
  type RotaSlot,
  type SalaryAdvanceRow,
  type StaffRemark,
} from "./hr-payroll";

export type { RotaSlot, SalaryAdvanceRow, StaffRemark };

export type DrawerShift = {
  id: string;
  openedAt: string;
  openingFloatBtn: number;
  expectedBalanceBtn: number;
  status: "open" | "closed";
};

export type DrawerMovement = {
  id: string;
  shiftId: string;
  kind: string;
  amountBtn: number;
  direction: "out" | "in";
  note: string;
  at: string;
};

export type AdvanceRow = CashAdvance & {
  purpose: string;
  issuedAt: string;
  issuedToName: string;
};

export type PunchRow = {
  id: string;
  employeeCode: string;
  staffName: string;
  punchedAtIso: string;
  lateMinutes: number;
  rawLine: string;
};

export type HrStaffRow = {
  id: string;
  name: string;
  dept: string;
  role: string;
  employeeCode: string;
  tipPoints: number;
  basicBtn: number;
  active: boolean;
  pin: string;
  phone: string;
};

export type UtilityMeter = {
  id: string;
  kind: "electricity" | "water" | "telecom" | "waste";
  consumerNo: string;
  label: string;
  lastUnits: number;
  lastBillBtn: number;
  dueDate: string;
};

export type AmcContract = {
  id: string;
  assetKind: string;
  vendorName: string;
  endsOn: string;
  alertDays: number;
};

export type BankLine = {
  id: string;
  bankCode: "bob" | "bnb" | "drukpnb";
  txnDate: string;
  description: string;
  amountBtn: number;
  direction: "in" | "out";
  status: "open" | "matched";
};

export type LockedTipPoolRun = {
  periodYm: string;
  lockedAt: string;
  poolBtn: number;
  totalPointDays: number;
  lines: Array<{
    staffId: string;
    name: string;
    tipPoints: number;
    daysWorked: number;
    shareBtn: number;
  }>;
};

type EnterpriseState = {
  shift: DrawerShift;
  movements: DrawerMovement[];
  advances: AdvanceRow[];
  punches: PunchRow[];
  hrStaff: HrStaffRow[];
  meters: UtilityMeter[];
  amc: AmcContract[];
  bankLines: BankLine[];
  /** ZK device employee codes mapped to HR staff when codes differ from roster. */
  employeeCodeMap: Record<string, string>;
  lockedTipPools: LockedTipPoolRun[];
  salaryAdvances: SalaryAdvanceRow[];
  rotaSlots: RotaSlot[];
  staffRemarks: StaffRemark[];
  issueSalaryAdvance: (input: {
    staffId: string;
    amountBtn: number;
    reason: string;
    periodYm: string;
  }) => { ok: true; advance: SalaryAdvanceRow } | { ok: false; error: string };
  markSalaryAdvanceDeducted: (
    advanceId: string,
  ) => { ok: true } | { ok: false; error: string };
  setRotaShift: (input: {
    staffId: string;
    date: string;
    shiftCode: RotaSlot["shiftCode"];
  }) => { ok: true; slot: RotaSlot } | { ok: false; error: string };
  addStaffRemark: (input: {
    staffId: string;
    category: StaffRemark["category"];
    body: string;
    author?: string;
  }) => { ok: true; remark: StaffRemark } | { ok: false; error: string };
  saveStaffPin: (
    staffId: string,
    pin: string,
  ) => { ok: true } | { ok: false; error: string };
  lockTipPool: (
    periodYm: string,
  ) => { ok: true; lock: LockedTipPoolRun } | { ok: false; error: string };
  getLockedTipPool: (periodYm: string) => LockedTipPoolRun | null;
  remapEmployeeCode: (
    employeeCode: string,
    staffId: string,
  ) => { ok: true; updated: number } | { ok: false; error: string };
  issueAdvance: (input: {
    amountBtn: number;
    issuedToName: string;
    purpose?: string;
  }) => { ok: true; advance: AdvanceRow } | { ok: false; error: string };
  /** Postgres via API only — hard-law; no local_demo success. */
  issueAdvanceRemote: (input: {
    amountBtn: number;
    issuedToName: string;
    purpose?: string;
  }) => Promise<
    | { ok: true; advance: AdvanceRow; persistence: "postgres" }
    | { ok: false; error: string }
  >;
  reconcileAdvance: (input: {
    advanceId: string;
    spentBtn: number;
    changeReturnedBtn: number;
  }) => { ok: true; tillCreditBtn: number } | { ok: false; error: string };
  reconcileAdvanceRemote: (input: {
    advanceId: string;
    spentBtn: number;
    changeReturnedBtn: number;
  }) => Promise<
    | { ok: true; tillCreditBtn: number; persistence: "postgres" }
    | { ok: false; error: string }
  >;
  refreshPunchesFromApi: () => Promise<
    { ok: true; count: number } | { ok: false; error: string }
  >;
  runTipPoolRemote: (periodYm: string) => Promise<
    | {
        ok: true;
        persistence: "postgres";
        poolBtn: number;
        totalPointDays: number;
        lines: Array<{
          staffId: string;
          name: string;
          tipPoints: number;
          daysWorked: number;
          shareBtn: number;
        }>;
        runId?: string;
      }
    | { ok: false; error: string }
  >;
  postBillWithCashLaw: (input: {
    billNo: string;
    billDate: string;
    supplierName: string;
    category: PurchaseCategoryId;
    taxableBtn: number;
    gstBtn: number;
    nonTaxableBtn: number;
    paymentMode: PurchasePaymentMode;
    advanceId: string | null;
    journalNo?: string;
    lines?: import("./fiscal-store").PurchaseLine[];
  }) => { ok: true; bill: PurchaseBill } | { ok: false; error: string };
  ingestAttlog: (raw: string) => number;
  runTipPool: (periodYm: string) => {
    poolBtn: number;
    totalPointDays: number;
    lines: Array<{
      staffId: string;
      name: string;
      tipPoints: number;
      daysWorked: number;
      shareBtn: number;
    }>;
  };
  salaryPreview: (
    staffId: string,
    tipShareBtn: number,
  ) => {
    name: string;
    nppfEmployeeBtn: number;
    gisBtn: number;
    citBtn: number;
    netPayBtn: number;
    basicBtn: number;
  };
  partnerMaskedCells: (viewerAgentId: string) => MaskedPartnerCell[];
  matchBankLine: (lineId: string) => void;
  matchBankLineRemote: (input: {
    statementLineId: string;
    matchKind:
      | "folio_payment"
      | "procurement_advance"
      | "journal"
      | "manual"
      | "mbob_qr";
    matchEntityId: string;
    amountBtn: number;
  }) => Promise<
    | { ok: true; matchId: string; persistence: "postgres" }
    | { ok: false; error: string }
  >;
  pushBankStatementRemote: (input: {
    bankCode: "bob" | "bnb" | "drukpnb";
    accountLabel?: string;
  }) => Promise<
    | { ok: true; statementId: string; persistence: "postgres" }
    | { ok: false; error: string }
  >;
  ingestBankStatementText: (input: {
    bankCode: "bob" | "bnb" | "drukpnb";
    text: string;
  }) => { ok: true; lineCount: number; warnings: string[] } | { ok: false; error: string };
  ingestBankStatementRemote: (input: {
    bankCode: "bob" | "bnb" | "drukpnb";
    text: string;
    accountLabel?: string;
  }) => Promise<
    | {
        ok: true;
        lineCount: number;
        warnings: string[];
        statementId: string;
        persistence: "postgres";
      }
    | { ok: false; error: string }
  >;
  recordUtilityBill: (meterId: string, amountBtn: number, units: number) => void;
};

const SHIFTS = [
  { id: "m", code: "morning", startTime: "08:00", endTime: "16:00", graceMinutes: 10 },
  { id: "e", code: "evening", startTime: "14:00", endTime: "22:00", graceMinutes: 10 },
  { id: "n", code: "night", startTime: "22:00", endTime: "06:00", graceMinutes: 10 },
];

const HR_SEED: HrStaffRow[] = [
  { id: "st-1", name: "Karma Dorji", dept: "FO", role: "fo_manager", employeeCode: "101", tipPoints: 3, basicBtn: 35000, active: true, pin: "1234", phone: "+975-17610001" },
  { id: "st-2", name: "Pema Choden", dept: "FO", role: "fo_agent", employeeCode: "102", tipPoints: 2, basicBtn: 22000, active: true, pin: "2222", phone: "+975-17610002" },
  { id: "st-3", name: "Dema Lhamo", dept: "HK", role: "hk_attendant", employeeCode: "201", tipPoints: 1.5, basicBtn: 18000, active: true, pin: "3333", phone: "+975-17610003" },
  { id: "st-4", name: "Sonam Tobgay", dept: "F&B", role: "waiter", employeeCode: "301", tipPoints: 1.5, basicBtn: 18000, active: true, pin: "4444", phone: "+975-17610004" },
  { id: "st-5", name: "Tashi Wangchuk", dept: "F&B", role: "chef", employeeCode: "302", tipPoints: 2, basicBtn: 28000, active: true, pin: "5555", phone: "+975-17610005" },
  { id: "st-6", name: "Dechen Zangmo", dept: "Kitchen", role: "dishwasher", employeeCode: "303", tipPoints: 1, basicBtn: 15000, active: true, pin: "6666", phone: "+975-17610006" },
];

function seedPunches(): PunchRow[] {
  const ym = new Date().toISOString().slice(0, 7);
  const rows: PunchRow[] = [];
  for (const s of HR_SEED) {
    for (let d = 1; d <= 12; d++) {
      const day = `${ym}-${String(d).padStart(2, "0")}`;
      const iso = `${day}T08:05:00+06:00`;
      rows.push({
        id: `seed-${s.employeeCode}-${day}`,
        employeeCode: s.employeeCode,
        staffName: s.name,
        punchedAtIso: iso,
        lateMinutes: 0,
        rawLine: `${s.employeeCode}\t${day} 08:05:00\t0\t1`,
      });
    }
  }
  return rows;
}

export const useEnterpriseOpsStore = create<EnterpriseState>((set, get) => ({
  shift: {
    id: "shift-live",
    openedAt: new Date().toISOString(),
    openingFloatBtn: 48250,
    expectedBalanceBtn: 48250,
    status: "open",
  },
  movements: [],
  advances: [],
  // Punches / bank lines: empty until API hydrate — no demo SoT (T0/T6).
  punches: import.meta.env.DEV && String(import.meta.env.VITE_OPS_SEED ?? "") === "1"
    ? seedPunches()
    : [],
  hrStaff: HR_SEED,
  meters: [
    { id: "m-bpc", kind: "electricity", consumerNo: "BPC-184220", label: "Main BPC meter", lastUnits: 12480, lastBillBtn: 42850, dueDate: "2026-11-20" },
    { id: "m-water", kind: "water", consumerNo: "TW-9921", label: "Municipal water", lastUnits: 320, lastBillBtn: 4100, dueDate: "2026-11-15" },
    { id: "m-fiber", kind: "telecom", consumerNo: "TASHI-7781", label: "TashiCell leased line", lastUnits: 1, lastBillBtn: 8500, dueDate: "2026-11-10" },
  ],
  amc: [
    { id: "amc-1", assetKind: "Lift", vendorName: "Schindler Bhutan", endsOn: "2026-12-15", alertDays: 45 },
    { id: "amc-2", assetKind: "Generator", vendorName: "Kirloskar Service", endsOn: "2027-03-01", alertDays: 45 },
    { id: "amc-3", assetKind: "Boiler", vendorName: "Himalayan Mech", endsOn: "2026-11-25", alertDays: 45 },
  ],
  bankLines: [],
  employeeCodeMap: {},
  lockedTipPools: [],
  salaryAdvances: seedSalaryAdvances(HR_SEED),
  rotaSlots: seedRotaForWeek(HR_SEED, mondayOfWeek()),
  staffRemarks: seedStaffRemarks(HR_SEED),

  issueSalaryAdvance: ({ staffId, amountBtn, reason, periodYm }) => {
    const staff = get().hrStaff.find((s) => s.id === staffId);
    if (!staff) return { ok: false, error: "STAFF_NOT_FOUND" };
    if (!(amountBtn > 0)) return { ok: false, error: "AMOUNT_MUST_BE_POSITIVE" };
    if (!reason.trim()) return { ok: false, error: "REASON_REQUIRED" };
    if (!/^\d{4}-\d{2}$/.test(periodYm)) {
      return { ok: false, error: "PERIOD_YM_INVALID" };
    }
    const advance: SalaryAdvanceRow = {
      id: crypto.randomUUID(),
      staffId,
      staffName: staff.name,
      amountBtn: Math.round(amountBtn * 100) / 100,
      issuedAt: new Date().toISOString(),
      reason: reason.trim(),
      status: "open",
      periodYm,
    };
    set((s) => ({ salaryAdvances: [advance, ...s.salaryAdvances] }));
    return { ok: true, advance };
  },

  markSalaryAdvanceDeducted: (advanceId) => {
    const hit = get().salaryAdvances.find((a) => a.id === advanceId);
    if (!hit) return { ok: false, error: "ADVANCE_NOT_FOUND" };
    if (hit.status === "written_off") {
      return { ok: false, error: "ADVANCE_WRITTEN_OFF" };
    }
    set((s) => ({
      salaryAdvances: s.salaryAdvances.map((a) =>
        a.id === advanceId ? { ...a, status: "deducted" as const } : a,
      ),
    }));
    return { ok: true };
  },

  setRotaShift: ({ staffId, date, shiftCode }) => {
    const staff = get().hrStaff.find((s) => s.id === staffId);
    if (!staff) return { ok: false, error: "STAFF_NOT_FOUND" };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ok: false, error: "DATE_INVALID" };
    }
    const times: Record<
      RotaSlot["shiftCode"],
      { startTime: string; endTime: string }
    > = {
      morning: { startTime: "08:00", endTime: "16:00" },
      evening: { startTime: "14:00", endTime: "22:00" },
      night: { startTime: "22:00", endTime: "06:00" },
      off: { startTime: "—", endTime: "—" },
    };
    const t = times[shiftCode];
    const existing = get().rotaSlots.find(
      (r) => r.staffId === staffId && r.date === date,
    );
    const slot: RotaSlot = {
      id: existing?.id ?? crypto.randomUUID(),
      staffId,
      staffName: staff.name,
      dept: staff.dept,
      date,
      shiftCode,
      startTime: t.startTime,
      endTime: t.endTime,
      note: existing?.note,
    };
    set((s) => ({
      rotaSlots: existing
        ? s.rotaSlots.map((r) => (r.id === existing.id ? slot : r))
        : [slot, ...s.rotaSlots],
    }));
    return { ok: true, slot };
  },

  addStaffRemark: ({ staffId, category, body, author = "Desk" }) => {
    const staff = get().hrStaff.find((s) => s.id === staffId);
    if (!staff) return { ok: false, error: "STAFF_NOT_FOUND" };
    if (!body.trim()) return { ok: false, error: "REMARK_REQUIRED" };
    const remark: StaffRemark = {
      id: crypto.randomUUID(),
      staffId,
      staffName: staff.name,
      at: new Date().toISOString(),
      author,
      category,
      body: body.trim(),
    };
    set((s) => ({ staffRemarks: [remark, ...s.staffRemarks] }));
    return { ok: true, remark };
  },

  saveStaffPin: (staffId, pin) => {
    if (!/^\d{4}$/.test(pin)) {
      return { ok: false, error: "PIN must be exactly 4 digits" };
    }
    const hit = get().hrStaff.some((s) => s.id === staffId);
    if (!hit) return { ok: false, error: "STAFF_NOT_FOUND" };
    set((s) => ({
      hrStaff: s.hrStaff.map((st) => (st.id === staffId ? { ...st, pin } : st)),
    }));
    return { ok: true };
  },

  getLockedTipPool: (periodYm) =>
    get().lockedTipPools.find((l) => l.periodYm === periodYm) ?? null,

  lockTipPool: (periodYm) => {
    if (get().lockedTipPools.some((l) => l.periodYm === periodYm)) {
      return { ok: false, error: "TIP_POOL_ALREADY_LOCKED_FOR_PERIOD" };
    }
    const run = get().runTipPool(periodYm);
    const lock: LockedTipPoolRun = {
      periodYm,
      lockedAt: new Date().toISOString(),
      poolBtn: run.poolBtn,
      totalPointDays: run.totalPointDays,
      lines: run.lines,
    };
    set((s) => ({ lockedTipPools: [lock, ...s.lockedTipPools] }));
    return { ok: true, lock };
  },

  remapEmployeeCode: (employeeCode, staffId) => {
    const staff = get().hrStaff.find((s) => s.id === staffId);
    if (!staff) return { ok: false, error: "STAFF_NOT_FOUND" };
    const code = employeeCode.trim();
    if (!code) return { ok: false, error: "EMPLOYEE_CODE_REQUIRED" };
    let updated = 0;
    set((s) => {
      const punches = s.punches.map((p) => {
        if (p.employeeCode !== code) return p;
        updated += 1;
        return { ...p, staffName: staff.name };
      });
      return {
        employeeCodeMap: { ...s.employeeCodeMap, [code]: staffId },
        punches,
      };
    });
    return { ok: true, updated };
  },

  issueAdvance: ({ amountBtn, issuedToName, purpose = "cfm_market" }) => {
    const fiscal = useFiscalStore.getState();
    const gate = canIssueCashAdvance({
      amountBtn,
      tillBalanceBtn: fiscal.tillBalance,
    });
    if (!gate.ok) return { ok: false, error: gate.error };
    const id = crypto.randomUUID();
    const advance: AdvanceRow = {
      id,
      amountBtn,
      spentBtn: 0,
      changeReturnedBtn: 0,
      status: "open",
      purpose,
      issuedAt: new Date().toISOString(),
      issuedToName,
    };
    useFiscalStore.setState({ tillBalance: gate.tillAfterBtn });
    set((s) => ({
      advances: [advance, ...s.advances],
      shift: { ...s.shift, expectedBalanceBtn: gate.tillAfterBtn },
      movements: [
        {
          id: crypto.randomUUID(),
          shiftId: s.shift.id,
          kind: "procurement_advance",
          amountBtn,
          direction: "out",
          note: `Advance to ${issuedToName} · ${purpose}`,
          at: new Date().toISOString(),
        },
        ...s.movements,
      ],
    }));
    return { ok: true, advance };
  },

  issueAdvanceRemote: async ({ amountBtn, issuedToName, purpose = "cfm_market" }) => {
    const fiscal = useFiscalStore.getState();
    const gate = canIssueCashAdvance({
      amountBtn,
      tillBalanceBtn: fiscal.tillBalance,
    });
    if (!gate.ok) return { ok: false, error: gate.error };

    const api = await runCommand<{
      advanceId: string;
      tillAfterBtn: number;
      advance: CashAdvance & { purpose?: string };
    }>("procurement.issueAdvance", {
      amountBtn,
      tillBalanceBtn: fiscal.tillBalance,
      purpose,
      idempotencyKey: newIdempotencyKey(),
    });

    if (!api.ok) {
      // Hard-law: never silent memory fallback for CFM advances.
      return { ok: false, error: api.error };
    }

    const advance: AdvanceRow = {
      id: api.data.advanceId,
      amountBtn: api.data.advance.amountBtn,
      spentBtn: api.data.advance.spentBtn,
      changeReturnedBtn: api.data.advance.changeReturnedBtn,
      status: api.data.advance.status,
      purpose,
      issuedAt: new Date().toISOString(),
      issuedToName,
    };
    useFiscalStore.setState({ tillBalance: api.data.tillAfterBtn });
    set((s) => ({
      advances: [advance, ...s.advances.filter((a) => a.id !== advance.id)],
      shift: { ...s.shift, expectedBalanceBtn: api.data.tillAfterBtn },
      movements: [
        {
          id: crypto.randomUUID(),
          shiftId: s.shift.id,
          kind: "procurement_advance",
          amountBtn,
          direction: "out",
          note: `Advance to ${issuedToName} · ${purpose} · postgres`,
          at: new Date().toISOString(),
        },
        ...s.movements,
      ],
    }));
    return { ok: true, advance, persistence: "postgres" };
  },

  reconcileAdvance: ({ advanceId, spentBtn, changeReturnedBtn }) => {
    const advance = get().advances.find((a) => a.id === advanceId);
    if (!advance) return { ok: false, error: "ADVANCE_NOT_FOUND" };
    const rec = reconcileCashAdvance({
      advance,
      spentBtn,
      changeReturnedBtn,
    });
    if (!rec.ok) return { ok: false, error: rec.error };
    const till = useFiscalStore.getState().tillBalance;
    const tillAfter = Math.round((till + rec.tillCreditBtn) * 100) / 100;
    useFiscalStore.setState({ tillBalance: tillAfter });
    set((s) => ({
      advances: s.advances.map((a) =>
        a.id === advanceId ? { ...a, ...rec.advance } : a,
      ),
      shift: { ...s.shift, expectedBalanceBtn: tillAfter },
      movements: [
        {
          id: crypto.randomUUID(),
          shiftId: s.shift.id,
          kind: "advance_change_return",
          amountBtn: rec.tillCreditBtn,
          direction: "in",
          note: `Change returned · advance ${advanceId.slice(0, 8)}`,
          at: new Date().toISOString(),
        },
        ...s.movements,
      ],
    }));
    return { ok: true, tillCreditBtn: rec.tillCreditBtn };
  },

  reconcileAdvanceRemote: async ({ advanceId, spentBtn, changeReturnedBtn }) => {
    const advance = get().advances.find((a) => a.id === advanceId);
    if (!advance) return { ok: false, error: "ADVANCE_NOT_FOUND" };
    const rec = reconcileCashAdvance({
      advance,
      spentBtn,
      changeReturnedBtn,
    });
    if (!rec.ok) return { ok: false, error: rec.error };

    const api = await runCommand<{ tillCreditBtn: number }>(
      "procurement.reconcileAdvance",
      {
        advanceId,
        spentBtn,
        changeReturnedBtn,
        idempotencyKey: newIdempotencyKey(),
      },
    );
    if (!api.ok) {
      // Hard-law: never silent memory fallback for CFM reconcile.
      return { ok: false, error: api.error };
    }

    const till = useFiscalStore.getState().tillBalance;
    const tillAfter = Math.round((till + api.data.tillCreditBtn) * 100) / 100;
    useFiscalStore.setState({ tillBalance: tillAfter });
    set((s) => ({
      advances: s.advances.map((a) =>
        a.id === advanceId
          ? {
              ...a,
              status: "reconciled",
              spentBtn,
              changeReturnedBtn,
            }
          : a,
      ),
      shift: { ...s.shift, expectedBalanceBtn: tillAfter },
      movements: [
        {
          id: crypto.randomUUID(),
          shiftId: s.shift.id,
          kind: "advance_change_return",
          amountBtn: api.data.tillCreditBtn,
          direction: "in",
          note: `Change returned · advance ${advanceId.slice(0, 8)} · postgres`,
          at: new Date().toISOString(),
        },
        ...s.movements,
      ],
    }));
    return {
      ok: true,
      tillCreditBtn: api.data.tillCreditBtn,
      persistence: "postgres",
    };
  },

  refreshPunchesFromApi: async () => {
    try {
      const body = await apiGet<{
        ok: boolean;
        punches?: Array<{
          employeeCode: string;
          punchedAtIso: string;
          lateMinutes: number;
          rawLine: string;
        }>;
        error?: string;
      }>(`/v1/hr/punches?propertyId=${sessionPropertyId()}`);
      if (!body.ok || !body.punches) {
        return { ok: false, error: body.error ?? "PUNCHES_UNAVAILABLE" };
      }
      const staff = get().hrStaff;
      const codeMap = get().employeeCodeMap;
      const rows: PunchRow[] = body.punches.map((p) => {
        const mappedStaffId = codeMap[p.employeeCode];
        const hit =
          (mappedStaffId
            ? staff.find((s) => s.id === mappedStaffId)
            : undefined) ??
          staff.find((s) => s.employeeCode === p.employeeCode);
        return {
          id: crypto.randomUUID(),
          employeeCode: p.employeeCode,
          staffName: hit?.name ?? `Code ${p.employeeCode}`,
          punchedAtIso: p.punchedAtIso,
          lateMinutes: p.lateMinutes,
          rawLine: p.rawLine,
        };
      });
      set({ punches: rows.slice(0, 800) });
      return { ok: true, count: rows.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[enterprise-ops] refreshPunchesFromApi", { err: msg });
      return { ok: false, error: "API_UNREACHABLE" };
    }
  },

  runTipPoolRemote: async (periodYm) => {
    const local = get().runTipPool(periodYm);
    const api = await runCommand<{
      runId: string;
      totalPointDays: number;
      lines: Array<{
        staffId: string;
        tipPoints: number;
        daysWorked: number;
        shareBtn: number;
      }>;
    }>("hr.runScTipPool", {
      periodYm,
      poolBtn: local.poolBtn,
      staff: local.lines.map((l) => ({
        staffId: l.staffId,
        tipPoints: l.tipPoints,
        daysWorked: l.daysWorked,
      })),
      idempotencyKey: newIdempotencyKey(),
    });
    if (!api.ok) {
      // Hard-law: tip pool requires Postgres; never claim success via local_demo.
      return { ok: false, error: api.error };
    }
    const staff = get().hrStaff;
    return {
      ok: true,
      persistence: "postgres",
      poolBtn: local.poolBtn,
      totalPointDays: api.data.totalPointDays,
      runId: api.data.runId,
      lines: api.data.lines.map((l) => ({
        ...l,
        name: staff.find((s) => s.id === l.staffId)?.name ?? l.staffId,
      })),
    };
  },

  postBillWithCashLaw: (input) => {
    const advance = input.advanceId
      ? get().advances.find((a) => a.id === input.advanceId) ?? null
      : null;
    const gate = assertCashBillHasAdvance({
      paymentMode: input.paymentMode,
      advanceId: input.advanceId,
      advance,
    });
    if (!gate.ok) return { ok: false, error: gate.error };

    const cleanLines = (input.lines ?? [])
      .filter((l) => l.skuId && l.qty > 0)
      .map((l) => ({
        skuId: l.skuId,
        name: l.name.trim(),
        qty: Math.max(0, Number(l.qty) || 0),
        uom: l.uom.trim() || "pc",
        unitCost: Math.max(0, Number(l.unitCost) || 0),
      }));

    if (input.paymentMode === "cash" && advance) {
      const taxable = Math.max(0, input.taxableBtn);
      const gst = Math.max(0, input.gstBtn);
      const nonTax = Math.max(0, input.nonTaxableBtn);
      const grand = Math.round((taxable + gst + nonTax) * 100) / 100;
      if (grand <= 0) return { ok: false, error: "Grand total must be greater than zero" };
      const bill: PurchaseBill = {
        id: crypto.randomUUID(),
        billNo: input.billNo.trim(),
        billDate: input.billDate,
        supplierName: input.supplierName.trim(),
        category: input.category,
        taxableBtn: taxable,
        gstBtn: gst,
        nonTaxableBtn: nonTax,
        grandTotalBtn: grand,
        paymentMode: "cash",
        journalNo:
          input.journalNo?.trim() ||
          suggestPurchaseJournalNo(
            useFiscalStore.getState().purchases,
            input.billDate,
          ),
        createdAt: new Date().toISOString(),
        lines: cleanLines.length ? cleanLines : undefined,
      };
      useFiscalStore.setState((s) => ({
        purchases: [bill, ...s.purchases],
      }));
      set((s) => ({
        advances: s.advances.map((a) =>
          a.id === advance.id
            ? {
                ...a,
                spentBtn: Math.round((a.spentBtn + grand) * 100) / 100,
              }
            : a,
        ),
      }));
      if (cleanLines.length) {
        void import("./inventory-store").then(({ useInventoryStore }) => {
          useInventoryStore.getState().receiveStock(cleanLines, bill.billNo);
        });
      }
      return { ok: true, bill };
    }

    const res = useFiscalStore.getState().addPurchaseBill({
      billNo: input.billNo,
      billDate: input.billDate,
      supplierName: input.supplierName,
      category: input.category,
      taxableBtn: input.taxableBtn,
      gstBtn: input.gstBtn,
      nonTaxableBtn: input.nonTaxableBtn,
      paymentMode: input.paymentMode,
      journalNo: input.journalNo,
      lines: cleanLines,
    });
    if (!res.ok) return res;
    return { ok: true, bill: res.bill };
  },

  ingestAttlog: (raw) => {
    const parsed = parseAttlogBody(raw);
    const staff = get().hrStaff;
    const codeMap = get().employeeCodeMap;
    const rows: PunchRow[] = [];
    for (const p of parsed) {
      const mappedStaffId = codeMap[p.employeeCode];
      const hit =
        (mappedStaffId
          ? staff.find((s) => s.id === mappedStaffId)
          : undefined) ??
        staff.find((s) => s.employeeCode === p.employeeCode);
      const shift = pickShiftForPunch(p.punchedAtIso, SHIFTS);
      const late = shift ? lateMinutesForPunch(p.punchedAtIso, shift) : 0;
      rows.push({
        id: crypto.randomUUID(),
        employeeCode: p.employeeCode,
        staffName: hit?.name ?? `Code ${p.employeeCode}`,
        punchedAtIso: p.punchedAtIso,
        lateMinutes: late,
        rawLine: p.rawLine,
      });
    }
    set((s) => ({ punches: [...rows, ...s.punches].slice(0, 800) }));
    return rows.length;
  },

  runTipPool: (periodYm) => {
    const fnb = useFnbStore.getState();
    const fo = useFrontOfficeStore.getState();
    const posSc = fnb.orders.reduce((s, o) => s + o.sc, 0);
    const roomSc = fo.stays
      .filter((st) => st.status === "checked_in" || st.status === "checked_out")
      .reduce((s, st) => s + st.nightlyNet * 0.1, 0);
    const poolBtn = Math.round((posSc + roomSc) * 100) / 100;
    const staff = get().hrStaff.filter((s) => s.active);
    const punches = get().punches;
    const inputs = staff.map((s) => ({
      staffId: s.id,
      tipPoints: s.tipPoints,
      daysWorked: Math.max(
        1,
        daysWorkedFromPunches(
          punches
            .filter((p) => p.employeeCode === s.employeeCode)
            .map((p) => p.punchedAtIso),
          periodYm,
        ),
      ),
    }));
    const result = distributeScTipPool(poolBtn, inputs);
    return {
      poolBtn,
      totalPointDays: result.totalPointDays,
      lines: result.lines.map((l) => ({
        ...l,
        name: staff.find((s) => s.id === l.staffId)?.name ?? l.staffId,
      })),
    };
  },

  salaryPreview: (staffId, tipShareBtn) => {
    const s = get().hrStaff.find((x) => x.id === staffId);
    if (!s) {
      return {
        name: "—",
        basicBtn: 0,
        nppfEmployeeBtn: 0,
        gisBtn: 0,
        citBtn: 0,
        netPayBtn: 0,
      };
    }
    return {
      name: s.name,
      basicBtn: s.basicBtn,
      ...buildSalarySlip({
        basicBtn: s.basicBtn,
        allowancesBtn: 2000,
        tipShareBtn,
        gisBtn: 150,
        citBtn: 0,
      }),
    };
  },

  partnerMaskedCells: (viewerAgentId) => {
    const fo = useFrontOfficeStore.getState();
    const cells: PartnerCalendarCell[] = fo.rooms.map((room) => {
      const stay = fo.stays.find(
        (s) =>
          s.roomId === room.id &&
          (s.status === "checked_in" || s.status === "confirmed"),
      );
      if (!stay) {
        return {
          stayDate: fo.businessDate,
          roomId: room.id,
          roomNumber: room.number,
          state: "free" as const,
          ownerAgentId: null,
          guestName: null,
          bookingRef: null,
          netRateBtn: 5600,
        };
      }
      return {
        stayDate: fo.businessDate,
        roomId: room.id,
        roomNumber: room.number,
        state: "occupied" as const,
        ownerAgentId: stay.agencyName ?? "walk-in",
        guestName: stay.guestName,
        bookingRef: stay.confirmationNo,
        netRateBtn: stay.nightlyNet,
      };
    });
    return maskPartnerCalendar(cells, viewerAgentId);
  },

  matchBankLine: (lineId) =>
    set((s) => ({
      bankLines: s.bankLines.map((l) =>
        l.id === lineId ? { ...l, status: "matched" } : l,
      ),
    })),

  matchBankLineRemote: async ({
    statementLineId,
    matchKind,
    matchEntityId,
    amountBtn,
  }) => {
    const api = await runCommand<{ matchId: string }>(
      "finance.matchBankStatementLine",
      {
        statementLineId,
        matchKind,
        matchEntityId,
        amountBtn,
        idempotencyKey: newIdempotencyKey(),
      },
    );
    if (!api.ok) return { ok: false, error: api.error };
    get().matchBankLine(statementLineId);
    return {
      ok: true,
      matchId: api.data.matchId,
      persistence: "postgres",
    };
  },

  pushBankStatementRemote: async ({ bankCode, accountLabel }) => {
    const labels: Record<"bob" | "bnb" | "drukpnb", string> = {
      bob: "BoB operating",
      bnb: "BNB operating",
      drukpnb: "DrukPNB operating",
    };
    const lines = get()
      .bankLines.filter((l) => l.bankCode === bankCode && l.status === "open")
      .map((l) => ({
        txnDate: l.txnDate,
        description: l.description,
        amountBtn: l.amountBtn,
        direction: l.direction,
      }));
    if (lines.length === 0) {
      return { ok: false, error: "NO_OPEN_LINES_FOR_BANK" };
    }
    const api = await runCommand<{ statementId: string }>(
      "finance.importBankStatement",
      {
        bankCode,
        accountLabel: accountLabel ?? labels[bankCode],
        statementDate: new Date().toISOString().slice(0, 10),
        sourceFilename: `desk-${bankCode}.csv`,
        lines,
        idempotencyKey: newIdempotencyKey(),
      },
    );
    if (!api.ok) return { ok: false, error: api.error };
    return {
      ok: true,
      statementId: api.data.statementId,
      persistence: "postgres",
    };
  },

  ingestBankStatementText: ({ bankCode, text }) => {
    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: "EMPTY_STATEMENT_TEXT" };
    const parsed = parseBankStatementText(bankCode, trimmed);
    if (parsed.lines.length === 0) {
      return { ok: false, error: "NO_LINES_PARSED" };
    }
    const stamped = parsed.lines.map((l) => ({
      id: crypto.randomUUID(),
      bankCode,
      txnDate: l.txnDate,
      description: l.description,
      amountBtn: l.amountBtn,
      direction: l.direction,
      status: "open" as const,
    }));
    set((s) => ({ bankLines: [...stamped, ...s.bankLines] }));
    return {
      ok: true,
      lineCount: stamped.length,
      warnings: parsed.warnings,
    };
  },

  ingestBankStatementRemote: async ({ bankCode, text, accountLabel }) => {
    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: "EMPTY_STATEMENT_TEXT" };

    const labels: Record<"bob" | "bnb" | "drukpnb", string> = {
      bob: "BoB operating",
      bnb: "BNB operating",
      drukpnb: "DrukPNB operating",
    };

    const parsed = await runCommand<{
      lines: Array<{
        txnDate: string;
        description: string;
        amountBtn: number;
        direction: "in" | "out";
        externalRef?: string;
      }>;
      warnings: string[];
    }>("finance.parseBankStatementText", { bankCode, text: trimmed });

    if (!parsed.ok) return { ok: false, error: parsed.error };
    if (parsed.data.lines.length === 0) {
      return { ok: false, error: "NO_LINES_PARSED" };
    }

    const statementDate =
      parsed.data.lines[0]?.txnDate ?? new Date().toISOString().slice(0, 10);

    const imported = await runCommand<{ statementId: string }>(
      "finance.importBankStatement",
      {
        bankCode,
        accountLabel: accountLabel ?? labels[bankCode],
        statementDate,
        sourceFilename: `desk-paste-${bankCode}.txt`,
        lines: parsed.data.lines,
        idempotencyKey: newIdempotencyKey(),
      },
    );

    if (!imported.ok) {
      return { ok: false, error: imported.error };
    }

    const stamped = parsed.data.lines.map((l) => ({
      id: crypto.randomUUID(),
      bankCode,
      txnDate: l.txnDate,
      description: l.description,
      amountBtn: l.amountBtn,
      direction: l.direction,
      status: "open" as const,
    }));

    set((s) => ({
      bankLines: [
        ...stamped,
        ...s.bankLines.filter((line) => line.bankCode !== bankCode),
      ],
    }));

    return {
      ok: true,
      lineCount: stamped.length,
      warnings: parsed.data.warnings,
      statementId: imported.data.statementId,
      persistence: "postgres",
    };
  },

  recordUtilityBill: (meterId, amountBtn, units) =>
    set((s) => ({
      meters: s.meters.map((m) =>
        m.id === meterId
          ? { ...m, lastBillBtn: amountBtn, lastUnits: units }
          : m,
      ),
    })),
}));

export { formatNu };
