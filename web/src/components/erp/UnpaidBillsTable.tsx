"use client";

import { openMasterBillPrint } from "@/app/actions/erp-folio-ops";
import { FiscalDocEmailForm } from "@/components/erp/FiscalDocEmailForm";
import { GuestWaMessageButtons } from "@/components/erp/GuestWaMessageButtons";
import { Button } from "@/components/ui/button";
import { bookingConfirmationLabel } from "@/lib/booking-ref";
import type { UnpaidBillRow } from "@/lib/erp/unpaid-bills";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState, useTransition } from "react";

function digitsPhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const d = phone.replace(/\D/g, "");
  return d.length >= 7 ? d : null;
}

export function UnpaidBillsTable({
  rows,
  orphanAgents,
  propertyName,
}: {
  rows: UnpaidBillRow[];
  orphanAgents: UnpaidBillRow[];
  propertyName?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [emailFor, setEmailFor] = useState<string | null>(null);
  const [billBusy, setBillBusy] = useState<string | null>(null);

  async function onBill(row: UnpaidBillRow) {
    if (!row.folioId) return;
    if (row.invoiceId) {
      window.open(`/erp/invoices/${row.invoiceId}/print`, "_blank");
      return;
    }
    setBillBusy(row.folioId);
    try {
      const result = await openMasterBillPrint(row.folioId);
      if (result.ok) {
        window.open(result.href, "_blank");
      } else {
        window.alert(result.error);
      }
    } catch {
      window.alert("Could not open bill. Try Collect on the folio.");
    } finally {
      setBillBusy(null);
    }
  }

  function renderRows(list: UnpaidBillRow[], orphan?: boolean) {
    if (list.length === 0) {
      return (
        <tr>
          <td
            colSpan={9}
            className="px-3 py-8 text-center text-sm text-muted-foreground"
          >
            {orphan
              ? "No agent account balances without an open stay."
              : "Nothing to collect right now."}
          </td>
        </tr>
      );
    }

    return list.map((row) => {
      const key =
        row.folioId ??
        `agent-${row.agentId ?? row.collectFrom}-${row.amountDue}`;
      const tel = digitsPhone(row.phone);
      const conf = bookingConfirmationLabel({
        confirmationCode: row.confirmationCode,
        bookingId: row.bookingId,
      });
      const showEmail = emailFor === key;

      return (
        <tr
          key={key}
          className={cn(
            "border-b border-border/60 align-top",
            orphan && "bg-muted/20",
          )}
        >
          <td className="px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap">
            {formatBtn(row.amountDue)}
          </td>
          <td className="px-3 py-2.5">
            <p className="font-medium text-foreground">{row.collectFrom}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.collectParty === "agent" ? "Travel agent" : "Guest"}
            </p>
          </td>
          <td className="px-3 py-2.5">
            <p>{row.guestName}</p>
            {row.bookingId ? (
              <p className="text-[11px] text-muted-foreground">{conf}</p>
            ) : null}
          </td>
          <td className="px-3 py-2.5 tabular-nums text-sm whitespace-nowrap">
            {row.checkIn ?? "—"}
          </td>
          <td className="px-3 py-2.5 tabular-nums text-sm whitespace-nowrap">
            {row.checkOut ?? "—"}
          </td>
          <td className="px-3 py-2.5 text-sm">{row.rooms || "—"}</td>
          <td className="px-3 py-2.5 text-sm">
            {row.phone ? (
              tel ? (
                <a
                  href={`tel:${tel}`}
                  className="text-accent underline-offset-2 hover:underline"
                >
                  {row.phone}
                </a>
              ) : (
                row.phone
              )
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            {row.email ? (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground max-w-[10rem]">
                {row.email}
              </p>
            ) : null}
          </td>
          <td className="px-3 py-2.5 text-sm whitespace-nowrap">
            {row.statusLabel}
          </td>
          <td className="px-3 py-2.5 print:hidden">
            <div className="flex flex-wrap gap-1">
              {row.folioId ? (
                <Button asChild size="sm" variant="default" className="h-8">
                  <Link href={`/erp/folios/${row.folioId}`}>Collect</Link>
                </Button>
              ) : row.agentId ? (
                <Button asChild size="sm" variant="default" className="h-8">
                  <Link href={`/erp/agents/${row.agentId}`}>Agent</Link>
                </Button>
              ) : null}
              {row.folioId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={billBusy === row.folioId || pending}
                  onClick={() => {
                    startTransition(() => {
                      void onBill(row);
                    });
                  }}
                >
                  Bill
                </Button>
              ) : null}
              {row.folioId && row.email ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() =>
                    setEmailFor((cur) => (cur === key ? null : key))
                  }
                >
                  Email
                </Button>
              ) : null}
              {tel ? (
                <Button asChild size="sm" variant="ghost" className="h-8">
                  <a href={`tel:${tel}`}>Call</a>
                </Button>
              ) : null}
            </div>
            {row.phone ? (
              <div className="mt-2">
                <GuestWaMessageButtons
                  phone={row.phone}
                  guestName={row.collectFrom}
                  confLabel={conf !== "—" ? conf : null}
                  checkIn={row.checkIn}
                  checkOut={row.checkOut}
                  dueBtn={row.amountDue}
                  propertyName={propertyName}
                  kinds={["due_reminder"]}
                />
              </div>
            ) : null}
            {showEmail && row.folioId ? (
              <div className="mt-2 max-w-sm">
                <FiscalDocEmailForm
                  folioId={row.folioId}
                  fiscalDocId={row.invoiceId}
                  docKind="invoice"
                  defaultEmail={row.email}
                  defaultName={row.collectFrom}
                  label="Email bill"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Formal PDF: open Bill → Print → Save as PDF.
                </p>
              </div>
            ) : null}
          </td>
        </tr>
      );
    });
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 text-right">Amount due</th>
              <th className="px-3 py-2">Collect from</th>
              <th className="px-3 py-2">Guest</th>
              <th className="px-3 py-2">Check-in</th>
              <th className="px-3 py-2">Check-out</th>
              <th className="px-3 py-2">Room</th>
              <th className="px-3 py-2">Phone / email</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 print:hidden">Actions</th>
            </tr>
          </thead>
          <tbody>{renderRows(rows)}</tbody>
        </table>
      </div>

      {orphanAgents.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Agent account (no open stay)
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Credit on the agent account with no open folio row — chase via the
            agent page.
          </p>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 text-right">Amount due</th>
                  <th className="px-3 py-2">Collect from</th>
                  <th className="px-3 py-2">Guest</th>
                  <th className="px-3 py-2">Check-in</th>
                  <th className="px-3 py-2">Check-out</th>
                  <th className="px-3 py-2">Room</th>
                  <th className="px-3 py-2">Phone / email</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody>{renderRows(orphanAgents, true)}</tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
