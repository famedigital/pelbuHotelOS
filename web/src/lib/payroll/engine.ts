// Deterministic Bhutan payroll engine.
//
// Pure functions only — no framework, network, or DB imports — so the maths is
// fully unit/golden testable and a finalized run is exactly reproducible from
// its snapshotted rule set + inputs.
//
// References:
//   - Income Tax Act of Bhutan 2025 (PIT slabs, 10% surcharge, PF deductible)
//   - National Pension & Provident Fund (5% employee + 5% employer)
//   - Regulation on Working Conditions 2022 (overtime 1.5x, holiday premium)

export type PitBracket = {
  /** Upper bound of the slab in Nu; null = open-ended top slab. */
  upTo: number | null;
  /** Marginal rate applied within the slab (0..1). */
  rate: number;
};

export type PayrollRuleSet = {
  currency: string;
  pfEmployeeRate: number;
  pfEmployerRate: number;
  overtimeMultiplier: number;
  publicHolidayPremiumRate: number;
  nightPremiumRate: number;
  standardMonthlyHours: number;
  standardWorkingDays: number;
  pitBrackets: PitBracket[];
  pitSurchargeThreshold: number;
  pitSurchargeRate: number;
  annualizationFactor: number;
};

export type PayComponent = {
  code: string;
  label: string;
  amount: number;
  /** Whether the component is included in PIT taxable income. */
  taxable?: boolean;
};

export type PayrollItemInput = {
  /** Monthly basic wage in Nu (the PF + proration base). */
  basicWage: number;
  /** Additional recurring/one-off earnings (allowances, bonuses). */
  earnings?: PayComponent[];
  /** Ad-hoc non-statutory deductions (advances, mess, damages). */
  deductions?: PayComponent[];
  overtimeHours?: number;
  publicHolidayHours?: number;
  nightHours?: number;
  /** Unpaid leave / loss-of-pay days deducted against basic. */
  unpaidLeaveDays?: number;
  /** Working days in the period used to prorate unpaid leave. */
  workingDays?: number;
  /** Leave encashment paid out (in days of basic). */
  leaveEncashmentDays?: number;
};

export type PayLineKind = "earning" | "deduction" | "employer_cost";

export type PayLine = {
  kind: PayLineKind;
  code: string;
  label: string;
  amount: number;
  taxable: boolean;
};

export type PayrollItemResult = {
  lines: PayLine[];
  gross: number;
  taxable: number;
  employeePf: number;
  employerPf: number;
  pit: number;
  otherDeductions: number;
  net: number;
  employerCost: number;
};

