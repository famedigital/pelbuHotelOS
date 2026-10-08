"use client";

import {
  assignStatementAccount,
  classifyBankLine,
  saveFinanceAccount,
  type StatementState,
} from "@/app/actions/erp-statement";
import {
  addAssessmentFile,
  buildRrcoCanonical,
  pullRrcoBooks,
  saveRrcoHeader,
  updateRrcoLine,
  type RrcoState,
} from "@/app/actions/erp-rrco";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BANK_TREATMENTS,
  EXPENSE_HEADS,
  RRCO_TREATMENTS,
} from "@/lib/finance/statement-model";
import { useActionState } from "react";

const initial: StatementState = { ok: false };
const rrcoInitial: RrcoState = { ok: false };

function flash(state: { ok: boolean; error?: string; message?: string }) {
  if (!state.ok && !state.error) return null;
  return (
    <p className={`text-sm ${state.ok ? "text-foreground" : "text-destructive"}`} role="status">
      {state.ok ? state.message : state.error}
    </p>
  );
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm";

export function AccountForm() {
  const [state, action, pending] = useActionState(saveFinanceAccount, initial);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <Label htmlFor="acct-label">Account name</Label>
        <Input id="acct-label" name="label" required placeholder="Operating BNB" />
      </div>
      <div>
        <Label htmlFor="acct-no">Account number</Label>
        <Input id="acct-no" name="account_no" />
      </div>
      <div>
        <Label htmlFor="acct-bank">Bank</Label>
        <select id="acct-bank" name="bank_code" className={selectClass} defaultValue="bnb">
          <option value="bnb">BNB</option>
          <option value="bob">BoB</option>
          <option value="tbank">TBank</option>
          <option value="drukpnb">Druk PNB</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <Label htmlFor="acct-role">Role</Label>
        <select id="acct-role" name="account_role" className={selectClass} defaultValue="operating">
          <option value="operating">Operating</option>
          <option value="owner">Owner pays hotel bills</option>
          <option value="related">Related company pays hotel bills</option>
        </select>
      </div>
      <div>
        <Label htmlFor="acct-open">Opening balance (Nu.)</Label>
        <Input id="acct-open" name="opening_balance_btn" type="number" step="0.01" defaultValue="0" />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add account"}
        </Button>
      </div>
      {flash(state)}
    </form>
  );
}

