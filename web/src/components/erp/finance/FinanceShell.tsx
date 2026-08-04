"use client";

import { DeskHelpHint } from "@/components/erp/DeskHelpHint";
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
  const short =
    description && description.length <= 96 ? description : undefined;
  const long =
    description && description.length > 96 ? description : undefined;

  return (
    <div className="erp mx-auto flex w-full max-w-[1200px] flex-col">
      <header className="sticky top-14 z-20 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="flex flex-col gap-3 px-4 py-3 md:px-6 md:py-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
                Hotel accountant
              </p>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                  {title}
                </h1>
                {long ? (
                  <DeskHelpHint>
                    <p>{long}</p>
                  </DeskHelpHint>
                ) : null}
              </div>
              {short ? (
                <p className="max-w-2xl text-sm leading-snug text-muted-foreground line-clamp-1">
                  {short}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {actions}
              </div>
            ) : null}
          </div>

          <nav
            aria-label="Finance sections"
            className="overflow-x-auto rounded-lg border border-border bg-muted/30"
          >
            <div className="flex min-w-max items-stretch divide-x divide-border">
              {FINANCE_GROUPS.map((group) => (
                <div key={group.label} className="flex flex-col px-2 py-1.5">
                  <p className="px-2 pb-0.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
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
                            "rounded-md px-2.5 py-1 text-sm whitespace-nowrap transition-colors",
                            active
                              ? "bg-espresso font-medium text-ivory"
                              : "text-muted-foreground hover:bg-background hover:text-foreground",
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
        </div>
      </header>

      <div className="flex flex-col gap-6 p-4 md:gap-8 md:p-6">{children}</div>
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
      <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-semibold tracking-tight tabular-nums text-foreground",
          emphasize ? "text-2xl md:text-3xl" : "text-lg",
        )}
      >
        {value}
      </p>
      {note ? (
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          {note}
        </p>
      ) : null}
    </>
  );

  const className = cn(
    "rounded-lg border border-border bg-card px-3 py-2.5 transition-colors",
    tone === "good" && "border-emerald-500/30 bg-emerald-500/[0.04]",
    tone === "warn" && "border-amber-500/35 bg-amber-500/[0.05]",
    tone === "muted" && "opacity-90",
    href && "hover:border-accent/40 hover:bg-accent/5",
  );

  if (href) {
    return (
      <Link href={href} className={cn(className, "block")}>
        {body}
        <p className="mt-1 text-[11px] font-medium text-accent">Open →</p>
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
