import { upsertRatePlan, deactivateRatePlan } from "@/app/actions/erp-rate-plans";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Rate plans",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

async function createPlanAction(formData: FormData) {
  "use server";
  await upsertRatePlan({ ok: false }, formData);
}

async function deactivatePlanAction(formData: FormData) {
  "use server";
  await deactivateRatePlan({ ok: false }, formData);
}

export default async function RatePlansPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [{ data: plans }, { data: roomTypes }] = await Promise.all([
    admin
      .from("rate_plans")
      .select(
        "id, code, name, season_kind, rate_tier, base_amount_btn, active, notes, room_types(code, name)",
      )
      .eq("property_id", propertyId)
      .order("code")
      .limit(100),
    admin
      .from("room_types")
      .select("id, code, name")
      .eq("property_id", propertyId)
      .eq("inventory_kind", "sellable_guest")
      .order("code"),
  ]);

  return (
    <DeskListShell
      eyebrow="Channels"
      heading="Rate plans"
      blurb="Named plans for desk / channel mapping. Live quotes use the room_rates matrix on Room rates."
      filters={
        <Link
          href="/erp/rates"
          className="text-sm text-accent underline-offset-4 hover:underline"
        >
          Room rates sheet →
        </Link>
      }
    >
      <form
        action={createPlanAction}
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <p className="sm:col-span-2 lg:col-span-3 text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
          New named plan
        </p>
        <label className="space-y-1.5 text-sm">
          <span className="text-muted-foreground">Code</span>
          <Input name="code" required placeholder="BAR" className="h-10" />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-muted-foreground">Name</span>
          <Input
            name="name"
            required
            placeholder="Best available"
            className="h-10"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-muted-foreground">Room type</span>
          <select
            name="room_type_id"
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            defaultValue=""
          >
            <option value="">Any</option>
            {(roomTypes ?? []).map((rt) => (
              <option key={rt.id as string} value={rt.id as string}>
                {rt.code as string} · {rt.name as string}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-muted-foreground">Season</span>
          <select
            name="season_kind"
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            defaultValue=""
          >
            <option value="">Any</option>
            <option value="peak">Peak</option>
            <option value="lean">Lean</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-muted-foreground">Tier</span>
          <select
            name="rate_tier"
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            defaultValue=""
          >
            <option value="">Any</option>
            <option value="public">Public</option>
            <option value="friends">Friends</option>
            <option value="family">Family</option>
            <option value="mutual_friends">Mutual friends</option>
            <option value="agents">Agents</option>
            <option value="mou_agents">MOU agents</option>
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-muted-foreground">Base amount (BTN)</span>
          <Input
            name="base_amount_btn"
            type="number"
            min={0}
            step="0.01"
            className="h-10"
          />
        </label>
        <label className="space-y-1.5 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Notes</span>
          <Input name="notes" className="h-10" />
        </label>
        <input type="hidden" name="active" value="on" />
        <div className="flex items-end">
          <Button type="submit" className="h-10 w-full">
            Save plan
          </Button>
        </div>
      </form>

      <ul className="divide-y rounded-lg border bg-card">
        {(plans ?? []).length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">
            No named rate plans yet.
          </li>
        ) : (
          (plans ?? []).map((p) => {
            const rt = (
              Array.isArray(p.room_types) ? p.room_types[0] : p.room_types
            ) as { code?: string; name?: string } | null;
            return (
              <li
                key={p.id as string}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    <span className="font-mono text-xs text-muted-foreground">
                      {p.code as string}
                    </span>{" "}
                    {p.name as string}
                    {!p.active ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (inactive)
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {rt ? `${rt.code} · ${rt.name}` : "Any room type"}
                    {p.season_kind ? ` · ${p.season_kind}` : ""}
                    {p.rate_tier
                      ? ` · ${String(p.rate_tier).replace(/_/g, " ")}`
                      : ""}
                    {p.base_amount_btn != null
                      ? ` · ${formatBtn(Number(p.base_amount_btn))}`
                      : ""}
                  </p>
                </div>
                {p.active ? (
                  <form action={deactivatePlanAction}>
                    <input
                      type="hidden"
                      name="plan_id"
                      value={p.id as string}
                    />
                    <Button type="submit" variant="outline" size="sm">
                      Deactivate
                    </Button>
                  </form>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </DeskListShell>
  );
}