export function AssignStatementForm({
  statements,
  accounts,
}: {
  statements: { id: string; label: string }[];
  accounts: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(assignStatementAccount, initial);
  if (!statements.length || !accounts.length) return null;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div>
        <Label htmlFor="st-id">Imported statement</Label>
        <select id="st-id" name="statement_id" className={selectClass}>
          {statements.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="st-acct">Belongs to</Label>
        <select id="st-acct" name="finance_account_id" className={selectClass}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        Attach
      </Button>
      {flash(state)}
    </form>
  );
}

export function ClassifyLineForm({
  id,
  category,
  treatment,
  party,
}: {
  id: string;
  category: string;
  treatment: string;
  party: string;
}) {
  const [state, action, pending] = useActionState(classifyBankLine, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="bank_txn_id" value={id} />
      <input
        name="party"
        defaultValue={party}
        placeholder="Party"
        className="h-8 w-28 rounded-md border px-2 text-xs"
      />
      <input
        name="category"
        defaultValue={category}
        list="statement-categories"
        className="h-8 w-36 rounded-md border px-2 text-xs"
      />
      <select name="treatment" defaultValue={treatment} className="h-8 rounded-md border px-1 text-xs">
        {BANK_TREATMENTS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input name="reason" placeholder="Reason" className="h-8 w-28 rounded-md border px-2 text-xs" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Save
      </Button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}

export function CategoryList() {
  return (
    <datalist id="statement-categories">
      {EXPENSE_HEADS.map((c) => (
        <option key={c} value={c} />
      ))}
      <option value="Salary" />
      <option value="Room and guest receipts" />
      <option value="Transfers and receipts in" />
      <option value="Loans received" />
      <option value="Loans given" />
      <option value="Cash deposits" />
      <option value="From owner — not income" />
    </datalist>
  );
}

export function RrcoHeaderForm({
  year,
  cash,
  tds,
  capital,
  preparedBy,
}: {
  year: number;
  cash: number;
  tds: number;
  capital: number;
  preparedBy: string;
}) {
  const [state, action, pending] = useActionState(saveRrcoHeader, rrcoInitial);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <input type="hidden" name="tax_year" value={year} />
      <div>
        <Label htmlFor="rrco-cash">Cash in hand</Label>
        <Input id="rrco-cash" name="cash_in_hand_btn" type="number" step="0.01" defaultValue={cash} />
      </div>
      <div>
        <Label htmlFor="rrco-tds">TDS deducted</Label>
        <Input id="rrco-tds" name="tds_btn" type="number" step="0.01" defaultValue={tds} />
      </div>
      <div>
        <Label htmlFor="rrco-cap">Capital</Label>
        <Input id="rrco-cap" name="capital_btn" type="number" step="0.01" defaultValue={capital} />
      </div>
      <div>
        <Label htmlFor="rrco-by">Prepared by</Label>
        <Input id="rrco-by" name="prepared_by" defaultValue={preparedBy} />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          Save header
        </Button>
      </div>
      {flash(state)}
    </form>
  );
}

export function RrcoPullForm({ year }: { year: number }) {
  const [state, action, pending] = useActionState(pullRrcoBooks, rrcoInitial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="tax_year" value={year} />
      <Button type="submit" disabled={pending}>
        {pending ? "Pulling…" : "Pull books into this year"}
      </Button>
      {flash(state)}
    </form>
  );
}

export function RrcoCanonicalForm({ year }: { year: number }) {
  const [state, action, pending] = useActionState(buildRrcoCanonical, rrcoInitial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="tax_year" value={year} />
      <Button type="submit" disabled={pending}>
        {pending ? "Numbering…" : "Build canonical numbers"}
      </Button>
      {flash(state)}
    </form>
  );
}

export function RrcoLineForm({
  id,
  category,
  treatment,
  reason,
}: {
  id: string;
  category: string;
  treatment: string;
  reason: string;
}) {
  const [state, action, pending] = useActionState(updateRrcoLine, rrcoInitial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="line_id" value={id} />
      <input name="category" defaultValue={category} className="h-8 w-36 rounded-md border px-2 text-xs" />
      <select name="treatment" defaultValue={treatment} className="h-8 rounded-md border px-1 text-xs">
        {RRCO_TREATMENTS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input
        name="reason"
        defaultValue={reason}
        placeholder="Reason if not in the return"
        className="h-8 w-48 rounded-md border px-2 text-xs"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Save
      </Button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}

export function AssessmentUploadForm({ year }: { year: number }) {
  const [state, action, pending] = useActionState(addAssessmentFile, rrcoInitial);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="tax_year" value={year} />
      <div>
        <Label htmlFor="as-label">Label</Label>
        <Input id="as-label" name="label" required placeholder="September bank statement" />
      </div>
      <div>
        <Label htmlFor="as-kind">Kind</Label>
        <select id="as-kind" name="kind" className={selectClass} defaultValue="statement">
          <option value="statement">Statement</option>
          <option value="invoice">Invoice</option>
          <option value="bill">Bill</option>
          <option value="comp_schedule">Comp schedule</option>
          <option value="reason">Reason schedule</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <Label htmlFor="as-notes">Notes</Label>
        <Input id="as-notes" name="notes" />
      </div>
      <div>
        <Label htmlFor="as-file">File</Label>
        <Input id="as-file" name="file" type="file" />
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add backup"}
        </Button>
      </div>
      {flash(state)}
    </form>
  );
}
