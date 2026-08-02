import { getDeskRole, isDeskAuthenticated } from "@/lib/desk-auth";
import {
  canPreviewDashboards,
  deskRoleToDashboardView,
  loadRoleDashboardSnapshot,
  parseDashboardView,
} from "@/lib/erp/role-dashboard";
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
  searchParams: Promise<{ view?: string }>;
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

  const snap = await loadRoleDashboardSnapshot(admin, propertyId);
  const setupIncomplete = activeProperty && !activeProperty.setup_completed_at;

  return (
    <>
      {setupIncomplete ? (
        <div className="erp px-4 pt-4 md:px-6 md:pt-6">
          <Alert variant="destructive">
            <AlertTitle>Setup incomplete</AlertTitle>
            <AlertDescription>
              Finish setup for {activeProperty.name}.{" "}
              <a
                href={`/erp/properties/${propertyId}/setup`}
                className="font-medium text-accent underline-offset-4 hover:underline"
              >
                Finish setup →
              </a>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      <RoleDashboard view={view} snap={snap} sessionRole={sessionRole} />
    </>
  );
}
