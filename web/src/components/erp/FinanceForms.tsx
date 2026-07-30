"use client";

import {
  autoMatchBankTxns,
  createExpense,
  ignoreBankTxn,
  importBankStatementJson,
  matchBankTxn,
  type ErpFinanceState,
} from "@/app/actions/erp-finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatBtn } from "@/lib/pricing";
import { useActionState } from "react";

const initial: ErpFinanceState = { ok: false };

function selectClass() {
  return "mt-1.5 flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer";
}

function ActionFlash({ state }: { state: ErpFinanceState }) {
  if (!state.ok && !state.error) return null;
  return (
    <p
      className={`erp mt-2 text-sm ${state.ok ? "text-foreground" : "text-destructive"}`}
      role="status"
    >
      {state.ok ? state.message : state.error}
    </p>
  );
}

export type FinancePaymentOption = {
  id: string;
  amount_btn: number;
  method: string;
  reference: string | null;
  created_at: string;
  label: string;
};

export type FinanceExpenseOption = {
  id: string;
  amount_btn: number;
  description: string;
  expense_date: string;
  reference: string | null;
};

export type UnmatchedBankTxn = {
  id: string;
  bank_code: string;
  txn_date: string;
  description: string;
  debit_btn: number;
  credit_btn: number;
  reference: string | null;
};

export function ExpenseForm() {
  const [state, action, pending] = useActionState(createExpense, initial);
  useActionToast(state, { successMessage: "Expense saved" });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="erp space-y-3 rounded-lg border bg-card p-4">
      <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Record expense
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="expense_date" className="text-xs text-muted-foreground">
            Date
          </Label>
          <Input
            id="expense_date"
            type="date"
            name="expense_date"
            defaultValue={today}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expense_category" className="text-xs text-muted-foreground">
            Category
          </Label>
          <select
            id="expense_category"
            name="category"
            defaultValue="supplies"
            required
            className={selectClass()}
          >
            <option value="supplies">Supplies</option>
            <option value="utilities">Utilities</option>
            <option value="payroll">Payroll</option>
            <option value="maintenance">Maintenance</option>
            <option value="marketing">Marketing</option>
            <option value="tax">Tax</option>
            <option value="bank_fee">Bank fee</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="expense_description" className="text-xs text-muted-foreground">
          Description
        </Label>
        <Input id="expense_description" name="description" required />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount_btn" className="text-xs text-muted-foreground">
            Amount (Nu)
          </Label>
          <Input
            id="amount_btn"
            name="amount_btn"
            type="number"
            min="0.01"
            step="0.01"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gst_btn" className="text-xs text-muted-foreground">
            GST (Nu)
          </Label>
          <Input
            id="gst_btn"
            name="gst_btn"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payment_method" className="text-xs text-muted-foreground">
            Paid via
          </Label>
          <select
            id="payment_method"
            name="payment_method"
            defaultValue="bank"
            className={selectClass()}
          >
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vendor" className="text-xs text-muted-foreground">
            Vendor
          </Label>
          <Input id="vendor" name="vendor" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expense_reference" className="text-xs text-muted-foreground">
            Bank / cheque ref
          </Label>
          <Input id="expense_reference" name="reference" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="expense_notes" className="text-xs text-muted-foreground">
          Notes
        </Label>
        <Input id="expense_notes" name="notes" />
      </div>
      <Button type="submit" variant="citrus" disabled={pending} className="h-10 w-full">
        {pending ? "Saving…" : "Save expense"}
      </Button>
      <ActionFlash state={state} />
    </form>
  );
}

