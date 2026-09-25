"use client";

import {
  attachFolioToMaster,
  promoteFolioToMaster,
  setFolioLinesBillToByKind,
  splitExtrasToSiblingFolio,
  type ErpFolioOpsState,
} from "@/app/actions/erp-folio-ops";
import { AgreedRateForm } from "@/components/erp/AgreedRateForm";
import { AgentVoucherEmailButton } from "@/components/erp/AgentVoucherEmailButton";
import { ConfirmationPackSendButton } from "@/components/erp/ConfirmationPackSendButton";
import {
  GuestRoundFigureForm,
  PostRoomNightForm,
} from "@/components/erp/FolioOpsForms";
import { GuestRatePromoForm } from "@/components/erp/GuestRatePromoForm";
import { InhouseTaskQuickForm } from "@/components/erp/InhouseTasksPanel";
import { RoomNcForm } from "@/components/erp/RoomNcForm";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatGuestBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import {
  useActionState,
  useEffect,
  type ReactNode,
} from "react";
import { GuestWaMessageButtons } from "@/components/erp/GuestWaMessageButtons";
import { bookingConfirmationLabel } from "@/lib/booking-ref";

export type StayHubAdvancedBooking = {
  bookingId: string;
  assignmentId: string | null;
  chargeable: boolean;
  ncReasonCode: string | null;
  roomNcReasons: { code: string; label: string }[];
  roomLabel: string | null;
  agreedNightlyRateBtn: number | null;
  agreedRateReason: string | null;
  mealPlanCode: string | null;
  contactEmail: string | null;
  contactName: string | null;
  contactPhone?: string | null;
  confirmationCode?: string | null;
  checkOut?: string | null;
  agentId: string | null;
  checkIn: string;
};

const opsInitial: ErpFolioOpsState = { ok: false };

/**
 * StayHub Folio → Advanced: accordion tools for manager rate / NC /
 * multi-folio split — not a stack of tall card forms.
 */
