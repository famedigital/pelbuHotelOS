"use client";

import {
  autoMatchBankTxns,
  createExpense,
  ignoreBankTxn,
  importBankStatementJson,
  matchBankTxn,
  type ErpFinanceState,
} from "@/app/actions/erp-finance";
import { formatBtn } from "@/lib/pricing";
import { useActionState } from "react";

const initial: ErpFinanceState = { ok: false };

function fieldClass() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
}

function ActionFlash({ state }: { state: ErpFinanceState }) {
  if (!state.ok && !state.error) return null;
  return (
    <p
      className={`mt-2 text-sm ${state.ok ? "text-espresso" : "text-maroon"}`}
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
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white p-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        Record expense
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-espresso/70">
          Date
          <input
            type="date"
            name="expense_date"
            defaultValue={today}
            required
            className={fieldClass()}
          />
        </label>
        <label className="block text-xs text-espresso/70">
          Category
          <select name="category" defaultValue="supplies" required className={fieldClass()}>
            <option value="supplies">Supplies</option>
            <option value="utilities">Utilities</option>
            <option value="payroll">Payroll</option>
            <option value="maintenance">Maintenance</option>
            <option value="marketing">Marketing</option>
            <option value="tax">Tax</option>
            <option value="bank_fee">Bank fee</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>
      <label className="block text-xs text-espresso/70">
        Description
        <input name="description" required className={fieldClass()} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs text-espresso/70">
          Amount (Nu)
          <input
            name="amount_btn"
            type="number"
            min="0.01"
            step="0.01"
            required
            className={fieldClass()}
          />
        </label>
        <label className="block text-xs text-espresso/70">
          GST (Nu)
          <input name="gst_btn" type="number" min="0" step="0.01" defaultValue="0" className={fieldClass()} />
        </label>
        <label className="block text-xs text-espresso/70">
          Paid via
          <select name="payment_method" defaultValue="bank" className={fieldClass()}>
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-espresso/70">
          Vendor
          <input name="vendor" className={fieldClass()} />
        </label>
        <label className="block text-xs text-espresso/70">
          Bank / cheque ref
          <input name="reference" className={fieldClass()} />
        </label>
      </div>
      <label className="block text-xs text-espresso/70">
        Notes
        <input name="notes" className={fieldClass()} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center rounded-sm bg-gold px-4 text-sm font-medium text-espresso disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save expense"}
      </button>
      <ActionFlash state={state} />
    </form>
  );
}

export function ImportStatementForm() {
  const [state, action, pending] = useActionState(importBankStatementJson, initial);

  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white p-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        Import bank JSON
      </h3>
      <p className="text-xs text-muted">
        Run{" "}
        <code className="font-mono text-[11px]">
          python -m pelbu_bank_recon.cli parse statement.pdf --bank bob -o out.json
        </code>{" "}
        then paste the JSON here.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs text-espresso/70">
          Bank
          <select name="bank_code" defaultValue="bob" required className={fieldClass()}>
            <option value="bob">BoB</option>
            <option value="bnb">BNB</option>
            <option value="tbank">TBank</option>
            <option value="drukpnb">DrukPNB</option>
          </select>
        </label>
        <label className="block text-xs text-espresso/70 sm:col-span-2">
          Account label
          <input name="account_label" placeholder="BoB current ****4521" className={fieldClass()} />
        </label>
      </div>
      <label className="block text-xs text-espresso/70">
        Source filename
        <input name="source_filename" placeholder="bob-july-2026.pdf" className={fieldClass()} />
      </label>
      <label className="block text-xs text-espresso/70">
        Statement JSON
        <textarea
          name="statement_json"
          required
          rows={8}
          className={`${fieldClass()} font-mono text-xs`}
          placeholder='{"bank_code":"bob","transactions":[...]}'
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center rounded-sm bg-espresso px-4 text-sm font-medium text-ivory disabled:opacity-60"
      >
        {pending ? "Importing…" : "Import transactions"}
      </button>
      <ActionFlash state={state} />
    </form>
  );
}

export function AutoMatchButton() {
  const [state, action, pending] = useActionState(autoMatchBankTxns, initial);

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center rounded-sm border border-espresso/20 bg-white px-3 text-xs font-medium text-espresso disabled:opacity-60"
      >
        {pending ? "Matching…" : "Auto-match queue"}
      </button>
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
  const [matchState, matchAction, matchPending] = useActionState(matchBankTxn, initial);
  const [ignoreState, ignoreAction, ignorePending] = useActionState(ignoreBankTxn, initial);
  const isCredit = Number(txn.credit_btn) > 0;
  const amount = isCredit ? Number(txn.credit_btn) : Number(txn.debit_btn);

  return (
    <li className="border-b border-espresso/10 py-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium text-espresso">
          {txn.bank_code.toUpperCase()} · {txn.txn_date}
        </p>
        <p className="tabular-nums text-espresso">
          {isCredit ? "+" : "−"}
          {formatBtn(amount)}
        </p>
      </div>
      <p className="mt-1 text-muted">{txn.description}</p>
      {txn.reference ? (
        <p className="mt-1 font-mono text-[11px] text-espresso/50">ref {txn.reference}</p>
      ) : null}

      <form action={matchAction} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="bank_txn_id" value={txn.id} />
        {isCredit ? (
          <label className="block min-w-[220px] flex-1 text-xs text-espresso/70">
            Match payment
            <select name="payment_id" defaultValue="" required className={fieldClass()}>
              <option value="" disabled>
                Select payment…
              </option>
              {payments.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block min-w-[220px] flex-1 text-xs text-espresso/70">
            Match expense
            <select name="expense_id" defaultValue="" required className={fieldClass()}>
              <option value="" disabled>
                Select expense…
              </option>
              {expenses.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.expense_date} · {formatBtn(e.amount_btn)} · {e.description}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="submit"
          disabled={matchPending}
          className="inline-flex min-h-10 items-center rounded-sm bg-gold px-3 text-xs font-medium text-espresso disabled:opacity-60"
        >
          {matchPending ? "…" : "Match"}
        </button>
      </form>
      <ActionFlash state={matchState} />

      <form action={ignoreAction} className="mt-2">
        <input type="hidden" name="bank_txn_id" value={txn.id} />
        <button
          type="submit"
          disabled={ignorePending}
          className="inline-flex min-h-9 items-center text-xs text-muted underline-offset-4 hover:underline disabled:opacity-60"
        >
          Ignore
        </button>
      </form>
      <ActionFlash state={ignoreState} />
    </li>
  );
}
