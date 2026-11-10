"use client";

import {
  AttachToMasterForm,
  BankProofPaymentForm,
  ChangeMealPlanForm,
  CompCreditForm,
  DepositLinkForm,
  GuestRoundFigureForm,
  IssueCreditNoteButton,
  IssueInvoiceButton,
  PostCheckInChargesForm,
  PostRoomNightForm,
  PromoteToMasterForm,
} from "@/components/erp/FolioOpsForms";
import { FolioPaymentForm } from "@/components/erp/FolioPaymentForm";
import { PostDamageChargeForm } from "@/components/erp/PostDamageChargeForm";
import {
  PostMinibarChargeForm,
  type MinibarPickerItem,
} from "@/components/erp/PostMinibarChargeForm";
import { formatBtn } from "@/lib/pricing";
import { buildStayHubReopenHref } from "@/lib/folio/stay-hub-cycle";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";

export type FolioMasterOption = { id: string; label: string };
export type FolioDamageOption = {
  id: string;
  label: string;
  amountBtn: number | null;
};

type Props = {
  folioId: string;
  folioOpen: boolean;
  bookingId: string | null;
  bookingCheckedIn: boolean;
  needsDay1: boolean;
  arrivalDate: string;
  balanceDue: number;
  invoiceNo: string | null;
  invoiceDocId: string | null;
  /** Current booking meal plan code (for change form). */
  mealPlanCode?: string | null;
  mealPlans?: { code: string; name: string }[];
  isMaster: boolean;
  hasMaster: boolean;
  masterCandidates: FolioMasterOption[];
  damageItems: FolioDamageOption[];
  minibarItems?: MinibarPickerItem[];
  /** Suggested default open panel based on stay money next step */
  defaultGroup: "collect" | "invoice" | "post" | "adjust";
  /** Manager rail (comp / credit note). Defaults true. */
  showManagerActions?: boolean;
};

function RailItem({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group rounded-lg border bg-card open:bg-card"
      open={defaultOpen ? true : undefined}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 text-left">
          <span className="block text-sm font-medium text-foreground">{title}</span>
          <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
            {subtitle}
          </span>
        </span>
        <span
          className="mt-1 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        >
          ▾
        </span>
      </summary>
      <div className="space-y-3 border-t px-3 py-3">{children}</div>
    </details>
  );
}

/**
 * Folio desk actions — eZee-simple primary CTAs + collapsed More / Manager.
 * Server actions unchanged; layout and copy only.
 */
