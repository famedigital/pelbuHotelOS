import { stampFnbLoyalty } from "@/app/actions/erp-fnb-ops";
import { FnbLoyaltyForm } from "@/components/erp/fnb/FnbLoyaltyForm";
import { FnbSectionHeader } from "@/components/erp/fnb/FnbSectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FnbLoyaltyPage() {
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const { data: cards } = await admin
    .from("fnb_loyalty_cards")
    .select("id, phone, guest_name, stamps, free_meals, updated_at")
    .eq("property_id", propertyId)
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <FnbSectionHeader
        title="F&B stamp card"
        description="10 stamps = 1 free meal. Local walk-in loyalty."
      />
      <Link href="/erp/pos" className="text-sm text-muted-foreground">
        ← POS
      </Link>
      <FnbLoyaltyForm action={stampFnbLoyalty} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(cards ?? []).map((c) => (
            <div
              key={c.id as string}
              className="flex justify-between text-sm border-b border-border/40 py-2"
            >
              <span>
                {String(c.guest_name || c.phone)} · {String(c.phone)}
              </span>
              <span className="tabular-nums">
                {Number(c.stamps)} stamps · {Number(c.free_meals)} free
              </span>
            </div>
          ))}
          {!cards?.length ? (
            <p className="text-sm text-muted-foreground">No cards yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