export function StayHubAdvancedPanel({
  booking,
  folioId,
  masterCandidates = [],
  onRefresh,
  onOpenVoucher,
  className,
}: {
  booking: StayHubAdvancedBooking;
  folioId: string;
  /** Open master folios for attach. */
  masterCandidates?: Array<{ id: string; label: string }>;
  onRefresh: () => void;
  onOpenVoucher: () => void;
  className?: string;
}) {
  const rateStatus =
    booking.agreedNightlyRateBtn != null
      ? `${formatGuestBtn(booking.agreedNightlyRateBtn)}/nt`
      : "Rate sheet";
  const ncStatus = booking.chargeable
    ? "Chargeable"
    : `NC${booking.ncReasonCode ? ` · ${booking.ncReasonCode}` : ""}`;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="rounded-md border bg-muted/20 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
        <span className="font-medium text-foreground">Room discount / event:</span>{" "}
        <span className="font-medium text-foreground">Rates &amp; discount</span>{" "}
        → agreed Nu/night + manager PIN (rebalances posted room rent). Void a
        line on <span className="font-medium text-foreground">Bill</span>. Zero
        rent → <span className="font-medium text-foreground">Room NC</span>.
      </p>

      <div className="overflow-hidden rounded-md border bg-card">
        <AdvSection title="Rates & discount" meta={rateStatus} defaultOpen>
          <p className="text-[10px] leading-snug text-muted-foreground">
            Agent deal, event, service recovery. Future nights + posted lines
            adjust when you set or clear.
          </p>
          <AgreedRateForm
            bookingId={booking.bookingId}
            currentRateBtn={booking.agreedNightlyRateBtn}
            currentReason={booking.agreedRateReason}
            mealPlanCode={booking.mealPlanCode}
            roomLabel={booking.roomLabel}
            onSuccess={onRefresh}
            compact
          />
        </AdvSection>

        <AdvSection title="Guest promo code" meta="Next stay">
          <GuestRatePromoForm
            bookingId={booking.bookingId}
            defaultNightlyRateBtn={booking.agreedNightlyRateBtn}
            defaultEmail={booking.contactEmail}
            guestName={booking.contactName}
            onSuccess={onRefresh}
            compact
          />
        </AdvSection>

        {booking.assignmentId ? (
          <AdvSection title="Room NC" meta={ncStatus}>
            <RoomNcForm
              assignmentId={booking.assignmentId}
              chargeable={booking.chargeable}
              ncReasonCode={booking.ncReasonCode}
              reasons={booking.roomNcReasons}
              roomLabel={booking.roomLabel}
              onSuccess={onRefresh}
              compact
            />
          </AdvSection>
        ) : null}

        <AdvSection title="Post room night" meta="Manual">
          <PostRoomNightForm folioId={folioId} defaultDate={booking.checkIn} />
        </AdvSection>

        <AdvSection title="Round figure" meta="Convenience">
          <GuestRoundFigureForm folioId={folioId} embedded />
        </AdvSection>

        <AdvSection title="In-house task" meta="Ops">
          <InhouseTaskQuickForm bookingId={booking.bookingId} />
        </AdvSection>

        <AdvSection title="Bill split / multi-folio" meta="Room vs extras" defaultOpen>
          <StayHubBillSplitTools
            folioId={folioId}
            hasAgent={Boolean(booking.agentId)}
            masterCandidates={masterCandidates}
            onRefresh={onRefresh}
          />
        </AdvSection>

        <AdvSection title="Guest WhatsApp" meta="Templates">
          <GuestWaMessageButtons
            phone={booking.contactPhone}
            guestName={booking.contactName ?? "Guest"}
            confLabel={bookingConfirmationLabel({
              confirmationCode: booking.confirmationCode,
              bookingId: booking.bookingId,
            })}
            checkIn={booking.checkIn}
            checkOut={booking.checkOut}
          />
        </AdvSection>

        <AdvSection
          title="Agent AR settle"
          meta={booking.agentId ? "City ledger" : "—"}
        >
          {booking.agentId ? (
            <p className="text-[11px] leading-snug text-muted-foreground">
              Guest cash on Folio → Collect. Charge agent book with tender{" "}
              <span className="font-medium text-foreground">Charge agent AR</span>.
              Agent dossier posts paid / balance — same job as eZee Cashiering
              Center.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Assign an agent on Details to enable AR.
            </p>
          )}
        </AdvSection>

        <AdvSection
          title="Confirmation pack"
          meta="Email"
        >
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Voucher (no rates) + proforma (with rates) to agent or guest email.
            </p>
            <ConfirmationPackSendButton bookingId={booking.bookingId} />
          </div>
        </AdvSection>

        <AdvSection
          title="Agent voucher"
          meta={booking.agentId ? "Ready" : "No agent"}
        >
          {booking.agentId ? (
            <div className="flex flex-wrap gap-1.5">
              <AgentVoucherEmailButton bookingId={booking.bookingId} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 min-h-8 text-xs"
                onClick={onOpenVoucher}
              >
                Print voucher
              </Button>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Assign an agent on Details first.
            </p>
          )}
        </AdvSection>
      </div>
    </div>
  );
}

