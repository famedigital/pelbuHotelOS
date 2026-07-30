import { test } from "node:test";
import assert from "node:assert/strict";
import {
  annualPitBeforeSurcharge,
  computePayrollItem,
  round2,
  type PayrollRuleSet,
} from "./engine";

const RULES: PayrollRuleSet = {
  currency: "BTN",
  pfEmployeeRate: 0.05,
  pfEmployerRate: 0.05,
  overtimeMultiplier: 1.5,
  publicHolidayPremiumRate: 0.5,
  nightPremiumRate: 0,
  standardMonthlyHours: 208,
  standardWorkingDays: 26,
  pitBrackets: [
    { upTo: 300000, rate: 0 },
    { upTo: 400000, rate: 0.1 },
    { upTo: 650000, rate: 0.15 },
    { upTo: 1000000, rate: 0.2 },
    { upTo: 1500000, rate: 0.25 },
    { upTo: null, rate: 0.3 },
  ],
  pitSurchargeThreshold: 1000000,
  pitSurchargeRate: 0.1,
  annualizationFactor: 12,
};

test("PIT is zero at or below the Nu 300,000 threshold", () => {
  assert.equal(annualPitBeforeSurcharge(300000, RULES.pitBrackets), 0);
  assert.equal(annualPitBeforeSurcharge(0, RULES.pitBrackets), 0);
});

test("PIT applies marginal slabs correctly", () => {
  // 350,000 -> 10% on the 50,000 above 300k = 5,000
  assert.equal(annualPitBeforeSurcharge(350000, RULES.pitBrackets), 5000);
  // 500,000 -> 10% * 100k (300-400) + 15% * 100k (400-500) = 10k + 15k = 25k
  assert.equal(annualPitBeforeSurcharge(500000, RULES.pitBrackets), 25000);
  // 1,000,000 -> 10k + 37.5k + 70k = 117,500
  assert.equal(annualPitBeforeSurcharge(1000000, RULES.pitBrackets), 117500);
});

test("low earner: PF deducted, no PIT", () => {
  const r = computePayrollItem({ basicWage: 15000 }, RULES);
  assert.equal(r.gross, 15000);
  assert.equal(r.employeePf, 750);
  assert.equal(r.employerPf, 750);
  assert.equal(r.pit, 0);
  // net = gross - PF
  assert.equal(r.net, 14250);
  assert.equal(r.employerCost, 15750);
});

test("mid earner: overtime, allowance and PIT flow through", () => {
  const r = computePayrollItem(
    {
      basicWage: 40000,
      earnings: [
        { code: "hra", label: "House allowance", amount: 5000, taxable: true },
        { code: "phone", label: "Phone", amount: 500, taxable: false },
      ],
      overtimeHours: 10,
    },
    RULES,
  );
  const hourly = 40000 / 208;
  const ot = round2(10 * hourly * 1.5);
  const expectedGross = round2(40000 + 5000 + 500 + ot);
  assert.equal(r.gross, expectedGross);
  assert.equal(r.employeePf, 2000);

  const taxableEarnings = round2(40000 + 5000 + ot); // phone excluded
  const monthlyTaxable = round2(taxableEarnings - 2000);
  const annual = monthlyTaxable * 12;
  const expectedPit = round2(
    annualPitBeforeSurcharge(annual, RULES.pitBrackets) / 12,
  );
  assert.equal(r.taxable, monthlyTaxable);
  assert.equal(r.pit, expectedPit);
  assert.equal(
    r.net,
    round2(r.gross - r.employeePf - r.pit),
  );
});

test("unpaid leave reduces gross and taxable base", () => {
  const r = computePayrollItem(
    { basicWage: 26000, unpaidLeaveDays: 2, workingDays: 26 },
    RULES,
  );
  // daily = 1000, 2 days lost = 2000 deduction
  const lop = r.lines.find((l) => l.code === "loss_of_pay");
  assert.ok(lop);
  assert.equal(lop.amount, 2000);
  assert.equal(r.employeePf, 1300); // PF still on full basic
});

test("high earner triggers surcharge in annualized PIT", () => {
  // Basic high enough that annual PIT >= 1,000,000 threshold.
  const r = computePayrollItem({ basicWage: 500000 }, RULES);
  const monthlyTaxable = round2(500000 - 500000 * 0.05);
  const annual = monthlyTaxable * 12;
  const base = annualPitBeforeSurcharge(annual, RULES.pitBrackets);
  const withSurcharge = base >= 1000000 ? base * 1.1 : base;
  assert.equal(r.pit, round2(withSurcharge / 12));
});

test("net always equals gross minus all deductions", () => {
  const r = computePayrollItem(
    {
      basicWage: 60000,
      earnings: [{ code: "hra", label: "HRA", amount: 8000 }],
      deductions: [{ code: "advance", label: "Salary advance", amount: 5000 }],
      overtimeHours: 5,
      unpaidLeaveDays: 1,
    },
    RULES,
  );
  const deductionSum = r.lines
    .filter((l) => l.kind === "deduction")
    .reduce((s, l) => s + l.amount, 0);
  assert.equal(r.net, round2(r.gross - round2(deductionSum)));
});