export function ImportStatementForm() {
  const [state, action, pending] = useActionState(
    importBankStatementJson,
    initial,
  );
  useActionToast(state, { successMessage: "Statement imported" });

  return (
    <form action={action} className="erp space-y-3 rounded-lg border bg-card p-4">
      <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Import bank JSON
      </h3>
      <p className="text-xs text-muted-foreground">
        Run{" "}
        <code className="font-mono text-[11px]">
          python -m pelbu_bank_recon.cli parse statement.pdf --bank bob -o out.json
        </code>{" "}
        then paste the JSON here.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="bank_code" className="text-xs text-muted-foreground">
            Bank
          </Label>
          <select
            id="bank_code"
            name="bank_code"
            defaultValue="bob"
            required
            className={selectClass()}
          >
            <option value="bob">BoB</option>
            <option value="bnb">BNB</option>
            <option value="tbank">TBank</option>
            <option value="drukpnb">DrukPNB</option>
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="account_label" className="text-xs text-muted-foreground">
            Account label
          </Label>
          <Input
            id="account_label"
            name="account_label"
            placeholder="BoB current ****4521"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="source_filename" className="text-xs text-muted-foreground">
          Source filename
        </Label>
        <Input
          id="source_filename"
          name="source_filename"
          placeholder="bob-july-2026.pdf"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="statement_json" className="text-xs text-muted-foreground">
          Statement JSON
        </Label>
        <Textarea
          id="statement_json"
          name="statement_json"
          required
          rows={8}
          className="font-mono text-xs"
          placeholder='{"bank_code":"bob","transactions":[...]}'
        />
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="h-10 w-full"
      >
        {pending ? "Importing…" : "Import transactions"}
      </Button>
      <ActionFlash state={state} />
    </form>
  );
}

export function AutoMatchButton() {
  const [state, action, pending] = useActionState(autoMatchBankTxns, initial);
  useActionToast(state, { successMessage: "Auto-match run complete" });

  return (
    <form action={action} className="erp flex flex-wrap items-center gap-3">
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="h-10 text-xs"
      >
        {pending ? "Matching…" : "Auto-match queue"}
      </Button>
      <ActionFlash state={state} />
    </form>
  );
}

export function UnmatchedTxnRow({
  txn,
  payments,
  expenses,
}: {
  txn: UnmatchedBankTxn;
  payments: FinancePaymentOption[];
  expenses: FinanceExpenseOption[];
}) {
  const [matchState, matchAction, matchPending] = useActionState(
    matchBankTxn,
    initial,
  );
  const [ignoreState, ignoreAction, ignorePending] = useActionState(
    ignoreBankTxn,
    initial,
  );
  useActionToast(matchState, { successMessage: "Transaction matched" });
  useActionToast(ignoreState, { successMessage: "Transaction ignored" });
  const isCredit = Number(txn.credit_btn) > 0;
  const amount = isCredit ? Number(txn.credit_btn) : Number(txn.debit_btn);

  return (
    <li className="erp py-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium text-foreground">
          {txn.bank_code.toUpperCase()} · {txn.txn_date}
        </p>
        <p className="tabular-nums text-foreground">
          {isCredit ? "+" : "−"}
          {formatBtn(amount)}
        </p>
      </div>
      <p className="mt-1 text-muted-foreground">{txn.description}</p>
      {txn.reference ? (
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          ref {txn.reference}
        </p>
      ) : null}

      <form action={matchAction} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="bank_txn_id" value={txn.id} />
        {isCredit ? (
          <div className="block min-w-[220px] flex-1 space-y-1.5">
            <Label htmlFor={`payment_id_${txn.id}`} className="text-xs text-muted-foreground">
              Match payment
            </Label>
            <select
              id={`payment_id_${txn.id}`}
              name="payment_id"
              defaultValue=""
              required
              className={selectClass()}
            >
              <option value="" disabled>
                Select payment…
              </option>
              {payments.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="block min-w-[220px] flex-1 space-y-1.5">
            <Label htmlFor={`expense_id_${txn.id}`} className="text-xs text-muted-foreground">
              Match expense
            </Label>
            <select
              id={`expense_id_${txn.id}`}
              name="expense_id"
              defaultValue=""
              required
              className={selectClass()}
            >
              <option value="" disabled>
                Select expense…
              </option>
              {expenses.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.expense_date} · {formatBtn(e.amount_btn)} · {e.description}
                </option>
              ))}
            </select>
          </div>
        )}
        <Button
          type="submit"
          variant="citrus"
          size="sm"
          disabled={matchPending}
          className="h-10 text-xs"
        >
          {matchPending ? "Matching…" : "Match"}
        </Button>
      </form>
      <ActionFlash state={matchState} />

      <form action={ignoreAction} className="mt-2">
        <input type="hidden" name="bank_txn_id" value={txn.id} />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={ignorePending}
          className="h-9 text-xs text-muted-foreground"
        >
          Ignore
        </Button>
      </form>
      <ActionFlash state={ignoreState} />
    </li>
  );
}
