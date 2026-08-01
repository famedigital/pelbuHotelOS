"use client";

import {
  attachFolioToMaster,
  createDepositLink,
  issueFolioCreditNote,
  issueFolioInvoice,
  issueFolioReceipt,
  markDepositLinkPaid,
  postCompCredit,
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
import { useActionState, useState } from "react";

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

export function VoidLineButton({ lineId }: { lineId: string }) {
  const [state, action, pending] = useActionState(voidFolioLine, initial);
  useActionToast(state, { successMessage: "Folio line voided" });
  return (
    <form action={action} className="erp mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="line_id" value={lineId} />
      <Input
        name="void_reason"
        required
        placeholder="Void reason"
        className="min-w-[140px] flex-1 text-xs"
      />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        className="text-xs font-medium text-destructive hover:bg-destructive/5 hover:text-destructive"
      >
        {pending ? "Voiding…" : "Void"}
      </Button>
      <PeriodOverrideFields idPrefix={`void-${lineId.slice(0, 8)}`} />
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

export function CompCreditForm({ folioId }: { folioId: string }) {
  const [state, action, pending] = useActionState(postCompCredit, initial);
  useActionToast(state, { successMessage: "Comp credit posted" });
  return (
    <form
      action={action}
      className="erp space-y-3 rounded-lg border bg-card p-4"
    >
      <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Comp / courtesy
      </h3>
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
}: {
  folioId: string;
  bookingId: string | null;
}) {
  const [state, action, pending] = useActionState(createDepositLink, initial);
  useActionToast(state, { successMessage: "Deposit link created" });
  return (
    <form
      action={action}
      className="erp space-y-3 rounded-lg border bg-card p-4"
    >
      <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Deposit / QR link
      </h3>
      <p className="text-xs text-muted-foreground">
        Share the link for bank QR / NEFT. Guest uploads proof → pending bank → confirm in Finance.
      </p>
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
        variant="citrus"
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
}: {
  folioId: string;
  invoiceNo?: string | null;
  invoiceDocId?: string | null;
}) {
  const [state, action, pending] = useActionState(issueFolioInvoice, initial);
  useActionToast(state, { successMessage: "Tax invoice issued" });

  if (invoiceNo) {
    return (
      <div className="erp rounded-lg border bg-card p-4 text-sm">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Tax invoice
        </p>
        <p className="mt-2 font-mono font-medium text-foreground">{invoiceNo}</p>
        {invoiceDocId ? (
          <a
            href={`/erp/invoices/${invoiceDocId}/print`}
            className="mt-2 inline-block text-xs text-accent underline-offset-4 hover:underline"
          >
            Print / PDF
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="erp space-y-3 rounded-lg border bg-card p-4">
      <input type="hidden" name="folio_id" value={folioId} />
      <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Tax invoice
      </p>
      <p className="text-xs text-muted-foreground">
        Allocate a gapless fiscal invoice number for GST reporting.
      </p>
      <PeriodOverrideFields idPrefix={`inv-${folioId.slice(0, 8)}`} />
      <Button type="submit" variant="outline" disabled={pending} className="h-10 w-full">
        {pending ? "Issuing…" : "Issue tax invoice"}
      </Button>
      <Flash state={state} />
    </form>
  );
}

export function IssueCreditNoteButton({ folioId }: { folioId: string }) {
  const [state, action, pending] = useActionState(issueFolioCreditNote, initial);
  useActionToast(state, { successMessage: "Credit note issued" });
  return (
    <form action={action} className="erp space-y-3 rounded-lg border bg-card p-4">
      <input type="hidden" name="folio_id" value={folioId} />
      <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Credit note
      </p>
      <p className="text-xs text-muted-foreground">
        Issue CN-YYYY-#### against this folio (voids / adjustments already on lines).
      </p>
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

export function PromoteToMasterForm({ folioId }: { folioId: string }) {
  const [state, action, pending] = useActionState(promoteFolioToMaster, initial);
  useActionToast(state, { successMessage: "Promoted to master folio" });
  return (
    <form action={action} className="erp space-y-3 rounded-lg border bg-card p-4">
      <input type="hidden" name="folio_id" value={folioId} />
      <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        City ledger / master
      </p>
      <p className="text-xs text-muted-foreground">
        Promote this folio so guest folios can attach under it (group / agent city ledger).
      </p>
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
}: {
  folioId: string;
  masterCandidates: Array<{ id: string; label: string }>;
}) {
  const [state, action, pending] = useActionState(attachFolioToMaster, initial);
  useActionToast(state, { successMessage: "Attached to master" });
  if (masterCandidates.length === 0) return null;
  return (
    <form action={action} className="erp space-y-3 rounded-lg border bg-card p-4">
      <input type="hidden" name="folio_id" value={folioId} />
      <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Attach to master
      </p>
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
}: {
  folioId: string;
  suggestedAmount: number;
}) {
  const [state, action, pending] = useActionState(submitBankPaymentProof, initial);
  useActionToast(state, { successMessage: "Proof submitted — pending bank" });
  const [proofUrl, setProofUrl] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [intent, setIntent] = useState<"camera" | "file">("camera");

  return (
    <form action={action} className="erp space-y-3 rounded-lg border bg-card p-4">
      <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Bank QR / NEFT proof
      </h3>
      <p className="text-xs text-muted-foreground">
        Upload guest screenshot → pending bank (2–3 days) → confirm in Finance → Bank proofs →
        issue receipt.
      </p>
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
