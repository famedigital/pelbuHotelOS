"use client";

import {
  closeAccountingPeriod,
  postOpeningBalances,
  saveOpeningBalanceDraft,
  toggleCloseChecklistItem,
  type AccountingActionState,
} from "@/app/actions/erp-accounting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

const initial: AccountingActionState = { ok: false };

export function OpeningBalanceForm({
  accounts,
  effectiveDate,
  lines,
  status,
}: {
  accounts: { id: string; code: string; name: string }[];
  effectiveDate: string;
  lines: Record<string, { debit: string; credit: string }>;
  status: string | null;
}) {
  const [draftState, draftAction, draftPending] = useActionState(
    saveOpeningBalanceDraft,
    initial,
  );
  const [postState, postAction, postPending] = useActionState(
    postOpeningBalances,
    initial,
  );
  useActionToast(draftState, { successMessage: "Draft saved" });
  useActionToast(postState, { successMessage: "Opening balances posted" });

  const locked = status === "posted";

  return (
    <div className="space-y-4">
      <form action={draftAction} className="space-y-4 rounded-xl border bg-card p-5">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Opening balances
          </p>
          <h3 className="text-lg font-semibold">
            {locked ? "Posted opening balances" : "Draft opening balances"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Enter account balances as of the go-live date. Debits must equal
            credits before posting.
          </p>
        </div>
        {draftState.error ? (
          <p className="text-sm text-destructive">{draftState.error}</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="effective_date">Effective date</Label>
            <Input
              id="effective_date"
              name="effective_date"
              type="date"
              required
              defaultValue={effectiveDate}
              disabled={locked}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" disabled={locked} />
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2">Debit</th>
                <th className="px-3 py-2">Credit</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <input type="hidden" name="account_id" value={account.id} />
                    {account.code} · {account.name}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      name="debit_btn"
                      defaultValue={lines[account.id]?.debit ?? ""}
                      disabled={locked}
                      inputMode="decimal"
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      name="credit_btn"
                      defaultValue={lines[account.id]?.credit ?? ""}
                      disabled={locked}
                      inputMode="decimal"
                      className="h-8"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!locked ? (
          <Button type="submit" disabled={draftPending}>
            {draftPending ? "Saving…" : "Save draft"}
          </Button>
        ) : null}
      </form>

      {!locked ? (
        <form action={postAction}>
          {postState.error ? (
            <p className="mb-2 text-sm text-destructive">{postState.error}</p>
          ) : null}
          <Button type="submit" variant="citrus" disabled={postPending}>
            {postPending ? "Posting…" : "Approve & post opening journal"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function CloseChecklistForm({
  periodId,
  items,
  canClose,
}: {
  periodId: string;
  items: { item_key: string; label: string; is_done: boolean }[];
  canClose: boolean;
}) {
  const [toggleState, toggleAction] = useActionState(
    toggleCloseChecklistItem,
    initial,
  );
  const [closeState, closeAction, closePending] = useActionState(
    closeAccountingPeriod,
    initial,
  );
  useActionToast(toggleState);
  useActionToast(closeState, { successMessage: "Period closed" });

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Period close
        </p>
        <h3 className="text-lg font-semibold">Month-end checklist</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.item_key}>
            <form action={toggleAction} className="flex items-center gap-3">
              <input type="hidden" name="period_id" value={periodId} />
              <input type="hidden" name="item_key" value={item.item_key} />
              <input type="hidden" name="label" value={item.label} />
              <input
                type="hidden"
                name="is_done"
                value={item.is_done ? "0" : "1"}
              />
              <Button type="submit" size="sm" variant="outline" className="h-8">
                {item.is_done ? "Undo" : "Done"}
              </Button>
              <span
                className={
                  item.is_done
                    ? "text-sm text-muted-foreground line-through"
                    : "text-sm text-foreground"
                }
              >
                {item.label}
              </span>
            </form>
          </li>
        ))}
      </ul>
      {closeState.error ? (
        <p className="text-sm text-destructive">{closeState.error}</p>
      ) : null}
      <form action={closeAction}>
        <input type="hidden" name="period_id" value={periodId} />
        <Button type="submit" disabled={!canClose || closePending}>
          {closePending ? "Closing…" : "Lock period"}
        </Button>
      </form>
    </div>
  );
}
