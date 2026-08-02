import { MealPlansRatesSummary } from "@/components/erp/MealPlansRatesSummary";
import { RoomRatesSheet } from "@/components/erp/RoomRatesSheet";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import {
  loadActiveMealPlans,
  loadPropertyDefaultMealPlanCode,
} from "@/lib/meal-plans";
import { loadRoomRatesMatrix } from "@/lib/room-rates-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Room rates | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function RoomRatesPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [{ rows, roomTypes, seasons }, mealPlans, defaultMealPlanCode] =
    await Promise.all([
      loadRoomRatesMatrix(admin, propertyId),
      loadActiveMealPlans(admin, propertyId),
      loadPropertyDefaultMealPlanCode(admin, propertyId),
    ]);

  return (
    <DeskListShell
      eyebrow="Hotel"
      heading="Room rates & meal packages"
      blurb="Single source for per-night room Nu by season and market tier. Public book, fast book, calendar reservations, check-in, and agent portal all quote from this matrix plus meal plan add-ons."
      filters={
        <div className="flex flex-wrap gap-2">
          <Link
            href="/erp/rate-plans"
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
          >
            Named rate plans →
          </Link>
          <Link
            href="/erp/agents"
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
          >
            Agent partners →
          </Link>
        </div>
      }
    >
      <section className="space-y-3">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Room rate sheet</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Rows are room categories; columns are peak, lean, and off seasons.
            Switch tier tabs for public rack, agent, MOU, friends, and family
            rates. Each agent&apos;s tier on their profile selects which column
            group applies at booking time.
          </p>
        </header>
        <RoomRatesSheet rows={rows} roomTypes={roomTypes} seasons={seasons} />
      </section>

      <MealPlansRatesSummary
        mealPlans={mealPlans}
        defaultMealPlanCode={defaultMealPlanCode}
      />

      <section className="rounded-lg border border-dashed bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How quoting works</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            <strong className="font-medium text-foreground">Public site</strong>{" "}
            — <code className="font-mono text-xs">public</code> tier +
            check-in season from <code className="font-mono text-xs">seasons</code>
          </li>
          <li>
            <strong className="font-medium text-foreground">Agent book</strong> —
            agent&apos;s <code className="font-mono text-xs">rate_tier</code>{" "}
            (usually agents or mou_agents)
          </li>
          <li>
            <strong className="font-medium text-foreground">Desk flows</strong> —
            fast book / calendar use public unless an agent is attached
          </li>
          <li>
            <strong className="font-medium text-foreground">Meals</strong> —
            meal plan Nu × adults × nights added on top of room total
          </li>
        </ul>
      </section>
    </DeskListShell>
  );
}
