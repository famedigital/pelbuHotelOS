"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const FINANCE_NAV: Array<{
  href: string;
  label: string;
  exact?: boolean;
}> = [
  { href: "/erp/finance", label: "Overview", exact: true },
  { href: "/erp/finance/income", label: "Income" },
  { href: "/erp/finance/expenses", label: "Expenses" },
  { href: "/erp/finance/vendors", label: "Vendors" },
  { href: "/erp/finance/banking", label: "Banking" },
  { href: "/erp/finance/bank-proofs", label: "Bank proofs" },
  { href: "/erp/finance/accounting", label: "Accounting" },
  { href: "/erp/finance/gst", label: "GST" },
  { href: "/erp/finance/reports", label: "Reports" },
  { href: "/erp/finance/setup", label: "Setup" },
];

export function FinanceShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="erp space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Finance
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      <nav
        aria-label="Finance sections"
        className="flex flex-wrap gap-1 rounded-xl border bg-card p-1"
      >
        {FINANCE_NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}

export function FinanceKpi({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {note ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
      ) : null}
    </div>
  );
}

export function ExportButtons({
  report,
  from,
  to,
}: {
  report: string;
  from: string;
  to: string;
}) {
  const qs = new URLSearchParams({ report, from, to }).toString();
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`/api/erp/finance/export?${qs}&format=xlsx`}
        className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
      >
        Download Excel
      </a>
      <a
        href={`/api/erp/finance/export?${qs}&format=csv`}
        className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
      >
        Download CSV
      </a>
    </div>
  );
}
