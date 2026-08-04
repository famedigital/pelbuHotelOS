import { MealPlansRatesSummary } from "@/components/erp/MealPlansRatesSummary";
import { RoomRatesSheet } from "@/components/erp/RoomRatesSheet";
import { SeasonsDateEditor } from "@/components/erp/SeasonsDateEditor";
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

  const [{ rows, roomTypes, seasons }, mealPlans, defaultMealPlanCode, policyResult] =
    await Promise.all([
      loadRoomRatesMatrix(admin, propertyId),
      loadActiveMealPlans(admin, propertyId),
      loadPropertyDefaultMealPlanCode(admin, propertyId),
      admin
        .from("property_policies")
        .select("rates_inclusive_of_gst_sc")
        .eq("property_id", propertyId)
        .maybeSingle(),
    ]);

  const ratesInclusiveOfGstSc = Boolean(
    policyResult.data?.rates_inclusive_of_gst_sc,
  );

  const seasonRows = seasons
    .filter((s) => Boolean(s.id))
    .map((s) => ({
      id: s.id as string,
      kind: s.kind,
      starts_on: s.starts_on,
      ends_on: s.ends_on,
    }));

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
          <a
            href="/rates"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
          >
            Public rate card →
          </a>
        </div>
      }
    >
      <section className="rounded-xl border bg-card p-5">
        <SeasonsDateEditor seasons={seasonRows} />
      </section>

      <section className="space-y-3">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Room rate sheet</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Rows are room categories; columns are peak, lean, and off seasons.
            Switch tier tabs for public rack, agent, MOU, friends, and family
            rates. Each agent&apos;s tier on their profile selects which column
            group applies at booking time. Under each adult Nu, the sheet shows
            the <strong className="font-medium text-foreground">child package</strong>
            : 0–6 free and 6–12 auto at 50% of adult. Amounts are{" "}
            {ratesInclusiveOfGstSc
              ? "inclusive of GST and SC (when SC is on by default)"
              : "exclusive of GST and SC"}
            {" — "}
            change under Settings → Rates &amp; meals.
          </p>
        </header>
        <RoomRatesSheet
          rows={rows}
          roomTypes={roomTypes}
          seasons={seasons}
          ratesInclusiveOfGstSc={ratesInclusiveOfGstSc}
        />
      </section>

      <MealPlansRatesSummary
        mealPlans={mealPlans}
        defaultMealPlanCode={defaultMealPlanCode}
      />

      <section className="rounded-lg border border-dashed bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How quoting works</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            <strong className="font-medium text-foreground">Tax basis</strong>{" "}
            —{" "}
            {ratesInclusiveOfGstSc ? (
              <>
                sheet = guest all-in (Inc. GST+SC); folio reverse-outs base / SC
                / GST
              </>
            ) : (
              <>
                sheet = exclusive net (Excl. GST+SC); folio adds SC then GST
              </>
            )}
          </li>
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
            <strong className="font-medium text-foreground">Child package</strong>{" "}
            — ages 0–6 free; ages 6–12 = 50% of adult rate (auto from the adult
            room / meal amount). Count ages 6–12 only in booking children;
            infants under 6 do not pay.
          </li>
          <li>
            <strong className="font-medium text-foreground">Meals</strong> —
            adult rate × adults × nights + child package × children (6–12) ×
            nights (blank child meal in Settings = auto 50% of adult meal rate)
          </li>
          <li>
            <strong className="font-medium text-foreground">Extra beds</strong> —
            property sell rate × qty × nights (enable in Rates &amp; meals)
          </li>
        </ul>
      </section>
    </DeskListShell>
  );
}
