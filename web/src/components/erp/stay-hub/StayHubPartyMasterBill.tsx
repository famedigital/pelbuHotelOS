"use client";

import {
  fetchPartyMasterBill,
  settlePartyAgentAr,
  type PartyMasterBill,
} from "@/app/actions/erp-party-master-bill";
import { Button } from "@/components/ui/button";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

/** Live Master Bill for a formal party — room-tagged charges / POS / due. */
export function StayHubPartyMasterBill({
  bookingId,
  open,
}: {
  bookingId: string;
  open: boolean;
}) {
  const [bill, setBill] = useState<PartyMasterBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const reload = () => {
    setLoading(true);
    setError(null);
    void fetchPartyMasterBill(bookingId).then((res) => {
      if (res.ok) setBill(res.data);
      else {
        setBill(null);
        setError(res.error);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!open) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on open/booking
  }, [open, bookingId]);

  if (!open) return null;

  if (loading) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        Loading master bill…
      </p>
    );
  }
  if (error) {
    return <p className="px-3 py-2 text-xs text-destructive">{error}</p>;
  }
  if (!bill) return null;

  const hasDue = bill.totalDueBtn > 0.5;

  return (
    <div className="space-y-2 border-b border-border bg-card px-3 py-2 md:px-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Master bill
          {bill.groupName ? ` · ${bill.groupName}` : ""}
        </p>
        <div className="flex flex-wrap gap-3 text-[11px] tabular-nums">
          <span>
            Charges{" "}
            <strong className="text-foreground">
              {formatBtn(bill.totalChargesBtn)}
            </strong>
          </span>
          <span>
            POS{" "}
            <strong className="text-foreground">
              {formatBtn(bill.totalPosBtn)}
            </strong>
          </span>
          <span>
            Paid{" "}
            <strong className="text-foreground">
              {formatBtn(bill.totalPaidBtn)}
            </strong>
          </span>
          <span>
            Due{" "}
            <strong className="text-accent">
              {formatBtn(bill.totalDueBtn)}
            </strong>
          </span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-border/70">
        <table className="w-full min-w-[28rem] text-left text-[11px]">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 font-medium">Room</th>
              <th className="px-2 py-1.5 font-medium">Status</th>
              <th className="px-2 py-1.5 font-medium text-right">Charges</th>
              <th className="px-2 py-1.5 font-medium text-right">POS</th>
              <th className="px-2 py-1.5 font-medium text-right">Paid</th>
              <th className="px-2 py-1.5 font-medium text-right">Due</th>
            </tr>
          </thead>
          <tbody>
            {bill.rooms.map((r) => (
              <tr key={r.bookingId} className="border-t border-border/50">
                <td className="px-2 py-1.5 font-medium text-foreground">
                  {r.roomLabel ?? "—"}
                  {r.contactName ? (
                    <span className="ml-1 font-normal text-muted-foreground">
                      · {r.contactName}
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">
                  {r.status.replace(/_/g, " ")}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatBtn(r.chargesBtn)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatBtn(r.posChargesBtn)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatBtn(r.paidBtn)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-accent">
                  <Link
                    href={`/erp/folios/${r.folioId}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {formatBtn(r.balanceBtn)}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="citrus"
          className="h-7 text-[11px]"
          disabled={pending || !hasDue}
          onClick={() => {
            startTransition(async () => {
              const res = await settlePartyAgentAr(bookingId);
              if (res.ok) {
                toast.success(res.message);
                reload();
              } else {
                toast.error(res.error);
              }
            });
          }}
        >
          {pending ? "Charging…" : "Charge agent AR (all due)"}
        </Button>
        {bill.masterFolioId ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              asChild
            >
              <Link href={`/erp/folios/${bill.masterFolioId}/statement`}>
                Master statement
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              asChild
            >
              <Link href={`/erp/folios/${bill.masterFolioId}`}>
                Open master folio
              </Link>
            </Button>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Master folio appears after a room is checked in / folio opened.
          </p>
        )}
      </div>
    </div>
  );
}
