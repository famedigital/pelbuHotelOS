"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const FINANCE_GROUPS: NavGroup[] = [
  {
    label: "Hotel account",
    items: [
      { href: "/erp/finance", label: "Vault", exact: true },
      { href: "/erp/finance/banking", label: "Banking" },
      { href: "/erp/finance/bank-proofs", label: "Bank proofs" },
    ],
  },
  {
    label: "Money in",
    items: [
      { href: "/erp/finance/income", label: "Income" },
      { href: "/erp/folios", label: "City ledger" },
      { href: "/erp/payments", label: "Payments" },
      { href: "/erp/invoices", label: "Invoices" },
    ],
  },
  {
    label: "Money out",
    items: [
      { href: "/erp/finance/expenses", label: "Expenses" },
      { href: "/erp/finance/vendors", label: "Vendors" },
      { href: "/erp/hr/payroll", label: "Payroll" },
    ],
  },
  {
    label: "Tax",
    items: [{ href: "/erp/finance/gst", label: "GST" }],
  },
  {
    label: "Books",
    items: [
      { href: "/erp/finance/accounting", label: "Journals" },
      { href: "/erp/finance/reports", label: "Reports" },
      { href: "/erp/finance/setup", label: "Close month" },
    ],
  },
];

function itemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

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
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Hotel accountant
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-[15px]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      <nav
        aria-label="Finance sections"
        className="overflow-x-auto rounded-xl border bg-card"
      >
        <div className="flex min-w-max items-stretch divide-x">
          {FINANCE_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col px-2 py-2">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-0.5">
                {group.items.map((item) => {
                  const active = itemActive(pathname, item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
                        active
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {children}
    </div>
  );
}

export function FinanceKpi({
  label,
  value,
  note,
  href,
  tone = "default",
  emphasize = false,
}: {
  label: string;
  value: string;
  note?: string;
  href?: string;
  tone?: "default" | "good" | "warn" | "muted";
  emphasize?: boolean;
}) {
  const body = (
    <>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-semibold tracking-tight tabular-nums text-foreground",
          emphasize ? "text-3xl md:text-4xl" : "text-2xl",
        )}
      >
        {value}
      </p>
      {note ? (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{note}</p>
      ) : null}
    </>
  );

  const className = cn(
    "rounded-xl border bg-card px-5 py-4 transition-colors",
    tone === "good" && "border-emerald-500/30 bg-emerald-500/[0.04]",
    tone === "warn" && "border-amber-500/35 bg-amber-500/[0.05]",
    tone === "muted" && "opacity-90",
    href && "hover:border-accent/40 hover:bg-muted/30",
  );

  if (href) {
    return (
      <Link href={href} className={cn(className, "block")}>
        {body}
        <p className="mt-2 text-[11px] font-medium text-accent">Open →</p>
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
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
        Excel
      </a>
      <a
        href={`/api/erp/finance/export?${qs}&format=csv`}
        className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
      >
        CSV
      </a>
    </div>
  );
}
