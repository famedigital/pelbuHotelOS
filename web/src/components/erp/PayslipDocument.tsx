import { formatBtn } from "@/lib/pricing";
import type { CSSProperties } from "react";

export type PayslipLine = {
  kind: "earning" | "deduction" | "employer_cost";
  code: string;
  label: string;
  amount: number;
  taxable: boolean;
};

export type PayslipData = {
  itemId: string;
  employeeCode: string | null;
  fullName: string;
  department: string | null;
  positionTitle: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  providentFundNumber: string | null;
  taxIdentifier: string | null;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  payDate: string | null;
  basicWage: number;
  lines: PayslipLine[];
  gross: number;
  employeePf: number;
  employerPf: number;
  pit: number;
  otherDeductions: number;
  net: number;
  employerCost: number;
  paymentStatus: string;
  paymentReference: string | null;
};

export type PayslipProperty = {
  name: string;
  legal_name: string | null;
  address: string | null;
  phone: string | null;
  tax_id: string | null;
};

function maskAccount(value: string | null): string {
  if (!value) return "—";
  if (value.length <= 4) return value;
  return `••••${value.slice(-4)}`;
}

export function PayslipDocument({
  data,
  property,
}: {
  data: PayslipData;
  property: PayslipProperty;
}) {
  const brand = property.legal_name || property.name || "Pelbu Suites";
  const earnings = data.lines.filter((l) => l.kind === "earning");
  const deductions = data.lines.filter((l) => l.kind === "deduction");
  const employerCosts = data.lines.filter((l) => l.kind === "employer_cost");

  const wrapStyle: CSSProperties = {
    maxWidth: "720px",
  };

  return (
    <section
      className="mx-auto rounded-lg border bg-background p-6 text-sm text-foreground shadow-sm print:border-0 print:shadow-none"
      style={wrapStyle}
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Payslip
          </p>
          <h1 className="mt-1 text-xl font-semibold">{brand}</h1>
          {property.address ? (
            <p className="mt-1 text-xs text-muted-foreground">{property.address}</p>
          ) : null}
          {property.tax_id ? (
            <p className="text-xs text-muted-foreground">TPN {property.tax_id}</p>
          ) : null}
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{data.periodLabel}</p>
          <p>
            {data.periodStart} → {data.periodEnd}
          </p>
          {data.payDate ? <p>Pay date {data.payDate}</p> : null}
        </div>
      </header>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Employee</p>
          <p className="font-medium">{data.fullName}</p>
          <p className="text-xs text-muted-foreground">
            {[data.employeeCode, data.department, data.positionTitle]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs text-muted-foreground">Bank / PF / Tax</p>
          <p>
            {data.bankName ?? "—"} {maskAccount(data.bankAccountNumber)}
          </p>
          <p className="text-xs text-muted-foreground">
            PF {data.providentFundNumber ?? "—"} · TPN{" "}
            {data.taxIdentifier ?? "—"}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Earnings
          </h2>
          <ul className="divide-y border-y">
            {earnings.map((line, i) => (
              <li
                key={`e-${line.code}-${i}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span>
                  {line.label}
                  {!line.taxable ? (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      non-taxable
                    </span>
                  ) : null}
                </span>
                <span className="font-medium">{formatBtn(line.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between font-semibold">
            <span>Gross</span>
            <span>{formatBtn(data.gross)}</span>
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Deductions
          </h2>
          <ul className="divide-y border-y">
            {deductions.length === 0 ? (
              <li className="py-2 text-muted-foreground">None</li>
            ) : (
              deductions.map((line, i) => (
                <li
                  key={`d-${line.code}-${i}`}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span>{line.label}</span>
                  <span className="font-medium">{formatBtn(line.amount)}</span>
                </li>
              ))
            )}
          </ul>
          <p className="mt-2 flex justify-between font-semibold">
            <span>Net pay</span>
            <span>{formatBtn(data.net)}</span>
          </p>
        </div>
      </div>

      {employerCosts.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Employer contributions (not deducted from pay)
          </h2>
          <ul className="divide-y border-y">
            {employerCosts.map((line, i) => (
              <li
                key={`c-${line.code}-${i}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span>{line.label}</span>
                <span>{formatBtn(line.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Total employer cost {formatBtn(data.employerCost)} · Basic wage{" "}
            {formatBtn(data.basicWage)}
          </p>
        </div>
      ) : null}

      <footer className="mt-8 flex flex-wrap items-end justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
        <div>
          <p>
            Payment:{" "}
            <span className="font-medium text-foreground">
              {data.paymentStatus}
            </span>
            {data.paymentReference ? ` · ${data.paymentReference}` : ""}
          </p>
          <p className="mt-1">
            Generated for compliance under the Income Tax Act of Bhutan 2025
            and NPPF contribution rules. This is a computer-generated payslip.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-foreground">
            {formatBtn(data.net)}
          </p>
          <p>Net transferable</p>
        </div>
      </footer>
    </section>
  );
}
