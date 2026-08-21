"use client";

import {
  fetchPartyMasterBill,
  settlePartyAgentAr,
  type PartyMasterBill,
} from "@/app/actions/erp-party-master-bill";
import type {
  StayHubPartyContext,
  StayHubSummary,
} from "@/app/actions/stay-hub";
import { SignedRegCardUploadStrip } from "@/components/erp/PostCheckInRegPanel";
import type {
  GuestRegistrationCardData,
  GuestRegistrationPropertyBits,
} from "@/components/erp/GuestRegistrationCard";
import { StayHubWorkFrame } from "@/components/erp/stay-hub/StayHubChrome";
import { Button } from "@/components/ui/button";
import { printDeskSheet } from "@/lib/desk-print";
import type { PropertyRegistrationDesign } from "@/lib/property-settings";
import { formatGuestBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

export function StayHubPartyMoneyPanel({
  bookingId,
  groupId,
  activeBookingId,
  onSwitch,
  onOpenFolio,
}: {
  bookingId: string;
  groupId: string | null;
  activeBookingId: string;
  onSwitch: (bookingId: string, assignmentId: string | null) => void;
  onOpenFolio: (bookingId: string, assignmentId: string | null) => void;
}) {
  const [bill, setBill] = useState<PartyMasterBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchPartyMasterBill(bookingId).then((r) => {
      if (cancelled) return;
      if (!r.ok) {
        setError(r.error);
        setBill(null);
      } else {
        setBill(r.data);
        setError(null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // Party rollup is the same for every sibling — don't refetch on room tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by group
  }, [groupId]);

  return (
    <StayHubWorkFrame
      title="Party money"
      description="Balances for every room in this group. Tap a row to select it, or open that room’s folio."
      dense
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading master bill…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !bill ? (
        <p className="text-sm text-muted-foreground">No party bill yet.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MoneyStat label="Charges" value={bill.totalChargesBtn} />
            <MoneyStat label="Paid" value={bill.totalPaidBtn} />
            <MoneyStat label="F&B / POS" value={bill.totalPosBtn} />
            <MoneyStat label="Due" value={bill.totalDueBtn} emphasize />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="h-8 text-[11px]"
              onClick={() => {
                const row = bill.rooms.find((r) => r.bookingId === activeBookingId);
                onOpenFolio(activeBookingId, null);
                if (!row) return;
              }}
            >
              Open this room folio
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-[11px]"
              disabled={pending || bill.totalDueBtn <= 0.5}
              onClick={() => {
                startTransition(async () => {
                  const r = await settlePartyAgentAr(bookingId);
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success(r.message);
                  const next = await fetchPartyMasterBill(bookingId);
                  if (next.ok) setBill(next.data);
                });
              }}
            >
              {pending ? "Charging…" : "Charge agent AR (all due)"}
            </Button>
          </div>
          <div className="max-h-[min(52vh,28rem)] overflow-auto rounded-md border border-border/70">
            <table className="w-full min-w-[28rem] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-[1] bg-muted/95 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-2 py-1.5">Room</th>
                  <th className="px-2 py-1.5">Guest</th>
                  <th className="px-2 py-1.5 text-right">Charges</th>
                  <th className="px-2 py-1.5 text-right">Due</th>
                </tr>
              </thead>
              <tbody>
                {bill.rooms.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-2 py-4 text-center text-muted-foreground"
                    >
                      No open folios yet — check in a room first.
                    </td>
                  </tr>
                ) : (
                  bill.rooms.map((row) => {
                    const active = row.bookingId === activeBookingId;
                    return (
                      <tr
                        key={row.bookingId}
                        className={cn(
                          "border-t border-border/50",
                          active && "bg-accent/10",
                        )}
                      >
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            className="text-left font-semibold tabular-nums hover:underline"
                            onClick={() => onSwitch(row.bookingId, null)}
                          >
                            {row.roomLabel || "—"}
                          </button>
                          <p className="text-[10px] text-muted-foreground">
                            {row.status.replace(/_/g, " ")}
                          </p>
                        </td>
                        <td className="px-2 py-1.5">{row.contactName || "—"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {formatGuestBtn(row.chargesBtn)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          <button
                            type="button"
                            className="font-medium hover:underline"
                            onClick={() => onOpenFolio(row.bookingId, null)}
                          >
                            {formatGuestBtn(row.balanceBtn)}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </StayHubWorkFrame>
  );
}

function MoneyStat({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-card px-2.5 py-2">
      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          emphasize && "text-foreground",
        )}
      >
        {formatGuestBtn(value)}
      </p>
    </div>
  );
}

export function StayHubPartyDocsPanel({
  party,
  summary,
  folioId,
  regData,
  property,
  design,
  canPrintGroup = false,
  onSwitch,
  onUploaded,
  onPrintGroup,
}: {
  party: StayHubPartyContext;
  summary: StayHubSummary;
  folioId: string | null;
  regData: GuestRegistrationCardData;
  property?: GuestRegistrationPropertyBits | null;
  design?: PropertyRegistrationDesign | null;
  canPrintGroup?: boolean;
  onSwitch: (bookingId: string, assignmentId: string | null) => void;
  onUploaded?: () => void;
  onPrintGroup?: () => void;
}) {
  const settlementHref = `/erp/bookings/${summary.bookingId}/settlement-pack`;
  const folioHref = folioId
    ? `/erp/folios/${folioId}`
    : `/erp/folios?q=${encodeURIComponent(summary.confirmationCode || summary.bookingId)}`;

  return (
    <StayHubWorkFrame
      title="Party documents"
      description="Print the group registration (rooming list + tour leader sign) or this room’s card."
      dense
    >
      <div className="space-y-3">
        <div className="rounded-md border border-border/70 bg-card p-2.5">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Group pack
          </p>
          <p className="mt-0.5 text-sm font-medium">
            {party.groupName?.trim() || "Party"}
            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
              {party.members.length} rooms
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              className="h-8 text-[11px]"
              disabled={!canPrintGroup}
              onClick={() => {
                if (!canPrintGroup) {
                  toast.error("Rooming list still loading");
                  return;
                }
                onPrintGroup?.();
              }}
            >
              Print group registration
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Group copy lists every room. Tour leader signs once. Use this room
            below for a keyed occupant card.
          </p>
        </div>

        <div className="rounded-md border border-border/70 bg-card p-2.5">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            This room
          </p>
          <p className="mt-0.5 text-sm font-medium">
            {summary.roomLabel || "Unassigned"}
            {summary.contactName ? ` · ${summary.contactName}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              className="h-8 text-[11px]"
              onClick={() => printDeskSheet("voucher")}
            >
              Print voucher
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-[11px]"
              onClick={() => printDeskSheet("reg")}
            >
              Print registration
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-[11px]"
              asChild
            >
              <Link href={folioHref}>Folio</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-[11px]"
              asChild
            >
              <Link href={settlementHref}>Settlement pack</Link>
            </Button>
          </div>
          {summary.status === "checked_in" || summary.regCardPhotoPublicId ? (
            <div className="mt-2 border-t border-border/50 pt-2">
              <SignedRegCardUploadStrip
                bookingId={summary.bookingId}
                regCardPhotoPublicId={summary.regCardPhotoPublicId}
                regData={regData}
                property={property ?? undefined}
                design={design}
                onUploaded={onUploaded}
              />
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Registration upload appears after check-in for this room.
            </p>
          )}
        </div>

        <div className="max-h-[min(40vh,22rem)] overflow-auto rounded-md border border-border/70">
          <table className="w-full min-w-[22rem] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-[1] bg-muted/95 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-2 py-1.5">Room</th>
                <th className="px-2 py-1.5">Guest</th>
                <th className="px-2 py-1.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {party.members.map((m, i) => {
                const active = m.bookingId === summary.bookingId;
                return (
                  <tr
                    key={m.bookingId}
                    className={cn(
                      "border-t border-border/50",
                      active && "bg-accent/10",
                    )}
                  >
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        className="text-left font-semibold tabular-nums hover:underline"
                        onClick={() => onSwitch(m.bookingId, m.assignmentId)}
                      >
                        {m.roomLabel?.trim() ||
                          m.confirmationCode?.trim() ||
                          `Room ${i + 1}`}
                      </button>
                    </td>
                    <td className="px-2 py-1.5">{m.contactName || "—"}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {m.status.replace(/_/g, " ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </StayHubWorkFrame>
  );
}
