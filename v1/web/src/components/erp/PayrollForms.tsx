"use client";

import {
  approvePayrollRun,
  calculatePayrollRun,
  cancelPayrollRun,
  createPayrollPeriod,
  createPayrollRun,
  deletePayrollAdjustment,
  finalizePayrollRun,
  markPayrollItemPaid,
  savePayrollAdjustment,
  type PayrollActionState,
} from "@/app/actions/erp-payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";

const initialState: PayrollActionState = { ok: false };
const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function Feedback({ state }: { state: PayrollActionState }) {
  if (state.error)
    return <p className="text-sm text-destructive">{state.error}</p>;
  if (state.message)
    return <p className="text-sm text-emerald-700">{state.message}</p>;
  return null;
}

export function PayrollPeriodForm() {
  const [state, action, pending] = useActionState(
    createPayrollPeriod,
    initialState,
  );
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="period-label">Period label</Label>
        <Input
          id="period-label"
          name="label"
          placeholder="July 2026"
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="period-start">Start</Label>
          <Input id="period-start" name="period_start" type="date" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="period-end">End</Label>
          <Input id="period-end" name="period_end" type="date" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="period-pay">Pay date</Label>
          <Input id="period-pay" name="pay_date" type="date" />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create period"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function PayrollRunCreateForm({
  periods,
}: {
  periods: Array<{ id: string; label: string; status: string }>;
}) {
  const [state, action, pending] = useActionState(
    createPayrollRun,
    initialState,
  );
  const openPeriods = periods.filter((p) => p.status !== "closed");
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1 space-y-1">
        <Label htmlFor="run-period">Period</Label>
        <select id="run-period" name="period_id" className={selectClass} required>
          <option value="">Select a period…</option>
          {openPeriods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending || openPeriods.length === 0}>
        {pending ? "Creating…" : "New run"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

function RunActionButton({
  runId,
  action,
  label,
  variant = "default",
  confirm,
}: {
  runId: string;
  action: (
    prev: PayrollActionState,
    formData: FormData,
  ) => Promise<PayrollActionState>;
  label: string;
  variant?: "default" | "outline" | "destructive";
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="inline"
    >
      <input type="hidden" name="run_id" value={runId} />
      <Button type="submit" variant={variant} size="sm" disabled={pending}>
        {pending ? "Working…" : label}
      </Button>
      {state.error ? (
        <span className="ml-2 text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}

export function PayrollRunActions({
  runId,
  status,
}: {
  runId: string;
  status: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(status === "draft" || status === "calculated") && (
        <RunActionButton
          runId={runId}
          action={calculatePayrollRun}
          label={status === "draft" ? "Calculate" : "Recalculate"}
          variant="outline"
        />
      )}
      {status === "calculated" && (
        <RunActionButton
          runId={runId}
          action={approvePayrollRun}
          label="Approve"
        />
      )}
      {status === "approved" && (
        <RunActionButton
          runId={runId}
          action={finalizePayrollRun}
          label="Finalize & post"
          confirm="Finalize this run? Payslips become immutable and the employer cost is posted to finance."
        />
      )}
      {status !== "finalized" && status !== "cancelled" && (
        <RunActionButton
          runId={runId}
          action={cancelPayrollRun}
          label="Cancel"
          variant="destructive"
          confirm="Cancel this payroll run?"
        />
      )}
    </div>
  );
}

export function PayrollAdjustmentForm({
  periodId,
  staff,
}: {
  periodId: string;
  staff: Array<{ id: string; label: string }>;
}) {
  const [state, action, pending] = useActionState(
    savePayrollAdjustment,
    initialState,
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="period_id" value={periodId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="adj-staff">Staff</Label>
          <select id="adj-staff" name="staff_id" className={selectClass} required>
            <option value="">Select staff…</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="adj-kind">Type</Label>
          <select id="adj-kind" name="kind" className={selectClass} required>
            <option value="earning">Earning (bonus / allowance)</option>
            <option value="deduction">Deduction</option>
            <option value="advance_repayment">Advance repayment</option>
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="adj-label">Label</Label>
          <Input
            id="adj-label"
            name="label"
            placeholder="Diwali bonus"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="adj-amount">Amount (Nu)</Label>
          <Input
            id="adj-amount"
            name="amount_btn"
            type="number"
            step="0.01"
            min="0"
            required
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="taxable" defaultChecked />
        Taxable earning (uncheck for tax-free allowances)
      </label>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Add adjustment"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function DeleteAdjustmentButton({ id }: { id: string }) {
  const [, action, pending] = useActionState(
    deletePayrollAdjustment,
    initialState,
  );
  return (
    <form action={action} className="inline">
      <input type="hidden" name="adjustment_id" value={id} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "…" : "Remove"}
      </Button>
    </form>
  );
}

export function MarkPaidForm({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState(
    markPayrollItemPaid,
    initialState,
  );
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="item_id" value={itemId} />
      <Input
        name="payment_reference"
        placeholder="Bank ref"
        className="h-8 w-28"
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "…" : "Mark paid"}
      </Button>
      {state.error ? (
        <span className="text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
