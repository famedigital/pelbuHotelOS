import { adjustLoyaltyPoints } from "@/app/actions/erp-loyalty";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { PropertyWizardForm } from "@/components/erp/PropertyWizardForms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Loyalty",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpLoyaltyPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const { data: accounts } = await admin
    .from("guest_loyalty_accounts")
    .select(
      "id, contact_phone, display_name, points_balance, tier, updated_at",
    )
    .eq("property_id", propertyId)
    .order("updated_at", { ascending: false })
    .limit(80);

  return (
    <DeskListShell
      eyebrow="Guests"
      heading="Loyalty points"
      blurb="Points ledger per guest phone. Guests can look up balance at /guest/loyalty. Earn rule: 1 point per 10 BTN at checkout when wired."
      filters={
        <Link
          href="/guest/loyalty"
          className="inline-flex h-9 items-center rounded-md border px-3 text-xs hover:bg-muted"
        >
          Guest portal
        </Link>
      }
    >
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Adjust points</h2>
        <PropertyWizardForm action={adjustLoyaltyPoints}>
          <input type="hidden" name="property_id" value={propertyId} />
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="contact_phone">Phone</Label>
              <Input id="contact_phone" name="contact_phone" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="display_name">Name</Label>
              <Input id="display_name" name="display_name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delta_points">Δ points</Label>
              <Input
                id="delta_points"
                name="delta_points"
                type="number"
                required
                placeholder="+100 or -50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" name="reason" placeholder="comp, redeem…" />
            </div>
          </div>
          <Button type="submit" className="mt-3 h-10">
            Post adjustment
          </Button>
        </PropertyWizardForm>
      </section>

      {(accounts ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No loyalty accounts yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {(accounts ?? []).map((a) => (
            <li
              key={a.id as string}
              className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {(a.display_name as string) || (a.contact_phone as string)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.contact_phone as string} ·{" "}
                  <span className="capitalize">{a.tier as string}</span>
                </p>
              </div>
              <p className="tabular-nums font-semibold">
                {Number(a.points_balance)} pts
              </p>
            </li>
          ))}
        </ul>
      )}
    </DeskListShell>
  );
}
