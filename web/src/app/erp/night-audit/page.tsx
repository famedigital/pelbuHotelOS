import { NightAuditForm } from "@/components/erp/NightAuditForm";
import { DeskHeader } from "@/components/erp/DeskHeader";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
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
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  const propertyId = property?.id as string | undefined;
  if (!propertyId) {
    return (
      <div className="min-h-screen bg-ivory">
        <DeskHeader title="Night audit" />
        <main className="mx-auto max-w-[1200px] px-6 py-10">
          <p className="text-sm text-maroon">Property not configured.</p>
        </main>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: audits } = await admin
    .from("night_audits")
    .select(
      "id, business_date, rooms_occupied, rooms_comp, folio_charges_btn, folio_payments_btn, open_folios, notes, created_at",
    )
    .eq("property_id", propertyId)
    .order("business_date", { ascending: false })
    .limit(30);

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader title="Night audit" />
      <main className="mx-auto max-w-[1200px] space-y-12 px-6 py-10 md:px-8">
        <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
          <NightAuditForm defaultDate={today} />

          <section>
            <div className="border-b border-espresso/15 pb-2">
              <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
                History
              </h2>
            </div>
            {(audits ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-muted">No night audits yet.</p>
            ) : (
              <ul className="mt-2">
                {(audits ?? []).map((a) => (
                  <li
                    key={a.id as string}
                    className="border-b border-espresso/10 py-4 text-sm"
                  >
                    <p className="font-medium text-espresso">
                      {a.business_date as string}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Sellable {a.rooms_occupied as number} · Comp {a.rooms_comp as number}{" "}
                      · Open folios {a.open_folios as number}
                    </p>
                    <p className="mt-1 tabular-nums text-xs text-espresso">
                      Charges {formatBtn(Number(a.folio_charges_btn))} · Payments{" "}
                      {formatBtn(Number(a.folio_payments_btn))}
                    </p>
                    {a.notes ? (
                      <p className="mt-1 text-xs text-muted">{a.notes as string}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
