"use client";

import {
  attachFolioToMaster,
  createDepositLink,
  issueFolioCreditNote,
  issueFolioInvoice,
  issueFolioReceipt,
  markDepositLinkPaid,
  postCompCredit,
  postFolioCheckInCharges,
  postFolioRoomNight,
  postGuestRoundFigureAdj,
  previewFolioRoomNight,
  promoteFolioToMaster,
  submitBankPaymentProof,
  transferFolioLine,
  voidFolioLine,
  type ErpFolioOpsState,
} from "@/app/actions/erp-folio-ops";
import { PeriodOverrideFields } from "@/components/erp/PeriodOverrideFields";
import { CloudinaryDocField } from "@/components/erp/CloudinaryDocField";
import { CloudinaryPicker } from "@/components/erp/CloudinaryPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { cloudinaryOriginalUrl } from "@/lib/cloudinary";
import { formatGuestBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { useActionState, useState, useTransition } from "react";

const initial: ErpFolioOpsState = { ok: false };

function selectClass() {
  return "mt-1.5 flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer";
}

function Flash({ state }: { state: ErpFolioOpsState }) {
  if (!state.ok && !state.error) return null;
  return (
    <p
      className={`erp mt-2 text-sm ${state.ok ? "text-foreground" : "text-destructive"}`}
      role="status"
    >
      {state.ok ? state.message : state.error}
      {state.token ? (
        <>
          {" "}
          <a
            href={`/pay/${state.token}`}
            className="font-mono text-xs text-accent underline-offset-4 hover:underline"
          >
            /pay/{state.token}
          </a>
        </>
      ) : null}
    </p>
  );
}

export function VoidLineButton({
  lineId,
  description,
  collapsed = false,
}: {
  lineId: string;
  description?: string;
  /** StayHub bill — hide form until FO opens Void */
  collapsed?: boolean;
}) {
  const [state, action, pending] = useActionState(voidFolioLine, initial);
  const periodLocked =
    Boolean(state.error) &&
    /locked accounting period|period override/i.test(state.error ?? "");
  useActionToast(state, {
    successMessage:
      state.message ??
      "Line voided. Guest due updated — reopen the tax invoice if one exists.",
  });

  const form = (
    <form action={action} className={cn("erp space-y-1.5", !collapsed && "mt-2")}>
      <input type="hidden" name="line_id" value={lineId} />
      {!collapsed ? (
        <p className="text-[11px] text-muted-foreground">
          Wrong charge? Void credits the folio.
          {description ? (
            <span className="sr-only"> {description}</span>
          ) : null}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          name="void_reason"
          required
          defaultValue=""
          className={`${selectClass()} max-w-[11rem] text-xs h-8`}
          aria-label="Void reason"
        >
          <option value="" disabled>
            Why void…
          </option>
          <option value="Not served">Not served</option>
          <option value="Duplicate charge">Duplicate charge</option>
          <option value="Wrong item">Wrong item</option>
          <option value="Guest refused / returned">Guest refused / returned</option>
          <option value="Charged wrong folio">Charged wrong folio</option>
          <option value="Other — see notes">Other — see notes</option>
        </select>
        <Input
          name="void_reason_detail"
          placeholder="Notes"
          className="h-8 min-w-[6rem] max-w-[10rem] flex-1 text-xs"
        />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={pending}
          className="h-8 min-h-8 text-xs font-medium text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          {pending ? "Voiding…" : "Void"}
        </Button>
      </div>
      <PeriodOverrideFields
        idPrefix={`void-${lineId.slice(0, 8)}`}
        defaultOpen={periodLocked}
      />
      <Flash state={state} />
    </form>
  );

  if (!collapsed) return form;

  return (
    <details className="group w-full text-right">
      <summary className="cursor-pointer list-none text-[10px] font-medium text-muted-foreground underline-offset-2 hover:text-destructive hover:underline [&::-webkit-details-marker]:hidden">
        Void
      </summary>
      <div className="mt-1.5 rounded-md border bg-muted/20 px-2 py-1.5 text-left">
        {form}
      </div>
    </details>
  );
}

export function GuestRoundFigureForm({
  folioId,
  embedded = false,
}: {
  folioId: string;
  embedded?: boolean;
}) {
  const [state, action, pending] = useActionState(
    postGuestRoundFigureAdj,
    initial,
  );
  useActionToast(state, { successMessage: "Rate round adj posted" });
  return (
    <form
      action={action}
      className={
        embedded
          ? "erp space-y-3"
          : "erp space-y-3 rounded-lg border bg-card p-4"
      }
    >
      {!embedded ? (
        <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Round figure
        </h3>
      ) : null}
      <input type="hidden" name="folio_id" value={folioId} />
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="h-10 w-full"
      >
        {pending ? "Posting…" : "Round to Nu ending 0 or 5"}
      </Button>
      <PeriodOverrideFields idPrefix={`round-${folioId.slice(0, 8)}`} />
      <Flash state={state} />
    </form>
  );
}

export function TransferLineForm({
  lineId,
  siblingFolios,
}: {
  lineId: string;
  siblingFolios: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(transferFolioLine, initial);
  useActionToast(state, { successMessage: "Line transferred" });
  if (siblingFolios.length === 0) return null;
  return (
    <form action={action} className="erp mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="line_id" value={lineId} />
      <select
        name="target_folio_id"
        required
        className={`${selectClass()} max-w-[220px]`}
        defaultValue=""
      >
        <option value="" disabled>
          Transfer to folio…
        </option>
        {siblingFolios.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline" size="sm" disabled={pending} className="text-xs">
        {pending ? "Moving…" : "Transfer"}
      </Button>
      <Flash state={state} />
    </form>
  );
}

export function CompCreditForm({
  folioId,
  embedded = false,
}: {
  folioId: string;
  embedded?: boolean;
}) {
  const [state, action, pending] = useActionState(postCompCredit, initial);
  useActionToast(state, { successMessage: "Comp credit posted" });
  return (
    <form
      action={action}
      className={
        embedded
          ? "erp space-y-3"
          : "erp space-y-3 rounded-lg border bg-card p-4"
      }
    >
      {!embedded ? (
        <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Comp / NC
        </h3>
      ) : null}
      <input type="hidden" name="folio_id" value={folioId} />
      <div className="space-y-1.5">
        <Label htmlFor="comp_amount_btn" className="text-xs text-muted-foreground">
          Amount (Nu)
        </Label>
        <Input
          id="comp_amount_btn"
          name="amount_btn"
          type="number"
          min="0.01"
          step="0.01"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="comp_reason" className="text-xs text-muted-foreground">
          Reason (audited)
        </Label>
        <Input id="comp_reason" name="comp_reason" required />
      </div>
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="h-10 w-full"
      >
        {pending ? "Posting…" : "Post comp credit"}
      </Button>
      <PeriodOverrideFields idPrefix={`comp-${folioId.slice(0, 8)}`} />
      <Flash state={state} />
    </form>
  );
}

export function DepositLinkForm({
  folioId,
  bookingId,
  embedded = false,
}: {
  folioId: string;
  bookingId: string | null;
  embedded?: boolean;
}) {
  const [state, action, pending] = useActionState(createDepositLink, initial);
  useActionToast(state, { successMessage: "Deposit link created" });
  return (
    <form
      action={action}
      className={
        embedded
          ? "erp space-y-3"
          : "erp space-y-3 rounded-lg border bg-card p-4"
      }
    >
      {!embedded ? (
        <>
          <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Deposit / QR link
          </h3>
          <p className="text-xs text-muted-foreground">
            Share bank QR / NEFT link for guest payment.
          </p>
        </>
      ) : (
        <p className="text-sm font-medium">Deposit / QR link</p>
      )}
      <input type="hidden" name="folio_id" value={folioId} />
      {bookingId ? (
        <input type="hidden" name="booking_id" value={bookingId} />
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="deposit_amount_btn" className="text-xs text-muted-foreground">
          Amount (Nu)
        </Label>
        <Input
          id="deposit_amount_btn"
          name="amount_btn"
          type="number"
          min="0.01"
          step="0.01"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="payee_name" className="text-xs text-muted-foreground">
          Guest name
        </Label>
        <Input id="payee_name" name="payee_name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="payee_phone" className="text-xs text-muted-foreground">
          Phone
        </Label>
        <Input id="payee_phone" name="payee_phone" />
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="h-10 w-full"
      >
        {pending ? "Creating…" : "Create deposit link"}
      </Button>
      <Flash state={state} />
    </form>
  );
}

export function MarkLinkPaidForm({ linkId }: { linkId: string }) {
  const [state, action, pending] = useActionState(markDepositLinkPaid, initial);
  useActionToast(state, { successMessage: "Link marked paid" });
  return (
    <form action={action} className="erp mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="link_id" value={linkId} />
      <div className="block space-y-1.5">
        <Label htmlFor="link_method" className="text-[11px] text-muted-foreground">
          Method
        </Label>
        <select
          id="link_method"
          name="method"
          defaultValue="bank_qr"
          className={selectClass()}
        >
          <option value="bank_qr">Bank QR</option>
          <option value="pay_bt">Pay.bt</option>
          <option value="bank">Bank transfer</option>
          <option value="cash">Cash</option>
          <option value="deposit">Deposit</option>
        </select>
      </div>
      <div className="block min-w-[120px] flex-1 space-y-1.5">
        <Label htmlFor="link_reference" className="text-[11px] text-muted-foreground">
          Ref
        </Label>
        <Input id="link_reference" name="reference" />
      </div>
      <Button
        type="submit"
        variant="default"
        size="sm"
        disabled={pending}
        className="h-10 text-xs"
      >
        {pending ? "Marking…" : "Mark paid"}
      </Button>
      <PeriodOverrideFields idPrefix={`link-${linkId.slice(0, 8)}`} />
      <Flash state={state} />
    </form>
  );
}

export function IssueInvoiceButton({
  folioId,
  invoiceNo,
  invoiceDocId,
  embedded = false,
  secondary = false,
  onIssued,
}: {
  folioId: string;
  invoiceNo?: string | null;
  invoiceDocId?: string | null;
  embedded?: boolean;
  /** Secondary CTA styling when always visible on the rail */
  secondary?: boolean;
  /** Refresh StayHub money / parent after a successful issue. */
  onIssued?: () => void;
}) {
  const [state, action, pending] = useActionState(issueFolioInvoice, initial);
  useActionToast(state, {
    successMessage: "Tax invoice issued",
    onSuccess: onIssued,
  });

  if (invoiceNo) {
    return (
      <div
        className={
          embedded
            ? "erp text-sm"
            : "erp rounded-lg border bg-card p-4 text-sm"
        }
      >
        <p className="text-sm font-semibold text-foreground">Tax invoice</p>
        <p className="mt-1 font-mono font-medium text-foreground">{invoiceNo}</p>
        {invoiceDocId ? (
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <a
              href={`/erp/invoices/${invoiceDocId}/print?bill=master`}
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              Master bill
            </a>
            <a
              href={`/erp/invoices/${invoiceDocId}/print?bill=room`}
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              Room bill
            </a>
            <a
              href={`/erp/invoices/${invoiceDocId}/print?bill=fnb`}
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              F&amp;B bill
            </a>
            <a
              href={`/erp/folios/${folioId}/receipt`}
              className="text-muted-foreground underline-offset-4 hover:underline"
            >
              Receipt
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form
      action={action}
      className={
        embedded
          ? "erp space-y-2"
          : "erp space-y-3 rounded-lg border bg-card p-4"
      }
    >
      <input type="hidden" name="folio_id" value={folioId} />
      {!embedded ? (
        <>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Tax invoice
          </p>
          <p className="text-xs text-muted-foreground">Gapless GST invoice no.</p>
        </>
      ) : (
        <div>
          <p className="text-sm font-semibold text-foreground">Issue tax invoice</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            GST fiscal document
          </p>
        </div>
      )}
      <PeriodOverrideFields idPrefix={`inv-${folioId.slice(0, 8)}`} />
      <Button
        type="submit"
        variant={secondary || embedded ? "outline" : "outline"}
        disabled={pending}
        className="h-10 w-full"
      >
        {pending ? "Issuing…" : "Issue tax invoice"}
      </Button>
      <Flash state={state} />
    </form>
  );
}

/** Post day-1 room rent + priced meal plan (idempotent backfill). */
export function PostCheckInChargesForm({
  folioId,
  defaultDate,
  embedded = false,
}: {
  folioId: string;
  defaultDate: string;
  embedded?: boolean;
}) {
  const [state, action, pending] = useActionState(postFolioCheckInCharges, initial);
  useActionToast(state, { successMessage: "Day-1 charges updated" });
  return (
    <form
      action={action}
      className={
        embedded
          ? "erp space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-3"
          : "erp space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-4"
      }
    >
      <input type="hidden" name="folio_id" value={folioId} />
      <p className="text-sm font-medium text-foreground">Day-1 charges</p>
      <p className="text-[11px] text-muted-foreground">
        Room + meals for{" "}
        <span className="font-mono text-foreground">{defaultDate}</span>
      </p>
      <Button type="submit" disabled={pending} className="h-10 w-full">
        {pending ? "Posting…" : "Post day-1 room + meals"}
      </Button>
      <Flash state={state} />
    </form>
  );
}

/** Manual room-night post for a chosen business date (preview amounts first). */
export function PostRoomNightForm({
  folioId,
  defaultDate,
  embedded = false,
}: {
  folioId: string;
  defaultDate: string;
  embedded?: boolean;
}) {
  const [state, action, pending] = useActionState(postFolioRoomNight, initial);
  const [previewPending, startPreview] = useTransition();
  const [preview, setPreview] = useState<{
    lines: Array<{
      roomLabel: string;
      businessDate: string;
      totalBtn: number;
      alreadyPosted: boolean;
      note?: string;
    }>;
    willPost: number;
    alreadyPosted: number;
    error?: string;
  } | null>(null);
  useActionToast(state, { successMessage: "Room night posted" });

  function runPreview(form: HTMLFormElement) {
    const fd = new FormData(form);
    startPreview(async () => {
      const res = await previewFolioRoomNight(fd);
      if (!res.ok) {
        setPreview({
          lines: [],
          willPost: 0,
          alreadyPosted: 0,
          error: res.error ?? "Preview failed",
        });
        return;
      }
      setPreview({
        lines: res.lines ?? [],
        willPost: res.willPost ?? 0,
        alreadyPosted: res.alreadyPosted ?? 0,
        error: res.error,
      });
    });
  }

  return (
    <form
      action={action}
      className={
        embedded
          ? "erp space-y-3"
          : "erp space-y-3 rounded-lg border bg-card p-4"
      }
      onChange={() => setPreview(null)}
    >
      <input type="hidden" name="folio_id" value={folioId} />
      {!embedded ? (
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Post missing nights
        </p>
      ) : (
        <p className="text-sm font-medium">Post missing nights</p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Same poster as night audit. Preview amounts before posting.
      </p>
      <div>
        <Label htmlFor="rn_business_date" className="text-xs">
          Business date
        </Label>
        <Input
          id="rn_business_date"
          name="business_date"
          type="date"
          defaultValue={defaultDate}
          required
          className="mt-1.5"
        />
      </div>
      {preview ? (
        <div className="rounded-md border bg-muted/20 px-2.5 py-2 text-xs">
          {preview.error ? (
            <p className="text-destructive">{preview.error}</p>
          ) : null}
          {preview.lines.length === 0 && !preview.error ? (
            <p className="text-muted-foreground">Nothing to post for that date.</p>
          ) : (
            <ul className="space-y-1">
              {preview.lines.map((l) => (
                <li
                  key={`${l.roomLabel}-${l.businessDate}-${l.alreadyPosted}`}
                  className="flex justify-between gap-2 tabular-nums"
                >
                  <span>
                    Room {l.roomLabel}
                    {l.alreadyPosted ? " · already posted" : ""}
                    {l.note ? ` · ${l.note}` : ""}
                  </span>
                  <span className="font-medium">
                    {formatGuestBtn(l.totalBtn)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Will post {preview.willPost} · already on folio {preview.alreadyPosted}
          </p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          disabled={previewPending || pending}
          className="h-10 flex-1"
          onClick={(e) => {
            const form = (e.currentTarget as HTMLButtonElement).form;
            if (form) runPreview(form);
          }}
        >
          {previewPending ? "Previewing…" : "Preview amounts"}
        </Button>
        <Button
          type="submit"
          variant="default"
          disabled={pending || previewPending}
          className="h-10 flex-1"
        >
          {pending ? "Posting…" : "Post room night"}
        </Button>
      </div>
      <Flash state={state} />
    </form>
  );
}

export function IssueCreditNoteButton({
  folioId,
  embedded = false,
}: {
  folioId: string;
  embedded?: boolean;
}) {
  const [state, action, pending] = useActionState(issueFolioCreditNote, initial);
  useActionToast(state, { successMessage: "Credit note issued" });
  return (
    <form
      action={action}
      className={
        embedded
          ? "erp space-y-3"
          : "erp space-y-3 rounded-lg border bg-card p-4"
      }
    >
      <input type="hidden" name="folio_id" value={folioId} />
      {!embedded ? (
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Credit note
        </p>
      ) : null}
      <PeriodOverrideFields idPrefix={`cn-${folioId.slice(0, 8)}`} />
      <Button type="submit" variant="outline" disabled={pending} className="h-10 w-full">
        {pending ? "Issuing…" : "Issue credit note"}
      </Button>
      <Flash state={state} />
    </form>
  );
}

export function IssueReceiptButton({
  folioId,
  receiptNo,
  paymentId,
}: {
  folioId: string;
  receiptNo?: string | null;
  paymentId?: string | null;
}) {
  const [state, action, pending] = useActionState(issueFolioReceipt, initial);
  useActionToast(state, { successMessage: "Receipt issued" });

  if (receiptNo) {
    return (
      <p className="text-sm text-muted-foreground">
        Fiscal receipt{" "}
        <span className="font-mono font-medium text-foreground">{receiptNo}</span>
      </p>
    );
  }

  return (
    <form action={action} className="erp flex flex-wrap items-end gap-2 print:hidden">
      <input type="hidden" name="folio_id" value={folioId} />
      {paymentId ? <input type="hidden" name="payment_id" value={paymentId} /> : null}
      <PeriodOverrideFields idPrefix={`rcp-${folioId.slice(0, 8)}`} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Issuing…" : "Issue fiscal receipt no."}
      </Button>
      <Flash state={state} />
    </form>
  );
}

export function PromoteToMasterForm({
  folioId,
  embedded = false,
}: {
  folioId: string;
  embedded?: boolean;
}) {
  const [state, action, pending] = useActionState(promoteFolioToMaster, initial);
  useActionToast(state, { successMessage: "Promoted to master folio" });
  return (
    <form
      action={action}
      className={
        embedded
          ? "erp space-y-3"
          : "erp space-y-3 rounded-lg border bg-card p-4"
      }
    >
      <input type="hidden" name="folio_id" value={folioId} />
      {!embedded ? (
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Make master folio
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending} className="h-10 w-full">
        {pending ? "Promoting…" : "Make master folio"}
      </Button>
      <Flash state={state} />
    </form>
  );
}

export function AttachToMasterForm({
  folioId,
  masterCandidates,
  embedded = false,
}: {
  folioId: string;
  masterCandidates: Array<{ id: string; label: string }>;
  embedded?: boolean;
}) {
  const [state, action, pending] = useActionState(attachFolioToMaster, initial);
  useActionToast(state, { successMessage: "Attached to master" });
  if (masterCandidates.length === 0) return null;
  return (
    <form
      action={action}
      className={
        embedded
          ? "erp space-y-3"
          : "erp space-y-3 rounded-lg border bg-card p-4"
      }
    >
      <input type="hidden" name="folio_id" value={folioId} />
      {!embedded ? (
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Attach to master
        </p>
      ) : null}
      <div>
        <Label htmlFor={`master-${folioId.slice(0, 8)}`}>Master folio</Label>
        <select
          id={`master-${folioId.slice(0, 8)}`}
          name="master_folio_id"
          required
          className={selectClass()}
          defaultValue=""
        >
          <option value="" disabled>
            Select master…
          </option>
          {masterCandidates.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="h-10 w-full">
        {pending ? "Attaching…" : "Attach"}
      </Button>
      <Flash state={state} />
    </form>
  );
}

export function BankProofPaymentForm({
  folioId,
  suggestedAmount,
  embedded = false,
}: {
  folioId: string;
  suggestedAmount: number;
  embedded?: boolean;
}) {
  const [state, action, pending] = useActionState(submitBankPaymentProof, initial);
  useActionToast(state, { successMessage: "Proof submitted — pending bank" });
  const [proofUrl, setProofUrl] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [intent, setIntent] = useState<"camera" | "file">("camera");

  return (
    <form
      action={action}
      className={
        embedded
          ? "erp space-y-3"
          : "erp space-y-3 rounded-lg border bg-card p-4"
      }
    >
      {embedded ? (
        <p className="text-sm font-medium">Bank QR / NEFT proof</p>
      ) : (
        <>
          <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Bank QR / NEFT proof
          </h3>
          <p className="text-xs text-muted-foreground">
            Upload proof → Finance confirms.
          </p>
        </>
      )}
      <input type="hidden" name="folio_id" value={folioId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="proof_method">Method</Label>
          <select id="proof_method" name="method" defaultValue="bank_qr" className={selectClass()}>
            <option value="bank_qr">Bank QR / GPay</option>
            <option value="bank">NEFT / bank transfer</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="proof_amount_btn">Amount (Nu)</Label>
          <Input
            id="proof_amount_btn"
            name="amount_btn"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={suggestedAmount > 0 ? suggestedAmount : undefined}
          />
        </div>
      </div>
      <CloudinaryDocField
        name="proof_url"
        value={proofUrl}
        onPick={(pickIntent) => {
          setIntent(pickIntent);
          setPickerOpen(true);
        }}
        onClear={() => setProofUrl("")}
      />
      <CloudinaryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Payment screenshot"
        uploadFolder="pelbu/payments"
        initialTab="upload"
        uploadIntent={intent}
        acceptVideo={false}
        onSelect={(publicId) => {
          setProofUrl(cloudinaryOriginalUrl(publicId) ?? publicId);
          setPickerOpen(false);
        }}
      />
      <div className="space-y-1.5">
        <Label htmlFor="proof_reference">Bank reference</Label>
        <Input id="proof_reference" name="reference" placeholder="Optional txn ID" />
      </div>
      <Button type="submit" disabled={pending || !proofUrl} variant="outline" className="h-10 w-full">
        {pending ? "Submitting…" : "Submit proof → pending bank"}
      </Button>
      <PeriodOverrideFields idPrefix={`proof-${folioId.slice(0, 8)}`} />
      <Flash state={state} />
    </form>
  );
}
