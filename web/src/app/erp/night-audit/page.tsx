import { NightAuditForm } from "@/components/erp/NightAuditForm";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { thimphuToday } from "@/lib/erp-lists";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Night audit | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpNightAuditPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const today = thimphuToday();
  const { data: audits } = await admin
    .from("night_audits")
    .select(
      "id, business_date, rooms_occupied, rooms_comp, folio_charges_btn, folio_payments_btn, open_folios, notes, created_at",
    )
    .eq("property_id", propertyId)
    .order("business_date", { ascending: false })
    .limit(30);

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-10 p-4 md:p-6">
      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        <NightAuditForm defaultDate={today} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(audits ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No night audits yet.
              </p>
            ) : (
              <ul className="divide-y">
                {(audits ?? []).map((a) => (
                  <li key={a.id as string} className="py-4 text-sm">
                    <p className="font-medium text-foreground">
                      {a.business_date as string}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sellable {a.rooms_occupied as number} · Comp {a.rooms_comp as number}{" "}
                      · Open folios {a.open_folios as number}
                    </p>
                    <p className="mt-1 text-xs tabular-nums text-foreground">
                      Charges {formatBtn(Number(a.folio_charges_btn))} · Payments{" "}
                      {formatBtn(Number(a.folio_payments_btn))}
                    </p>
                    {a.notes ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {a.notes as string}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
