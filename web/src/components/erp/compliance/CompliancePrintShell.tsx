import { PrintButton } from "@/components/erp/PrintButton";
import { PELBU_PROPERTY } from "@/lib/compliance-pack/catalog";
import Link from "next/link";
import type { ReactNode } from "react";

export function CompliancePrintShell({
  title,
  subtitle,
  backHref = "/erp/compliance",
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={
        wide
          ? "mx-auto max-w-5xl space-y-6 bg-white p-6 text-black print:max-w-none print:p-0"
          : "mx-auto max-w-3xl space-y-6 bg-white p-6 text-black print:max-w-none print:p-0"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <Link href={backHref} className="text-sm text-sky-700 underline">
          ← Compliance pack
        </Link>
        <PrintButton label="Print" />
      </div>

      <header className="space-y-1 border-b border-neutral-300 pb-3">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-neutral-500 uppercase">
          {PELBU_PROPERTY.name} · Compliance pack
        </p>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-sm text-neutral-600">{subtitle}</p>
        ) : null}
        <p className="text-xs text-neutral-500">
          {PELBU_PROPERTY.addressDetail} · {PELBU_PROPERTY.phone} ·{" "}
          {PELBU_PROPERTY.email}
        </p>
      </header>

      {children}

      <footer className="border-t border-neutral-300 pt-3 text-[10px] text-neutral-500">
        Internal / MoLHR / DOT / BAFRA prep — not a substitute for licences,
        inspections, or signed originals filed with authorities.
      </footer>
    </div>
  );
}

export function BlankRows({
  cols,
  rows = 12,
}: {
  cols: string[];
  rows?: number;
}) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b-2 border-neutral-400 text-left">
          {cols.map((c) => (
            <th key={c} className="px-1 py-1.5 font-semibold">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i} className="border-b border-neutral-200">
            {cols.map((c) => (
              <td key={c} className="h-8 px-1 py-1">
                &nbsp;
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SignOff({
  labels = ["Prepared by", "Checked by", "Approved by"],
}: {
  labels?: string[];
}) {
  return (
    <div className="mt-6 grid gap-6 sm:grid-cols-3">
      {labels.map((l) => (
        <div key={l} className="space-y-6 text-xs">
          <p className="font-semibold">{l}</p>
          <p className="border-b border-neutral-400 pt-8">Name / Sign</p>
          <p className="border-b border-neutral-400 pt-6">Date</p>
        </div>
      ))}
    </div>
  );
}
