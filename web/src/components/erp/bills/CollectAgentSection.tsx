"use client";

import { combineFoliosOnMasterBill } from "@/app/actions/erp-folio-ops";
import { CollectPaymentButton } from "@/components/erp/bills/CollectPaymentButton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BILL_KIND_LABELS, type BillKind } from "@/lib/folio/bill-kinds";
import { stayFolioHref } from "@/lib/folio/stay-hub-cycle";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export type CollectStayRow = {
  bookingId: string;
  folioId: string | null;
  confirmation: string | null;
  guest: string;
  checkIn: string;
  checkOut: string;
  rate: number | null;
  bill: number;
  paid: number;
  due: number;
};

const PRINT_KINDS: BillKind[] = ["room", "master", "fnb"];

function fmt(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function billPrintHref(folioId: string, bill: BillKind): string {
  return `/erp/folios/${folioId}/bill?bill=${bill}`;
}

export function CollectAgentSection({
  agentId,
  name,
  due,
  stays,
}: {
  agentId: string | null;
  name: string;
  due: number;
  stays: CollectStayRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const selectable = stays.flatMap((stay) => (stay.folioId ? [stay.folioId] : []));
  const unpaid = stays.flatMap((stay) =>
    stay.folioId && stay.due > 0.5 ? [stay.folioId] : [],
  );
  const allSelected =
    selectable.length > 0 && selectable.every((id) => selected.includes(id));
  const someSelected = selected.length > 0 && !allSelected;

  function toggle(folioId: string, on: boolean) {
    setSelected((cur) => {
      const next = cur.filter((id) => id !== folioId);
      return on ? [...next, folioId] : next;
    });
  }

  async function combine(folioIds: string[]) {
    if (folioIds.length === 0 || busy) return;
    setBusy(true);
    const popup = window.open("about:blank", "_blank");
    try {
      const result = await combineFoliosOnMasterBill(folioIds);
      if (!result.ok) {
        popup?.close();
        toast.error(result.error);
        return;
      }
      const href = billPrintHref(result.masterFolioId, "master");
      if (popup) popup.location.href = href;
      else router.push(href);
      toast.success(result.message);
      setSelected([]);
      router.refresh();
    } catch {
      popup?.close();
      toast.error("Could not create the master bill.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <h2 className="text-sm font-semibold">
          {agentId ? (
            <Link href={`/erp/agents/${agentId}`} className="hover:underline">
              {name}
            </Link>
          ) : (
            name
          )}
        </h2>
        <p className="text-sm tabular-nums">
          <span className="text-muted-foreground">To collect </span>
          <span className="font-semibold">{formatBtn(due)}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={busy || selected.length < 2}
          onClick={() => void combine(selected)}
        >
          One master bill for selected
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          disabled={busy || unpaid.length === 0}
          onClick={() => void combine(unpaid)}
        >
          {agentId ? "All unpaid for this agent" : "All unpaid for these stays"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Charges stay on each folio. One master bill number covers the stays you include.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="w-10 px-3 py-2 font-medium">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  disabled={selectable.length === 0}
                  aria-label={`Select stays for ${name}`}
                  onCheckedChange={(value) => setSelected(value === true ? selectable : [])}
                />
              </th>
              <th className="px-3 py-2 font-medium">Guest</th>
              <th className="px-3 py-2 font-medium">Stay</th>
              <th className="px-3 py-2 text-right font-medium">Rate</th>
              <th className="px-3 py-2 text-right font-medium">Bill</th>
              <th className="px-3 py-2 text-right font-medium">Paid</th>
              <th className="px-3 py-2 text-right font-medium">Unpaid</th>
              <th className="px-3 py-2 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {stays.map((stay) => (
              <tr key={stay.bookingId} className="border-b last:border-0">
                <td className="px-3 py-2">
                  {stay.folioId ? (
                    <Checkbox
                      checked={selected.includes(stay.folioId)}
                      aria-label={`Include ${stay.guest}`}
                      onCheckedChange={(value) => toggle(stay.folioId as string, value === true)}
                    />
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium">{stay.guest}</p>
                  <p className="text-xs text-muted-foreground">{stay.confirmation}</p>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {fmt(stay.checkIn)} – {fmt(stay.checkOut)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {stay.rate != null ? formatBtn(stay.rate) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatBtn(stay.bill)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatBtn(stay.paid)}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {formatBtn(stay.due)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {stay.folioId ? (
                      <CollectPaymentButton
                        folioId={stay.folioId}
                        bookingId={stay.bookingId}
                        due={stay.due}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">No folio</span>
                    )}
                    {stay.folioId ? (
                      <Button asChild variant="ghost" size="sm" className="h-8">
                        <Link href={stayFolioHref(stay.bookingId, stay.folioId)}>Open bill</Link>
                      </Button>
                    ) : null}
                    {stay.folioId
                      ? PRINT_KINDS.map((bill) => (
                          <Button key={bill} asChild size="sm" variant="outline" className="h-8">
                            <Link
                              href={billPrintHref(stay.folioId as string, bill)}
                              target="_blank"
                            >
                              {BILL_KIND_LABELS[bill]}
                            </Link>
                          </Button>
                        ))
                      : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
