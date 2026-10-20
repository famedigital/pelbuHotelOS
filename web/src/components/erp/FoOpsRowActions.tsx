"use client";

import { openMasterBillPrint, issueFolioInvoice } from "@/app/actions/erp-folio-ops";
import type { ErpFolioOpsState } from "@/app/actions/erp-folio-ops";
import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import type { DayOpsRow } from "@/lib/erp/day-ops-board";
import {
  recommendStayHubStep,
  type StayHubStepId,
} from "@/lib/folio/stay-hub-cycle";
import { cn } from "@/lib/utils";
import { useActionState, useTransition } from "react";
import { toast } from "sonner";

const invInitial: ErpFolioOpsState = { ok: false };

export type FoOpsBoardKind =
  | "arrivals"
  | "in_house"
  | "departures"
  | "reservations"
  | "auto";

export function useFoOpsOpenStay() {
  const stayHub = useStayHubOptional();
  return (
    row: Pick<
      DayOpsRow,
      "id" | "status" | "folio_balance_btn" | "assigned_count" | "check_in"
    >,
    board: FoOpsBoardKind,
    step?: StayHubStepId,
  ) => {
    const recommended =
      step ??
      recommendStayHubStep({
        status: row.status ?? "confirmed",
        board,
        balanceBtn: row.folio_balance_btn ?? undefined,
        hasRoomAssigned: (row.assigned_count ?? 0) > 0,
        checkInDate: row.check_in,
      });
    stayHub?.openStayHub({
      bookingId: row.id,
      step: recommended,
      board,
    });
  };
}

export function FoPrintBillButton({
  folioId,
  invHref,
  className,
}: {
  folioId: string | null;
  /** Prefer direct INV print when known */
  invHref?: string | null;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending || (!folioId && !invHref)}
      title="Print master bill"
      className={cn("h-8 min-h-8 px-2 text-[11px] md:h-7", className)}
      onClick={() => {
        if (invHref) {
          window.open(invHref, "_blank", "noopener,noreferrer");
          return;
        }
        if (!folioId) return;
        startTransition(async () => {
          const result = await openMasterBillPrint(folioId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          window.open(result.href, "_blank", "noopener,noreferrer");
        });
      }}
    >
      {pending ? "…" : "Print"}
    </Button>
  );
}

export function FoCreateInvButton({
  folioId,
  onIssued,
  className,
}: {
  folioId: string;
  onIssued?: () => void;
  className?: string;
}) {
  const [state, action, pending] = useActionState(issueFolioInvoice, invInitial);
  useActionToast(state, {
    successMessage: "Tax invoice issued",
    onSuccess: onIssued,
  });
  return (
    <form action={action} className={cn("inline", className)}>
      <input type="hidden" name="folio_id" value={folioId} />
      <Button
        type="submit"
        size="sm"
        variant="default"
        disabled={pending}
        className="h-8 min-h-8 px-2 text-[11px] md:h-7"
      >
        {pending ? "…" : "Create INV"}
      </Button>
    </form>
  );
}

export function FoStayActionButton({
  label,
  onClick,
  variant = "outline",
  className,
}: {
  label: string;
  onClick: () => void;
  variant?: "outline" | "default" | "ghost" | "destructive" | "secondary";
  className?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      className={cn("h-8 min-h-8 px-2 text-[11px] md:h-7", className)}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
