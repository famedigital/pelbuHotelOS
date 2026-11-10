"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { recordMarketplaceCommission } from "@/app/actions/platform-admin";

export function RecordCommissionForm() {
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
      action={(fd) => {
        start(async () => {
          const res = await recordMarketplaceCommission(fd);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Commission recorded");
        });
      }}
    >
      <div className="sm:col-span-2 lg:col-span-5">
        <h2 className="text-sm font-medium">Record commission (manual / adjust)</h2>
        <p className="text-xs text-muted-foreground">
          Prefer automatic post on marketplace confirm. Use this for backfill or dispute
          settlement only.
        </p>
      </div>
      <input
        name="property_id"
        required
        placeholder="Property UUID"
        className="rounded-md border px-3 py-2 text-sm"
      />
      <input
        name="booking_id"
        placeholder="Booking UUID (optional)"
        className="rounded-md border px-3 py-2 text-sm"
      />
      <select name="market" className="rounded-md border px-3 py-2 text-sm" defaultValue="local">
        <option value="local">local · 3%</option>
        <option value="international">international · 5%</option>
      </select>
      <input
        name="gross_btn"
        type="number"
        step="0.01"
        min="0.01"
        required
        placeholder="Gross Nu"
        className="rounded-md border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Saving…" : "Post ledger row"}
      </button>
    </form>
  );
}
