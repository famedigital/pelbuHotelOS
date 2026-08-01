"use client";

import {
  updateCommercialSettings,
  type CommercialSettingsState,
} from "@/app/actions/erp-settings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatBtn } from "@/lib/pricing";
import type { MealPlanRecord } from "@/lib/meal-plans";
import Link from "next/link";
import { useActionState } from "react";

const initial: CommercialSettingsState = { ok: false };

export type MealPlanSettingsRow = MealPlanRecord;

export function SettingsCommercialPanel({
  propertyId,
  defaultMealPlanCode,
  mealPlans,
}: {
  propertyId: string;
  defaultMealPlanCode: string;
  mealPlans: MealPlanSettingsRow[];
}) {
  const [state, action, pending] = useActionState(updateCommercialSettings, initial);
  useActionToast(state, { successMessage: "Rates & meals saved" });

  return (
    <section className="rounded-xl border bg-card p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Commercial
          </p>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Rates &amp; meals
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Toggle meal plans, set Nu per adult per night, and pick the desk
            default for fast book. Leave amount blank for label-only; EP is Nu 0.
          </p>
        </div>
        <Link
          href="/erp/rates"
          className="inline-flex h-10 items-center rounded-md border px-4 text-sm text-foreground hover:bg-muted"
        >
          Room rates sheet →
        </Link>
      </div>

      {state.error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <form action={action}>
        <input type="hidden" name="property_id" value={propertyId} />

        <div className="space-y-4">
          {mealPlans.map((plan) => (
            <div
              key={plan.code}
              className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_auto_auto_auto]"
            >
              <input type="hidden" name="meal_code" value={plan.code} />
              <div>
                <p className="font-medium text-foreground">
                  {plan.code} · {plan.name}
                </p>
                {plan.blurb ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{plan.blurb}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`meal_active_${plan.code}`}
                  name={`meal_active_${plan.code}`}
                  value="on"
                  defaultChecked={plan.is_active}
                />
                <Label htmlFor={`meal_active_${plan.code}`} className="text-sm">
                  Active
                </Label>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`meal_amount_${plan.code}`} className="text-xs">
                  Nu / adult / night
                </Label>
                <Input
                  id={`meal_amount_${plan.code}`}
                  name={`meal_amount_${plan.code}`}
                  type="text"
                  inputMode="decimal"
                  placeholder={plan.code === "EP" ? "0" : "label-only"}
                  defaultValue={
                    plan.amount_btn_per_adult_night == null
                      ? ""
                      : String(plan.amount_btn_per_adult_night)
                  }
                  className="h-9 w-28"
                />
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                {plan.amount_btn_per_adult_night == null
                  ? "Label only"
                  : plan.amount_btn_per_adult_night === 0
                    ? "Nu 0"
                    : `${formatBtn(plan.amount_btn_per_adult_night)}/night`}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 max-w-xs space-y-1.5">
          <Label htmlFor="default_meal_plan_code">Default meal plan (desk)</Label>
          <select
            id="default_meal_plan_code"
            name="default_meal_plan_code"
            defaultValue={defaultMealPlanCode}
            className="mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2.5 text-sm"
          >
            {mealPlans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" className="mt-6 h-11" disabled={pending}>
          {pending ? "Saving…" : "Save rates & meals"}
        </Button>
      </form>
    </section>
  );
}