function StayHubBillSplitTools({
  folioId,
  hasAgent,
  masterCandidates,
  onRefresh,
}: {
  folioId: string;
  hasAgent: boolean;
  masterCandidates: Array<{ id: string; label: string }>;
  onRefresh: () => void;
}) {
  const [splitState, splitAction, splitPending] = useActionState(
    setFolioLinesBillToByKind,
    opsInitial,
  );
  const [extrasState, extrasAction, extrasPending] = useActionState(
    splitExtrasToSiblingFolio,
    opsInitial,
  );
  const [promoteState, promoteAction, promotePending] = useActionState(
    promoteFolioToMaster,
    opsInitial,
  );
  const [attachState, attachAction, attachPending] = useActionState(
    attachFolioToMaster,
    opsInitial,
  );

  useActionToast(splitState, { successMessage: "Payor updated" });
  useActionToast(extrasState, { successMessage: "Extras folio ready" });
  useActionToast(promoteState, { successMessage: "Master folio" });
  useActionToast(attachState, { successMessage: "Attached to master" });

  useEffect(() => {
    if (
      splitState.ok ||
      extrasState.ok ||
      promoteState.ok ||
      attachState.ok
    ) {
      onRefresh();
    }
  }, [splitState.ok, extrasState.ok, promoteState.ok, attachState.ok, onRefresh]);

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-snug text-muted-foreground">
        eZee room vs extras without Excel: put F&amp;B on agent tab, or spin off
        a sibling extras folio. Master attach for bus / company gather.
      </p>

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          1 · Bill-to (same folio)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {hasAgent ? (
            <form action={splitAction}>
              <input type="hidden" name="folio_id" value={folioId} />
              <input type="hidden" name="mode" value="fnb_agent" />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={splitPending}
              >
                F&amp;B → agent tab
              </Button>
            </form>
          ) : null}
          <form action={splitAction}>
            <input type="hidden" name="folio_id" value={folioId} />
            <input type="hidden" name="mode" value="fnb_guest" />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={splitPending}
            >
              F&amp;B → guest
            </Button>
          </form>
          {hasAgent ? (
            <form action={splitAction}>
              <input type="hidden" name="folio_id" value={folioId} />
              <input type="hidden" name="mode" value="room_agent" />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={splitPending}
              >
                Room → agent tab
              </Button>
            </form>
          ) : null}
        </div>
        {splitState.error ? (
          <p className="text-xs text-destructive">{splitState.error}</p>
        ) : null}
        {splitState.ok && splitState.message ? (
          <p className="text-xs text-emerald-800 dark:text-emerald-200">
            {splitState.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          2 · Physical extras folio
        </p>
        <form action={extrasAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="folio_id" value={folioId} />
          <Button
            type="submit"
            size="sm"
            variant="citrus"
            className="h-8 text-xs"
            disabled={extrasPending}
          >
            {extrasPending ? "Splitting…" : "Split F&B → new extras folio"}
          </Button>
          {extrasState.token ? (
            <a
              href={`/erp/folios/${extrasState.token}`}
              className="text-xs font-medium text-accent underline-offset-2 hover:underline"
            >
              Open extras folio
            </a>
          ) : null}
        </form>
        {extrasState.error ? (
          <p className="text-xs text-destructive">{extrasState.error}</p>
        ) : null}
        {extrasState.ok && extrasState.message ? (
          <p className="text-xs text-emerald-800 dark:text-emerald-200">
            {extrasState.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5 border-t pt-2">
        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Master / city ledger
        </p>
        <form action={promoteAction} className="inline-flex">
          <input type="hidden" name="folio_id" value={folioId} />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={promotePending}
          >
            Make this master
          </Button>
        </form>
        {masterCandidates.length > 0 ? (
          <form action={attachAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="folio_id" value={folioId} />
            <select
              name="master_folio_id"
              required
              className="h-8 max-w-[14rem] rounded-md border bg-background px-2 text-xs"
              defaultValue=""
            >
              <option value="" disabled>
                Attach to master…
              </option>
              {masterCandidates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={attachPending}
            >
              Attach
            </Button>
          </form>
        ) : null}
        {promoteState.error || attachState.error ? (
          <p className="text-xs text-destructive">
            {promoteState.error ?? attachState.error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
            <a href={`/erp/folios/${folioId}`}>Full folio tools</a>
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
            <a href={`/erp/folios/${folioId}/statement`}>Master statement</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function AdvSection({
  title,
  meta,
  defaultOpen,
  children,
}: {
  title: string;
  meta?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      className="group border-b border-border/80 last:border-b-0"
      open={defaultOpen}
    >
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 select-none [&::-webkit-details-marker]:hidden">
        <ChevronDownIcon
          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
        <span className="text-xs font-semibold text-foreground">{title}</span>
        {meta ? (
          <span className="ml-auto max-w-[9rem] truncate text-[10px] tabular-nums text-muted-foreground">
            {meta}
          </span>
        ) : null}
      </summary>
      <div className="space-y-2 border-t bg-muted/15 px-2.5 py-2">{children}</div>
    </details>
  );
}