/** Bankers-free 2dp rounding consistent with the rest of the app (pricing.ts). */
export function round2(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Progressive PIT on an ANNUAL taxable income using marginal slabs.
 * Returns tax before surcharge.
 */
export function annualPitBeforeSurcharge(
  annualTaxable: number,
  brackets: PitBracket[],
): number {
  if (annualTaxable <= 0 || brackets.length === 0) return 0;
  let tax = 0;
  let lower = 0;
  for (const bracket of brackets) {
    const upper = bracket.upTo ?? Infinity;
    if (annualTaxable > lower) {
      const slabAmount = Math.min(annualTaxable, upper) - lower;
      if (slabAmount > 0) tax += slabAmount * bracket.rate;
    }
    lower = upper;
    if (annualTaxable <= upper) break;
  }
  return tax;
}

/** Annual PIT including the 10% surcharge when liability crosses the threshold. */
export function annualPit(
  annualTaxable: number,
  rules: PayrollRuleSet,
): number {
  const base = annualPitBeforeSurcharge(annualTaxable, rules.pitBrackets);
  const surcharge =
    base >= rules.pitSurchargeThreshold ? base * rules.pitSurchargeRate : 0;
  return base + surcharge;
}

/**
 * Compute a single staff member's payslip for one monthly period.
 * All amounts rounded to 2dp; every figure is derivable from the inputs.
 */
export function computePayrollItem(
  input: PayrollItemInput,
  rules: PayrollRuleSet,
): PayrollItemResult {
  const lines: PayLine[] = [];
  const basic = Math.max(0, input.basicWage || 0);
  const hourlyRate =
    rules.standardMonthlyHours > 0 ? basic / rules.standardMonthlyHours : 0;
  const dailyRate =
    rules.standardWorkingDays > 0 ? basic / rules.standardWorkingDays : 0;

  // --- Earnings ---
  lines.push({
    kind: "earning",
    code: "basic",
    label: "Basic wage",
    amount: round2(basic),
    taxable: true,
  });

  for (const earning of input.earnings ?? []) {
    const amount = round2(Math.max(0, earning.amount || 0));
    if (amount === 0) continue;
    lines.push({
      kind: "earning",
      code: earning.code,
      label: earning.label,
      amount,
      taxable: earning.taxable ?? true,
    });
  }

  const overtimeHours = Math.max(0, input.overtimeHours || 0);
  if (overtimeHours > 0 && hourlyRate > 0) {
    lines.push({
      kind: "earning",
      code: "overtime",
      label: `Overtime (${overtimeHours}h @ ${rules.overtimeMultiplier}x)`,
      amount: round2(overtimeHours * hourlyRate * rules.overtimeMultiplier),
      taxable: true,
    });
  }

  const holidayHours = Math.max(0, input.publicHolidayHours || 0);
  if (holidayHours > 0 && hourlyRate > 0 && rules.publicHolidayPremiumRate > 0) {
    lines.push({
      kind: "earning",
      code: "holiday_premium",
      label: `Public holiday premium (${holidayHours}h)`,
      amount: round2(
        holidayHours * hourlyRate * rules.publicHolidayPremiumRate,
      ),
      taxable: true,
    });
  }

  const nightHours = Math.max(0, input.nightHours || 0);
  if (nightHours > 0 && hourlyRate > 0 && rules.nightPremiumRate > 0) {
    lines.push({
      kind: "earning",
      code: "night_premium",
      label: `Night premium (${nightHours}h)`,
      amount: round2(nightHours * hourlyRate * rules.nightPremiumRate),
      taxable: true,
    });
  }

  const encashmentDays = Math.max(0, input.leaveEncashmentDays || 0);
  if (encashmentDays > 0 && dailyRate > 0) {
    lines.push({
      kind: "earning",
      code: "leave_encashment",
      label: `Leave encashment (${encashmentDays}d)`,
      amount: round2(encashmentDays * dailyRate),
      taxable: true,
    });
  }

  // --- Loss of pay (deduction against basic, reduces taxable) ---
  const unpaidDays = Math.max(0, input.unpaidLeaveDays || 0);
  const workingDays = Math.max(0, input.workingDays || rules.standardWorkingDays);
  let unpaidLeaveDeduction = 0;
  if (unpaidDays > 0 && workingDays > 0) {
    unpaidLeaveDeduction = round2((basic / workingDays) * unpaidDays);
    if (unpaidLeaveDeduction > 0) {
      lines.push({
        kind: "deduction",
        code: "loss_of_pay",
        label: `Loss of pay (${unpaidDays}d)`,
        amount: unpaidLeaveDeduction,
        taxable: true,
      });
    }
  }

  // --- Gross and taxable base ---
  const earningLines = lines.filter((l) => l.kind === "earning");
  const gross = round2(earningLines.reduce((sum, l) => sum + l.amount, 0));

  const taxableEarnings = round2(
    earningLines
      .filter((l) => l.taxable)
      .reduce((sum, l) => sum + l.amount, 0),
  );

  // --- Provident fund (NPPF) on basic wage ---
  const employeePf = round2(basic * rules.pfEmployeeRate);
  const employerPf = round2(basic * rules.pfEmployerRate);
  if (employeePf > 0) {
    lines.push({
      kind: "deduction",
      code: "pf_employee",
      label: `Provident fund (${(rules.pfEmployeeRate * 100).toFixed(1)}%)`,
      amount: employeePf,
      taxable: true,
    });
  }
  if (employerPf > 0) {
    lines.push({
      kind: "employer_cost",
      code: "pf_employer",
      label: `Employer PF (${(rules.pfEmployerRate * 100).toFixed(1)}%)`,
      amount: employerPf,
      taxable: false,
    });
  }

  // --- PIT (TDS) ---
  // Monthly taxable = taxable earnings less unpaid leave less deductible PF.
  const monthlyTaxable = Math.max(
    0,
    round2(taxableEarnings - unpaidLeaveDeduction - employeePf),
  );
  const annualTaxable = monthlyTaxable * rules.annualizationFactor;
  const pit = round2(
    annualPit(annualTaxable, rules) / rules.annualizationFactor,
  );
  if (pit > 0) {
    lines.push({
      kind: "deduction",
      code: "pit",
      label: "Income tax (TDS)",
      amount: pit,
      taxable: false,
    });
  }

  // --- Other deductions (advances etc.) ---
  let otherDeductions = 0;
  for (const deduction of input.deductions ?? []) {
    const amount = round2(Math.max(0, deduction.amount || 0));
    if (amount === 0) continue;
    otherDeductions = round2(otherDeductions + amount);
    lines.push({
      kind: "deduction",
      code: deduction.code,
      label: deduction.label,
      amount,
      taxable: false,
    });
  }

  const deductionTotal = round2(
    lines
      .filter((l) => l.kind === "deduction")
      .reduce((sum, l) => sum + l.amount, 0),
  );
  const net = round2(gross - deductionTotal);
  const employerCost = round2(gross + employerPf);

  return {
    lines,
    gross,
    taxable: monthlyTaxable,
    employeePf,
    employerPf,
    pit,
    otherDeductions,
    net,
    employerCost,
  };
}

/** Normalize a DB rule-set row (snake_case + jsonb) into the engine shape. */
export function ruleSetFromRow(row: {
  currency?: string | null;
  pf_employee_rate: number | string;
  pf_employer_rate: number | string;
  overtime_multiplier: number | string;
  public_holiday_premium_rate: number | string;
  night_premium_rate: number | string;
  standard_monthly_hours: number | string;
  standard_working_days: number | string;
  pit_brackets: unknown;
  pit_surcharge_threshold: number | string;
  pit_surcharge_rate: number | string;
  annualization_factor: number | string;
}): PayrollRuleSet {
  const num = (v: number | string) => Number(v);
  const brackets = Array.isArray(row.pit_brackets)
    ? (row.pit_brackets as Array<{ upTo: number | null; rate: number }>).map(
        (b) => ({ upTo: b.upTo ?? null, rate: Number(b.rate) }),
      )
    : [];
  return {
    currency: row.currency ?? "BTN",
    pfEmployeeRate: num(row.pf_employee_rate),
    pfEmployerRate: num(row.pf_employer_rate),
    overtimeMultiplier: num(row.overtime_multiplier),
    publicHolidayPremiumRate: num(row.public_holiday_premium_rate),
    nightPremiumRate: num(row.night_premium_rate),
    standardMonthlyHours: num(row.standard_monthly_hours),
    standardWorkingDays: num(row.standard_working_days),
    pitBrackets: brackets,
    pitSurchargeThreshold: num(row.pit_surcharge_threshold),
    pitSurchargeRate: num(row.pit_surcharge_rate),
    annualizationFactor: num(row.annualization_factor),
  };
}
