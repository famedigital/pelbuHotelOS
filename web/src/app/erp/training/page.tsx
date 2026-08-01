import { TrainingLmsPanel } from "@/components/erp/TrainingLmsPanel";
import { DeskPageTitle } from "@/components/erp/DeskShell";
import { isDeskAuthenticated, getDeskRole } from "@/lib/desk-auth";
import { manualsForDeskRole } from "@/lib/erp/training-manuals";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Training | Pelbu OS",
  description: "Role-filtered desk manuals and go-live checklist.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpTrainingPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const role = await getDeskRole();
  const manuals = manualsForDeskRole(role);

  return (
    <div className="erp mx-auto w-full max-w-3xl space-y-8 p-4 md:p-6">
      <DeskPageTitle
        eyebrow="Go-live"
        title="Desk training"
        description="Short role manuals with checklist progress. Complete before owner runs the settings danger-zone wipe."
      />
      <TrainingLmsPanel propertyId={propertyId} manuals={manuals} />
    </div>
  );
}
