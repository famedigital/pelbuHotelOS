"use client";

import { runNightAudit, type ErpFolioOpsState } from "@/app/actions/erp-folio-ops";
import { useActionState } from "react";

const initial: ErpFolioOpsState = { ok: false };

export function NightAuditForm({ defaultDate }: { defaultDate: string }) {
  const [state, action, pending] = useActionState(runNightAudit, initial);
  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white p-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        Run night audit
      </h3>
      <p className="text-xs text-muted">
        Snapshots occupancy (sellable vs comp), folio charges/payments for the business
        date. One run per date.
      </p>
      <label className="block text-xs text-espresso/70">
        Business date
        <input
          type="date"
          name="business_date"
          defaultValue={defaultDate}
          required
          className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
        />
      </label>
      <label className="block text-xs text-espresso/70">
        Notes
        <input
          name="notes"
          className="mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center rounded-sm bg-gold px-4 text-sm font-medium text-espresso disabled:opacity-60"
      >
        {pending ? "Running…" : "Complete night audit"}
      </button>
      {state.ok || state.error ? (
        <p className={`text-sm ${state.ok ? "text-espresso" : "text-maroon"}`} role="status">
          {state.ok ? state.message : state.error}
        </p>
      ) : null}
    </form>
  );
}
