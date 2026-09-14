"use client";

import {
  createManualJournal,
  type AccountingActionState,
} from "@/app/actions/erp-accounting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

const initial: AccountingActionState = { ok: false };

export function ManualJournalForm({
  accounts,
}: {
  accounts: { id: string; code: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createManualJournal, initial);
  useActionToast(state, { successMessage: "Journal posted" });

  return (
    <form action={action} className="space-y-3 rounded-xl border bg-card p-5">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Manual journal
        </p>
        <h3 className="text-lg font-semibold">Post a balanced entry</h3>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="journal_date">Date</Label>
          <Input
            id="journal_date"
            name="journal_date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount_btn">Amount (Nu)</Label>
          <Input id="amount_btn" name="amount_btn" required inputMode="decimal" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="debit_account_id">Debit account</Label>
          <select
            id="debit_account_id"
            name="debit_account_id"
            required
            className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">Select…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="credit_account_id">Credit account</Label>
          <select
            id="credit_account_id"
            name="credit_account_id"
            required
            className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">Select…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="memo">Memo</Label>
          <Input id="memo" name="memo" placeholder="Adjustment / accrual" />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Posting…" : "Post journal"}
      </Button>
    </form>
  );
}
