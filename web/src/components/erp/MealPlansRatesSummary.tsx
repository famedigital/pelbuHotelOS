"use client";

import { childRateFromAdult } from "@/lib/child-packages";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";

/** Local shape so this client summary does not import server-only meal-plans. */
export type MealPlanSummaryRow = {
  code: string;
  name: string;
  blurb: string | null;
  amount_btn_per_adult_night: number | null;
  amount_btn_per_child_night: number | null;
  is_active: boolean;
};

export function MealPlansRatesSummary({
  mealPlans,
  defaultMealPlanCode,
  compact = false,
}: {
  mealPlans: MealPlanSummaryRow[];
  defaultMealPlanCode: string;
  /** Slim list under package card — skips large section chrome. */
  compact?: boolean;
}) {
  const active = mealPlans.filter((p) => p.is_active);

  const table = (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-2.5 font-medium">Code</th>
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium">Nu / adult / night</th>
            <th className="px-4 py-2.5 font-medium">Child 6–12 / night</th>
            <th className="px-4 py-2.5 font-medium">0–6</th>
            <th className="px-4 py-2.5 font-medium">Desk default</th>
          </tr>
        </thead>
        <tbody>
          {active.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-5 text-muted-foreground">
                No active meal plans. Enable EP, BB, or MAP in Settings.
              </td>
            </tr>
          ) : (
            active.map((plan) => {
              const adult = plan.amount_btn_per_adult_night;
              const child =
                plan.amount_btn_per_child_night != null
                  ? plan.amount_btn_per_child_night
                  : adult != null && adult > 0
                    ? childRateFromAdult(adult)
                    : null;
              const autoChild = plan.amount_btn_per_child_night == null;
              return (
                <tr key={plan.code} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs">{plan.code}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{plan.name}</span>
                    {plan.blurb ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {plan.blurb}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-foreground">
                    {adult == null
                      ? "Label only"
                      : adult === 0
                        ? "Nu 0"
                        : formatBtn(adult)}
                  </td>
                  <td className="px-4 py-2.5 text-foreground">
                    {child == null ? (
                      "—"
                    ) : child === 0 ? (
                      "Nu 0"
                    ) : (
                      <>
                        {formatBtn(child)}
                        {autoChild && adult != null && adult > 0 ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (auto 50%)
                          </span>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">Free</td>
                  <td className="px-4 py-2.5">
                    {plan.code === defaultMealPlanCode ? (
                      <span className="text-xs font-medium text-accent">
                        Default
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  if (compact) {
    return table;
  }

  return (
    <section className="rounded-xl border bg-card p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Meal packages
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            EP / BB / MAP add-ons
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Per-adult Nu / night. Child package 6–12 is 50% of that adult amount
            when the child field is blank in Settings; 0–6 free. Public book, fast
            book, calendar, and agent book use{" "}
            <code className="font-mono text-xs">meal_plans</code>.
          </p>
        </div>
        <Link
          href="/erp/settings?tab=commercial"
          className="inline-flex h-10 items-center rounded-md border px-4 text-sm text-foreground hover:bg-muted"
        >
          Edit in Settings →
        </Link>
      </div>

      {table}
    </section>
  );
}
