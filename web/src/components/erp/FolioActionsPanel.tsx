"use client";

import {
  AttachToMasterForm,
  BankProofPaymentForm,
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
import type { ReactNode } from "react";

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
  isMaster,
  hasMaster,
  masterCandidates,
  damageItems,
  minibarItems = [],
  defaultGroup,
  showManagerActions = true,
}: Props) {
  if (!folioOpen) {
    return (
      <div className="rounded-xl border bg-card px-4 py-5 text-sm text-muted-foreground">
        Folio closed — review activity or print a receipt.
      </div>
    );
  }

  const suggested = Math.max(balanceDue, 0);
  const hasDue = balanceDue > 0.5;
  const showPost = bookingCheckedIn && Boolean(bookingId);
  const postOpen = needsDay1 || defaultGroup === "post";

  return (
    <div className="space-y-3">
      {/* —— Primary: always visible —— */}
      <section
        id="folio-collect"
        className={cn(
          "space-y-3 rounded-xl border bg-card p-3 sm:p-4",
          hasDue && "border-citrus/50 bg-citrus-tint/20 shadow-sm",
        )}
        aria-labelledby="folio-collect-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3
              id="folio-collect-heading"
              className="text-sm font-semibold text-foreground"
            >
              Settle guest or agent AR
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Collect cash/card · or charge agent AR book (agent owes)
            </p>
          </div>
          {hasDue ? (
            <span className="rounded-md bg-maroon/10 px-2 py-1 text-xs font-semibold tabular-nums text-maroon">
              Due {formatBtn(balanceDue)}
            </span>
          ) : (
            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              Nothing due
            </span>
          )}
        </div>

        {!hasDue ? (
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
      </section>

      <section
        id="folio-invoice"
        className="rounded-xl border bg-card p-3 sm:p-4"
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
      </section>

      {showPost ? (
        <RailItem
          title="Post room charges"
          subtitle={
            needsDay1 ? "Day-1 needed" : "Missing night only"
          }
          defaultOpen={postOpen}
        >
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
        </RailItem>
      ) : null}

      {/* —— More: collapsed —— */}
      <details
        className="rounded-xl border bg-card open:shadow-sm"
        open={defaultGroup === "adjust" ? true : undefined}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="flex flex-col items-start gap-0.5 text-left">
            <span>More</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              Minibar, damage, round, group
            </span>
          </span>
          <span className="text-muted-foreground" aria-hidden>
            ▾
          </span>
        </summary>
        <div className="space-y-2 border-t px-3 py-3">
          <p className="text-[11px] text-muted-foreground">
            Void wrong charges on the activity line.
          </p>
          {minibarItems.length > 0 ? (
            <RailItem title="Minibar / amenity" subtitle="Quick charge to folio">
              <PostMinibarChargeForm
                folioId={folioId}
                items={minibarItems}
                embedded
              />
            </RailItem>
          ) : null}
          {damageItems.length > 0 ? (
            <RailItem title="Damage / extra charge" subtitle="Guest bill add-on">
              <PostDamageChargeForm
                folioId={folioId}
                items={damageItems}
                embedded
              />
            </RailItem>
          ) : null}
          <RailItem title="Round figure" subtitle="Rate adj to Nu 0 or 5">
            <GuestRoundFigureForm folioId={folioId} embedded />
          </RailItem>
          {!isMaster && !hasMaster ? (
            <RailItem title="Make master folio" subtitle="Link group rooms here">
              <PromoteToMasterForm folioId={folioId} embedded />
            </RailItem>
          ) : null}
          {!isMaster && masterCandidates.length > 0 ? (
            <RailItem title="Attach to master" subtitle="Link under city ledger">
              <AttachToMasterForm
                folioId={folioId}
                masterCandidates={masterCandidates}
                embedded
              />
            </RailItem>
          ) : null}
        </div>
      </details>

      {/* —— Manager: collapsed —— */}
      {showManagerActions ? (
        <details className="rounded-xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span className="flex flex-col items-start gap-0.5 text-left">
              <span>Manager</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Comp / NC, credit note
              </span>
            </span>
            <span className="text-muted-foreground" aria-hidden>
              ▾
            </span>
          </summary>
          <div className="space-y-2 border-t px-3 py-3">
            <RailItem title="Comp / NC" subtitle="Courtesy credit">
              <CompCreditForm folioId={folioId} embedded />
            </RailItem>
            <RailItem title="Credit note" subtitle="Fiscal CN against folio">
              <IssueCreditNoteButton folioId={folioId} embedded />
            </RailItem>
          </div>
        </details>
      ) : null}

      <nav
        className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-3"
        aria-label="Folio shortcuts"
      >
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Print &amp; leave
        </p>
        {bookingCheckedIn && bookingId ? (
          <a
            href={buildStayHubReopenHref({
              bookingId,
              panel: "check_out",
              board: "in_house",
            })}
            className="inline-flex h-11 w-full items-center justify-center rounded-md border border-citrus/40 bg-citrus-tint/40 text-sm font-medium text-foreground hover:bg-citrus-tint/70"
          >
            Checkout guest
          </a>
        ) : null}
        <a
          href={`/erp/folios/${folioId}/receipt`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 w-full items-center justify-center rounded-md border bg-card text-sm font-medium text-foreground hover:bg-muted"
        >
          Receipt · print / email
        </a>
        {invoiceDocId ? (
          <a
            href={`/erp/invoices/${invoiceDocId}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 w-full items-center justify-center rounded-md border bg-card text-sm font-medium text-foreground hover:bg-muted"
          >
            Invoice · print / email
          </a>
        ) : null}
        {bookingId ? (
          <a
            href={buildStayHubReopenHref({
              bookingId,
              panel: "stay_money",
              board: bookingCheckedIn ? "in_house" : "reservations",
            })}
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-transparent text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Open Stay hub money
          </a>
        ) : null}
        <a
          href="/erp/folios"
          className="inline-flex h-9 w-full items-center justify-center rounded-md text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          City ledger list
        </a>
      </nav>
    </div>
  );
}
