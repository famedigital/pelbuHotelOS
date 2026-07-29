"use client";

import {
  createDepositLink,
  markDepositLinkPaid,
  postCompCredit,
  voidFolioLine,
  type ErpFolioOpsState,
} from "@/app/actions/erp-folio-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

const initial: ErpFolioOpsState = { ok: false };

function selectClass() {
  return "mt-1.5 flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer";
}

function Flash({ state }: { state: ErpFolioOpsState }) {
  if (!state.ok && !state.error) return null;
  return (
    <p
      className={`mt-2 text-sm ${state.ok ? "text-espresso" : "text-maroon"}`}
      role="status"
    >
      {state.ok ? state.message : state.error}
      {state.token ? (
        <>
          {" "}
          <a
            href={`/pay/${state.token}`}
            className="font-mono text-xs underline-offset-4 hover:underline"
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
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
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
        className="text-xs font-medium text-maroon hover:bg-maroon/5 hover:text-maroon"
      >
        {pending ? "Voiding…" : "Void"}
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
      className="space-y-3 border border-espresso/10 bg-white px-4 py-4"
    >
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
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
        className="min-h-10 w-full"
      >
        {pending ? "Posting…" : "Post comp credit"}
      </Button>
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
      className="space-y-3 border border-espresso/10 bg-white px-4 py-4"
    >
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        Deposit / QR link
      </h3>
      <p className="text-xs text-muted-foreground">
        Share the link for bank QR / Pay.bt. Desk marks paid when funds clear.
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
        className="min-h-10 w-full bg-espresso text-ivory hover:bg-espresso/90"
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
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
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
        variant="gold"
        size="sm"
        disabled={pending}
        className="min-h-10 text-xs"
      >
        {pending ? "Marking…" : "Mark paid"}
      </Button>
      <Flash state={state} />
    </form>
  );
}
