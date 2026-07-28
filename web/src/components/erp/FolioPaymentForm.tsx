"use client";

import { postFolioPayment, type PaymentState } from "@/app/actions/erp-pos";
import { useActionState } from "react";

const initial: PaymentState = { ok: false };

function fieldClassName() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-gold";
}

export function FolioPaymentForm({
  folioId,
  suggestedAmount,
}: {
  folioId: string;
  suggestedAmount: number;
}) {
  const [state, action, pending] = useActionState(postFolioPayment, initial);

  if (state.ok) {
    return (
      <p className="border border-espresso/10 bg-white px-4 py-3 text-sm text-espresso" role="status">
        Payment recorded.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4 border border-espresso/10 bg-white px-6 py-6">
      {state.error ? (
        <p className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon" role="alert">
          {state.error}
        </p>
      ) : null}
      <input type="hidden" name="folio_id" value={folioId} />
      <p className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
        Record payment
      </p>
      <label className="block text-sm text-espresso">
        Method
        <select name="method" defaultValue="cash" className={fieldClassName()}>
          <option value="cash">Cash</option>
          <option value="bank">Bank</option>
          <option value="card">Card</option>
          <option value="agent_credit">Agent credit</option>
        </select>
      </label>
      <label className="block text-sm text-espresso">
        Amount (Nu)
        <input
          type="number"
          name="amount_btn"
          required
          min={0.01}
          step="0.01"
          defaultValue={suggestedAmount > 0 ? suggestedAmount : undefined}
          className={fieldClassName()}
        />
      </label>
      <label className="block text-sm text-espresso">
        Reference
        <input type="text" name="reference" placeholder="Txn / slip no" className={fieldClassName()} />
      </label>
      <label className="block text-sm text-espresso">
        Notes
        <input type="text" name="notes" className={fieldClassName()} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-sm bg-gold px-5 text-sm font-medium text-espresso disabled:opacity-60"
      >
        {pending ? "Saving…" : "Post payment"}
      </button>
    </form>
  );
}