export function FolioActionsPanel({
  folioId,
  folioOpen,
  bookingId,
  bookingCheckedIn,
  needsDay1,
  arrivalDate,
  balanceDue,
  invoiceNo,
  invoiceDocId,
  mealPlanCode = null,
  mealPlans = [],
  isMaster,
  hasMaster,
  masterCandidates,
  damageItems,
  minibarItems = [],
  showManagerActions = true,
}: Props) {
  const [sheetPanel, setSheetPanel] = useState<"pay" | "charge" | "more" | null>(
    null,
  );

  if (!folioOpen) {
    return (
      <div className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
        Folio closed — review activity or print a receipt.
      </div>
    );
  }

  const suggested = Math.max(balanceDue, 0);
  const hasDue = balanceDue > 0.5;
  const showPost = bookingCheckedIn && Boolean(bookingId);

  function toggleSheet(next: "pay" | "charge" | "more") {
    setSheetPanel((current) => (current === next ? null : next));
  }

  const sheetButton = (id: "pay" | "charge" | "more", label: string) => (
    <button
      type="button"
      id={id === "pay" ? "folio-collect" : undefined}
      aria-expanded={sheetPanel === id}
      onClick={() => toggleSheet(id)}
      className={cn(
        "inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium",
        sheetPanel === id
          ? "border-foreground bg-foreground text-background"
          : "bg-card hover:bg-muted",
        id === "pay" && hasDue && sheetPanel !== id && "border-citrus/50",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {sheetButton("pay", "Take payment")}
        {showPost ? sheetButton("charge", "Add a charge") : null}
        {sheetButton("more", "More")}
        <a
          href={`/erp/folios/${folioId}/bill?bill=room`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-md border bg-card px-3 text-sm font-medium hover:bg-muted"
        >
          Print folio
        </a>
        <a
          href={`/erp/folios/${folioId}/receipt`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-md px-2 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Receipt
        </a>
        <a
          href={`/erp/folios/${folioId}/bill?bill=master`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-md px-2 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {invoiceDocId ? "Invoice" : "Master bill"}
        </a>
        {bookingCheckedIn && bookingId ? (
          <a
            href={buildStayHubReopenHref({
              bookingId,
              panel: "check_out",
              board: "in_house",
            })}
            className="inline-flex h-9 items-center rounded-md px-2 text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Checkout
          </a>
        ) : null}
      </div>

      {sheetPanel === "pay" ? (
      <section
        className={cn(
          "space-y-2.5 rounded-lg border bg-card p-3",
          hasDue && "border-citrus/50 bg-citrus-tint/30",
        )}
        aria-labelledby="folio-collect-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3
              id="folio-collect-heading"
              className="text-sm font-semibold text-foreground"
            >
              Take payment
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Cash, card, or agent AR
            </p>
          </div>
          {hasDue ? (
            <span className="rounded-md bg-citrus-tint px-2 py-1 text-xs font-semibold tabular-nums text-citrus-600">
              Due {formatBtn(balanceDue)}
            </span>
          ) : (
            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              Settled
            </span>
          )}
        </div>

        {needsDay1 ? (
          <p className="text-sm text-foreground">
            Post the room charge first. Collect stays closed until that line
            is on the folio.
          </p>
        ) : !hasDue ? (
          <p className="text-sm text-foreground">
            Balance due {formatBtn(0)} · Nothing to settle
          </p>
        ) : (
          <FolioPaymentForm
            folioId={folioId}
            suggestedAmount={suggested}
            emphasized
          />
        )}

        {needsDay1 ? null : (
        <details className="rounded-lg border border-dashed">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
            More payment ways · bank proof, deposit link
          </summary>
          <div className="space-y-3 border-t px-3 py-3">
            <BankProofPaymentForm
              folioId={folioId}
              suggestedAmount={suggested}
              embedded
            />
            <DepositLinkForm
              folioId={folioId}
              bookingId={bookingId}
              embedded
            />
          </div>
        </details>
        )}
      </section>
      ) : null}

      {sheetPanel === "charge" && showPost ? (
        <div className="space-y-3 rounded-lg border bg-card p-3">
          <h3 className="text-sm font-semibold">Add a charge</h3>
          {needsDay1 ? (
            <PostCheckInChargesForm
              folioId={folioId}
              defaultDate={arrivalDate}
              embedded
            />
          ) : null}
          <PostRoomNightForm
            folioId={folioId}
            defaultDate={arrivalDate}
            embedded
          />
        </div>
      ) : null}

      {sheetPanel === "more" ? (
      <div className="space-y-2">
      <section
        id="folio-invoice"
        className="rounded-lg border bg-card p-3"
        aria-labelledby="folio-invoice-heading"
      >
        <h3
          id="folio-invoice-heading"
          className="sr-only"
        >
          Issue tax invoice
        </h3>
        <IssueInvoiceButton
          folioId={folioId}
          invoiceNo={invoiceNo}
          invoiceDocId={invoiceDocId}
          embedded
          secondary
        />
        {bookingId && folioOpen ? (
          <div className="mt-3 border-t pt-3">
            <ChangeMealPlanForm
              folioId={folioId}
              currentCode={mealPlanCode ?? "EP"}
              mealPlans={mealPlans}
              hasIssuedInvoice={Boolean(invoiceNo)}
              embedded
            />
          </div>
        ) : null}
      </section>

      <div className="space-y-2 rounded-lg border bg-card p-3">
          {minibarItems.length > 0 ? (
            <RailItem title="Minibar" subtitle="Add a minibar charge">
              <PostMinibarChargeForm
                folioId={folioId}
                items={minibarItems}
                embedded
              />
            </RailItem>
          ) : null}
          {damageItems.length > 0 ? (
            <RailItem title="Damage" subtitle="Add a damage charge">
              <PostDamageChargeForm
                folioId={folioId}
                items={damageItems}
                embedded
              />
            </RailItem>
          ) : null}
          <RailItem title="Round figure" subtitle="Round the bill to 0 or 5">
            <GuestRoundFigureForm folioId={folioId} embedded />
          </RailItem>
          {!isMaster && !hasMaster ? (
            <RailItem title="Make master folio" subtitle="Link group rooms here">
              <PromoteToMasterForm folioId={folioId} embedded />
            </RailItem>
          ) : null}
          {!isMaster && masterCandidates.length > 0 ? (
            <RailItem title="Attach to master" subtitle="Link under a group bill">
              <AttachToMasterForm
                folioId={folioId}
                masterCandidates={masterCandidates}
                embedded
              />
            </RailItem>
          ) : null}
          {showManagerActions ? (
            <>
              <RailItem title="Comp" subtitle="Courtesy credit">
                <CompCreditForm folioId={folioId} embedded />
              </RailItem>
              <RailItem title="Credit note" subtitle="Against this bill">
                <IssueCreditNoteButton folioId={folioId} embedded />
              </RailItem>
            </>
          ) : null}
        </div>
      </div>
      ) : null}
    </div>
  );
}
