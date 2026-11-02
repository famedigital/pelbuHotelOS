"use client";

import { checkoutStayAtomic } from "@/app/actions/folio-cashier";
import type { StayHubMoneyPayload } from "@/app/actions/stay-hub";
import { StayHubCashierStrip } from "@/components/erp/stay-hub/StayHubCashierStrip";
import { StayBillAddons } from "@/components/erp/stay-hub/StayBillAddons";
import { Button } from "@/components/ui/button";
import { formatGuestBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";
import { toast } from "sonner";

/**
 * Floating cold-glass cashier dock — print strip, quick addons, atomic checkout.
 */
export function StayHubCashierDock({
  status,
  propertyId,
  bookingId,
  guestName,
  roomUnitId,
  roomLabel,
  money,
  allowBalance = false,
  onMoneyChanged,
  onCheckedOut,
  className,
}: {
  status: string;
  propertyId: string;
  bookingId: string;
  guestName?: string | null;
  roomUnitId?: string | null;
  roomLabel?: string | null;
  money: StayHubMoneyPayload | null;
  allowBalance?: boolean;
  onMoneyChanged: () => void;
  onCheckedOut?: () => void;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const guestDue = money?.guestVisibleBalanceBtn ?? money?.balanceBtn ?? 0;
  const clear = Math.abs(guestDue) <= 0.5;
  const canCheckout = status === "checked_in";

  function settleCheckout() {
    if (!canCheckout) {
      toast.error("Guest must be in-house to check out.");
      return;
    }
    if (!clear && !allowBalance) {
      toast.error(
        `Guest stream still due ${formatGuestBtn(guestDue)}. Collect or allow balance.`,
      );
      return;
    }
    startTransition(async () => {
      const res = await checkoutStayAtomic({
        bookingId,
        propertyId,
        idempotencyKey,
        allowBalance: allowBalance || clear,
        issueInvoice: true,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Guest checked out successfully!", {
        description: res.invoiceNumber
          ? `${res.invoiceNumber} · Room marked dirty · Safe travels from the Himalayas.`
          : "Room marked dirty · Safe travels from the Himalayas.",
        className: "glass-happy-card border-emerald-500/30",
      });
      onMoneyChanged();
      onCheckedOut?.();
    });
  }

  return (
    <div
      className={cn(
        "erp-cold-glass glass-happy-card neo-card sticky bottom-0 z-20 space-y-2 border-t px-3 py-2.5",
        className,
      )}
    >
      <div className="neo-well h-1.5" aria-hidden>
        <div
          className={cn(
            "h-full rounded-full",
            clear ? "track-gradient-mint" : "track-gradient-coral",
          )}
          style={{ width: clear ? "100%" : "100%" }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Guest stream{" "}
          <span
            className={cn(
              "font-semibold tabular-nums",
              clear
                ? "text-[color:var(--color-mint)]"
                : "text-[color:var(--color-coral)]",
            )}
          >
            {clear ? "clear" : formatGuestBtn(guestDue)}
          </span>
        </p>
        <Button
          type="button"
          size="sm"
          className="h-11 min-h-11"
          disabled={pending || !canCheckout}
          onClick={settleCheckout}
        >
          {pending ? "Checking out…" : "Settle & Check-out"}
        </Button>
      </div>

      <StayHubCashierStrip
        status={status}
        hasDoor={Boolean(roomLabel)}
        money={money}
        bookingId={bookingId}
        guestName={guestName}
        roomUnitId={roomUnitId}
        roomLabel={roomLabel}
        onPrinted={onMoneyChanged}
      />

      {money?.folioId ? (
        <StayBillAddons
          folioId={money.folioId}
          bookingId={bookingId}
          guestName={guestName ?? ""}
          roomUnitId={roomUnitId ?? null}
          roomLabel={roomLabel ?? null}
          onPosted={onMoneyChanged}
        />
      ) : null}
    </div>
  );
}
