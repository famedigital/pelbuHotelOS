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
  extraBedRateBtn,
  extraBedActive,
  staffSalesCommissionPct,
}: {
  propertyId: string;
  defaultMealPlanCode: string;
  mealPlans: MealPlanSettingsRow[];
  extraBedRateBtn: number | null;
  extraBedActive: boolean;
  staffSalesCommissionPct: number | null;
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
            Toggle meal plans, set Nu per adult / child per night, extra bed
            rate, and the desk default for fast book. Blank child amount = free
            for children; blank adult amount on paid plans = label only.
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
              className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_auto_auto_auto_auto]"
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
              <div className="space-y-1">
                <Label
                  htmlFor={`meal_child_amount_${plan.code}`}
                  className="text-xs"
                >
                  Nu / child / night
                </Label>
                <Input
                  id={`meal_child_amount_${plan.code}`}
                  name={`meal_child_amount_${plan.code}`}
                  type="text"
                  inputMode="decimal"
                  placeholder="free"
                  defaultValue={
                    plan.amount_btn_per_child_night == null
                      ? ""
                      : String(plan.amount_btn_per_child_night)
                  }
                  className="h-9 w-28"
                  aria-describedby={`meal_child_hint_${plan.code}`}
                />
                <p
                  id={`meal_child_hint_${plan.code}`}
                  className="text-[11px] text-muted-foreground"
                >
                  Blank = free for children
                </p>
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                {plan.amount_btn_per_adult_night == null
                  ? "Label only"
                  : plan.amount_btn_per_adult_night === 0
                    ? "Nu 0"
                    : `${formatBtn(plan.amount_btn_per_adult_night)}/adult`}
                {plan.amount_btn_per_child_night != null
                  ? ` · ${formatBtn(plan.amount_btn_per_child_night)}/child`
                  : plan.amount_btn_per_adult_night != null &&
                      plan.amount_btn_per_adult_night > 0
                    ? " · kids free"
                    : ""}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg border p-4">
          <p className="text-sm font-medium text-foreground">Extra bed</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Property-level sell rate. When inactive, booking forms hide extra
            beds (in-house “extra bed” request remains ops-only).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
            <div className="flex items-center gap-2">
              <Checkbox
                id="extra_bed_active"
                name="extra_bed_active"
                value="on"
                defaultChecked={extraBedActive}
              />
              <Label htmlFor="extra_bed_active" className="text-sm">
                Sell on booking
              </Label>
            </div>
            <div className="max-w-xs space-y-1">
              <Label htmlFor="extra_bed_rate_btn" className="text-xs">
                Nu / bed / night
              </Label>
              <Input
                id="extra_bed_rate_btn"
                name="extra_bed_rate_btn"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 800"
                defaultValue={
                  extraBedRateBtn == null ? "" : String(extraBedRateBtn)
                }
                className="h-9 w-28"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border p-4">
          <p className="text-sm font-medium text-foreground">
            Staff sales commission
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Suggested % of quoted stay total for Owner/GM-approved sales claims
            (reporting and export only — does not post payroll).
          </p>
          <div className="mt-4 max-w-xs space-y-1">
            <Label htmlFor="staff_sales_commission_pct" className="text-xs">
              Commission %
            </Label>
            <Input
              id="staff_sales_commission_pct"
              name="staff_sales_commission_pct"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 2"
              defaultValue={
                staffSalesCommissionPct == null
                  ? ""
                  : String(staffSalesCommissionPct)
              }
              className="h-9 w-28"
            />
            <p className="text-[11px] text-muted-foreground">
              Blank = no suggested commission amount
            </p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Queue:{" "}
            <Link href="/erp/sales-claims" className="text-accent underline">
              Sales claims
            </Link>
          </p>
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
