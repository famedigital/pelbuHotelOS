import { getDeskRole, isDeskAuthenticated } from "@/lib/desk-auth";
import {
  canPreviewDashboards,
  deskRoleToDashboardView,
  loadRoleDashboardSnapshot,
  parseDashboardView,
} from "@/lib/erp/role-dashboard";
import { parseForecastMonthYm } from "@/lib/erp/guest-forecast";
import {
  loadProperty,
  resolveActivePropertyId,
} from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { RoleDashboard } from "@/components/erp/RoleDashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Desk dashboard | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ view?: string; forecastMonth?: string }>;
};

export default async function ErpDashboardPage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const activeProperty = await loadProperty(admin, propertyId);
  const sessionRole = await getDeskRole();
  const params = await searchParams;
  const requested = parseDashboardView(params.view);
  const homeView = sessionRole
    ? deskRoleToDashboardView(sessionRole)
    : "front_desk";
  const view =
    requested && canPreviewDashboards(sessionRole) ? requested : homeView;
  const forecastMonthYm = parseForecastMonthYm(params.forecastMonth);

  const snap = await loadRoleDashboardSnapshot(admin, propertyId, {
    forecastMonthYm,
  });
  const setupIncomplete = activeProperty && !activeProperty.setup_completed_at;

  const [{ count: roomUnitCount }, { count: roomTypeCount }, { count: rateCount }] =
    await Promise.all([
      admin
        .from("room_units")
        .select("*", { count: "exact", head: true })
        .eq("property_id", propertyId),
      admin
        .from("room_types")
        .select("*", { count: "exact", head: true })
        .eq("property_id", propertyId),
      admin
        .from("room_rates")
        .select("*", { count: "exact", head: true })
        .eq("property_id", propertyId),
    ]);

  const missingInventory =
    (roomUnitCount ?? 0) < 1 || (roomTypeCount ?? 0) < 1 || (rateCount ?? 0) < 1;
  const setupHref = activeProperty
    ? `/erp/properties/${propertyId}/setup`
    : "/erp/properties/new";
  const showSetupBanner = Boolean(activeProperty) && (setupIncomplete || missingInventory);

  return (
    <>
      {showSetupBanner && activeProperty ? (
        <div className="erp px-4 pt-4 md:px-6 md:pt-6">
          <Alert variant="destructive">
            <AlertTitle>
              {setupIncomplete ? "Setup incomplete" : "Inventory needs setup"}
            </AlertTitle>
            <AlertDescription>
              {setupIncomplete ? (
                <>Finish setup for {activeProperty.name}. </>
              ) : (
                <>
                  {activeProperty.name} is missing{" "}
                  {(roomTypeCount ?? 0) < 1
                    ? "room categories"
                    : (roomUnitCount ?? 0) < 1
                      ? "physical rooms"
                      : "room rates"}{" "}
                  (common after a selective wipe).{" "}
                </>
              )}
              <a
                href={
                  (roomTypeCount ?? 0) < 1 || (roomUnitCount ?? 0) < 1
                    ? `${setupHref}?step=2`
                    : (rateCount ?? 0) < 1
                      ? `${setupHref}?step=3`
                      : setupHref
                }
                className="font-medium text-accent underline-offset-4 hover:underline"
              >
                Open setup wizard →
              </a>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      <RoleDashboard view={view} snap={snap} sessionRole={sessionRole} />
    </>
  );
}
