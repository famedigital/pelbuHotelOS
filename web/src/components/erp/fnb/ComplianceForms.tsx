"use client";

import type { FnbLogState } from "@/app/actions/erp-fnb-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

type Action = (
  prev: FnbLogState,
  formData: FormData,
) => Promise<FnbLogState>;

const initial: FnbLogState = { ok: false };

export function ComplianceForms({
  wasteAction,
  tempAction,
  cleanAction,
  gasAction,
}: {
  wasteAction: Action;
  tempAction: Action;
  cleanAction: Action;
  gasAction: Action;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormCard title="Log waste" action={wasteAction}>
        <Field name="item_name" label="Item" required />
        <Field name="qty" label="Qty" type="number" required />
        <Field name="unit" label="Unit" defaultValue="kg" />
        <div className="space-y-1">
          <Label htmlFor="reason_code">Reason</Label>
          <select
            id="reason_code"
            name="reason_code"
            className="h-9 w-full rounded-md border px-2 text-sm"
            defaultValue="spoilage"
          >
            <option value="spoilage">Spoilage</option>
            <option value="prep_error">Prep error</option>
            <option value="overproduction">Overproduction</option>
            <option value="drop">Drop</option>
            <option value="expiry">Expiry</option>
            <option value="other">Other</option>
          </select>
        </div>
      </FormCard>
      <FormCard title="Log temperature" action={tempAction}>
        <Field name="location_label" label="Location" defaultValue="Walk-in" required />
        <Field name="temp_c" label="°C" type="number" step="0.1" required />
        <Field name="min_c" label="Min OK" type="number" defaultValue="-40" />
        <Field name="max_c" label="Max OK" type="number" defaultValue="8" />
      </FormCard>
      <FormCard title="Cleaning sign-off" action={cleanAction}>
        <Field name="area" label="Area" defaultValue="Kitchen" required />
        <Field name="task" label="Task" defaultValue="Floors & surfaces" required />
      </FormCard>
      <FormCard title="LPG / gas use" action={gasAction}>
        <Field name="cylinders" label="Cylinders" type="number" step="0.5" required />
        <Field name="cost_btn" label="Cost Nu (optional)" type="number" />
      </FormCard>
    </div>
  );
}

function FormCard({
  title,
  action,
  children,
}: {
  title: string;
  action: Action;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  useActionToast(state, { successMessage: state.message ?? "Saved" });
  return (
    <form action={formAction} className="space-y-3 rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  defaultValue,
  step,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  step?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        step={step}
        className="h-9"
      />
    </div>
  );
}
