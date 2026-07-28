"use client";

import {
  createDepositLink,
  markDepositLinkPaid,
  postCompCredit,
  voidFolioLine,
  type ErpFolioOpsState,
} from "@/app/actions/erp-folio-ops";
import { useActionState } from "react";

const initial: ErpFolioOpsState = { ok: false };

function fieldClass() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
}

function Flash({ state }: { state: ErpFolioOpsState }) {
  if (!state.ok && !state.error) return null;
  return (
    <p className={`mt-2 text-sm ${state.ok ? "text-espresso" : "text-maroon"}`} role="status">
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
  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="line_id" value={lineId} />
      <input
        name="void_reason"
        required
        placeholder="Void reason"
        className="min-h-9 min-w-[140px] flex-1 rounded-sm border border-espresso/20 px-2 text-xs outline-none focus:border-gold"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-9 items-center text-xs font-medium text-maroon underline-offset-4 hover:underline disabled:opacity-60"
      >
        {pending ? "…" : "Void"}
      </button>
      <Flash state={state} />
    </form>
  );
}

export function CompCreditForm({ folioId }: { folioId: string }) {
  const [state, action, pending] = useActionState(postCompCredit, initial);
  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white px-4 py-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        Comp / courtesy
      </h3>
      <input type="hidden" name="folio_id" value={folioId} />
      <label className="block text-xs text-espresso/70">
        Amount (Nu)
        <input name="amount_btn" type="number" min="0.01" step="0.01" required className={fieldClass()} />
      </label>
      <label className="block text-xs text-espresso/70">
        Reason (audited)
        <input name="comp_reason" required className={fieldClass()} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 w-full items-center justify-center rounded-sm border border-espresso/20 text-sm text-espresso disabled:opacity-60"
      >
        {pending ? "Posting…" : "Post comp credit"}
      </button>
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
  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white px-4 py-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        Deposit / QR link
      </h3>
      <p className="text-xs text-muted">
        Share the link for bank QR / Pay.bt. Desk marks paid when funds clear.
      </p>
      <input type="hidden" name="folio_id" value={folioId} />
      {bookingId ? <input type="hidden" name="booking_id" value={bookingId} /> : null}
      <label className="block text-xs text-espresso/70">
        Amount (Nu)
        <input name="amount_btn" type="number" min="0.01" step="0.01" required className={fieldClass()} />
      </label>
      <label className="block text-xs text-espresso/70">
        Guest name
        <input name="payee_name" className={fieldClass()} />
      </label>
      <label className="block text-xs text-espresso/70">
        Phone
        <input name="payee_phone" className={fieldClass()} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 w-full items-center justify-center rounded-sm bg-espresso text-sm font-medium text-ivory disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create deposit link"}
      </button>
      <Flash state={state} />
    </form>
  );
}

export function MarkLinkPaidForm({ linkId }: { linkId: string }) {
  const [state, action, pending] = useActionState(markDepositLinkPaid, initial);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="link_id" value={linkId} />
      <label className="block text-[11px] text-espresso/70">
        Method
        <select name="method" defaultValue="bank_qr" className={fieldClass()}>
          <option value="bank_qr">Bank QR</option>
          <option value="pay_bt">Pay.bt</option>
          <option value="bank">Bank transfer</option>
          <option value="cash">Cash</option>
          <option value="deposit">Deposit</option>
        </select>
      </label>
      <label className="block min-w-[120px] flex-1 text-[11px] text-espresso/70">
        Ref
        <input name="reference" className={fieldClass()} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center rounded-sm bg-gold px-3 text-xs font-medium text-espresso disabled:opacity-60"
      >
        {pending ? "…" : "Mark paid"}
      </button>
      <Flash state={state} />
    </form>
  );
}
