import { formatBtn } from "@/lib/pricing";
import type { MealPlanRecord } from "@/lib/meal-plans";
import Link from "next/link";

export function MealPlansRatesSummary({
  mealPlans,
  defaultMealPlanCode,
}: {
  mealPlans: MealPlanRecord[];
  defaultMealPlanCode: string;
}) {
  const active = mealPlans.filter((p) => p.is_active);

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
            Per-adult and per-child Nu / night on top of room rate. Public book,
            fast book, calendar, and agent book use these packages from{" "}
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

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2.5 font-medium">Code</th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Nu / adult / night</th>
              <th className="px-4 py-2.5 font-medium">Nu / child / night</th>
              <th className="px-4 py-2.5 font-medium">Desk default</th>
            </tr>
          </thead>
          <tbody>
            {active.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-5 text-muted-foreground">
                  No active meal plans. Enable EP, BB, or MAP in Settings.
                </td>
              </tr>
            ) : (
              active.map((plan) => (
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
                    {plan.amount_btn_per_adult_night == null
                      ? "Label only"
                      : plan.amount_btn_per_adult_night === 0
                        ? "Nu 0"
                        : formatBtn(plan.amount_btn_per_adult_night)}
                  </td>
                  <td className="px-4 py-2.5 text-foreground">
                    {plan.amount_btn_per_child_night == null
                      ? "Free"
                      : plan.amount_btn_per_child_night === 0
                        ? "Nu 0"
                        : formatBtn(plan.amount_btn_per_child_night)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {plan.code === defaultMealPlanCode ? "Default" : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
