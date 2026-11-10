import { ErpBreadcrumb } from "@/components/erp/ErpBreadcrumb";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { RatesDesk } from "@/components/erp/rates/RatesDesk";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import {
  loadActiveMealPlans,
  loadPropertyDefaultMealPlanCode,
} from "@/lib/meal-plans";
import { loadRoomRatesMatrix } from "@/lib/room-rates-data";
import { listNamedRateOffers } from "@/lib/rates/rate-offers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Room rates",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function RoomRatesPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [
    { rows, roomTypes, seasons },
    mealPlans,
    defaultMealPlanCode,
    policyResult,
    propertyTax,
    agentsResult,
    namedOffers,
  ] = await Promise.all([
    loadRoomRatesMatrix(admin, propertyId),
    loadActiveMealPlans(admin, propertyId),
    loadPropertyDefaultMealPlanCode(admin, propertyId),
    admin
      .from("property_policies")
      .select("rates_inclusive_of_gst_sc")
      .eq("property_id", propertyId)
      .maybeSingle(),
    admin
      .from("properties")
      .select(
        "gst_enabled, gst_rate, service_charge_rate, service_charge_default_on",
      )
      .eq("id", propertyId)
      .maybeSingle(),
    admin
      .from("agents")
      .select("id, company_name")
      .order("company_name")
      .limit(200),
    listNamedRateOffers(admin, propertyId).catch(() => []),
  ]);

  const ratesInclusiveOfGstSc = Boolean(
    policyResult.data?.rates_inclusive_of_gst_sc,
  );
  const gstCharged =
    propertyTax.data?.gst_enabled !== false &&
    Number(propertyTax.data?.gst_rate ?? 0) > 0;
  const gstRate = gstCharged ? Number(propertyTax.data?.gst_rate ?? 0) : 0;
  const serviceChargeRate =
    propertyTax.data?.service_charge_default_on === false
      ? 0
      : Number(propertyTax.data?.service_charge_rate ?? 0);

  const taxBasis = ratesInclusiveOfGstSc
    ? gstCharged
      ? "Sheet amounts are guest all-in. The folio splits base, service charge, and GST"
      : "Sheet amounts are guest all-in. The folio splits base and service charge. GST is not charged"
    : gstCharged
      ? "Sheet amounts are room only. The folio adds service charge, then GST"
      : "Sheet amounts are room only. The folio adds service charge. GST is not charged";

  const seasonRows = seasons
    .filter((season) => Boolean(season.id))
    .map((season) => ({
      id: season.id as string,
      kind: season.kind,
      starts_on: season.starts_on,
      ends_on: season.ends_on,
    }));

  return (
    <DeskListShell
      wide
      eyebrow="Hotel"
      heading="Room rates"
      subtitle="One book for markets, packages, named prices, and seasons."
      filters={
        <ErpBreadcrumb
          items={[
            { label: "Desk", href: "/erp/stayview" },
            { label: "Rates" },
          ]}
        />
      }
    >
      <RatesDesk
        propertyId={propertyId}
        rows={rows}
        roomTypes={roomTypes}
        seasons={seasons}
        seasonRows={seasonRows}
        mealPlans={mealPlans}
        defaultMealPlanCode={defaultMealPlanCode}
        ratesInclusiveOfGstSc={ratesInclusiveOfGstSc}
        gstCharged={gstCharged}
        serviceChargeRate={serviceChargeRate}
        gstRate={gstRate}
        taxBasis={taxBasis}
        namedOffers={namedOffers.map((offer) => ({
          id: offer.id,
          label: offer.label,
          rateTier: offer.rateTier,
          agentName: offer.agentName,
          guestLabel: offer.guestLabel,
          roomTypeName: offer.roomTypeName,
          seasonKind: offer.seasonKind,
          amountBtn: offer.amountBtn,
          amountSingleBtn: offer.amountSingleBtn,
        }))}
        agents={(agentsResult.data ?? []) as { id: string; company_name: string }[]}
      />
    </DeskListShell>
  );
}
