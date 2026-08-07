"use client";

import {
  AttachToMasterForm,
  CompCreditForm,
  DepositLinkForm,
  BankProofPaymentForm,
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
};

function GroupHint({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-xs text-muted-foreground">{children}</p>;
}

/**
 * Folio desk actions grouped by intent so the default view stays short.
 * All existing server actions stay wired — layout only.
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
}: Props) {
  if (!folioOpen) {
    return (
      <div className="rounded-xl border bg-card px-4 py-5 text-sm text-muted-foreground">
        This folio is closed. Review activity below or print a receipt for
        records.
      </div>
    );
  }

  const suggested = Math.max(balanceDue, 0);
  const showPost =
    bookingCheckedIn && Boolean(bookingId);

  return (
    <div className="space-y-3">
      <Accordion
        type="multiple"
        defaultValue={[defaultGroup]}
        className="rounded-xl border bg-card px-3"
      >
        <AccordionItem value="collect" className="border-border/70">
          <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
            <span className="flex flex-col items-start gap-0.5 text-left">
              <span>Collect payment</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Cash, card, QR, deposit link, bank proof
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <GroupHint>
              Record money received against this folio. Guest extras are usually
              cash/card; agent room may settle via credit or bank later.
            </GroupHint>
            <FolioPaymentForm folioId={folioId} suggestedAmount={suggested} />
            <BankProofPaymentForm
              folioId={folioId}
              suggestedAmount={suggested}
            />
            <DepositLinkForm folioId={folioId} bookingId={bookingId} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="invoice" className="border-border/70">
          <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
            <span className="flex flex-col items-start gap-0.5 text-left">
              <span>Issue tax invoice</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                GST fiscal document for this stay
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <GroupHint>
              Issue when charges are on the folio. Print from the invoice once
              issued.
            </GroupHint>
            <IssueInvoiceButton
              folioId={folioId}
              invoiceNo={invoiceNo}
              invoiceDocId={invoiceDocId}
            />
          </AccordionContent>
        </AccordionItem>

        {showPost ? (
          <AccordionItem value="post" className="border-border/70">
            <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
              <span className="flex flex-col items-start gap-0.5 text-left">
                <span className="flex items-center gap-2">
                  Post room charges
                  {needsDay1 ? (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-200">
                      Needed
                    </span>
                  ) : null}
                </span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Day-1 package and missing room nights
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <GroupHint>
                Room package posts at check-in or night audit. Use these only if
                a night is missing.
              </GroupHint>
              {needsDay1 ? (
                <PostCheckInChargesForm
                  folioId={folioId}
                  defaultDate={arrivalDate}
                />
              ) : null}
              <PostRoomNightForm folioId={folioId} defaultDate={arrivalDate} />
            </AccordionContent>
          </AccordionItem>
        ) : null}

        <AccordionItem value="adjust" className="border-border/70">
          <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
            <span className="flex flex-col items-start gap-0.5 text-left">
              <span>Adjustments</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Comp, minibar, damage, master folio, credit note
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <GroupHint>
              Use sparingly — voids sit on each activity line (not served,
              duplicate, wrong item). Round-figure adj absorbs GST/SC chetrum so
              guests pay whole Nu from hotel rates. Minibar, amenity, comp, and
              damage add audited charges without a full POS ticket.
            </GroupHint>
            <GuestRoundFigureForm folioId={folioId} />
            <PostMinibarChargeForm folioId={folioId} items={minibarItems} />
            <CompCreditForm folioId={folioId} />
            <PostDamageChargeForm folioId={folioId} items={damageItems} />
            {!isMaster && !hasMaster ? (
              <PromoteToMasterForm folioId={folioId} />
            ) : null}
            {!isMaster ? (
              <AttachToMasterForm
                folioId={folioId}
                masterCandidates={masterCandidates}
              />
            ) : null}
            <IssueCreditNoteButton folioId={folioId} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <nav
        className={cn(
          "flex flex-col gap-2 rounded-xl border bg-muted/20 p-3",
        )}
        aria-label="Folio shortcuts"
      >
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Print &amp; leave
        </p>
        {bookingCheckedIn && bookingId ? (
          <a
            href={`/erp/check-out?id=${bookingId}`}
            className="inline-flex h-11 w-full items-center justify-center rounded-md border border-citrus/40 bg-citrus-tint/40 text-sm font-medium text-foreground hover:bg-citrus-tint/70"
          >
            Checkout guest
          </a>
        ) : null}
        <a
          href={`/erp/folios/${folioId}/receipt`}
          className="inline-flex h-11 w-full items-center justify-center rounded-md border bg-card text-sm font-medium text-foreground hover:bg-muted"
        >
          Receipt · print / email
        </a>
        {invoiceDocId ? (
          <a
            href={`/erp/invoices/${invoiceDocId}/print`}
            className="inline-flex h-11 w-full items-center justify-center rounded-md border bg-card text-sm font-medium text-foreground hover:bg-muted"
          >
            Invoice · print / email
          </a>
        ) : null}
        {bookingId ? (
          <a
            href={`/erp/reservations?booking=${bookingId}&step=stay_money`}
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
