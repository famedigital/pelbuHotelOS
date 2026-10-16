import { TrainingLmsPanel } from "@/components/erp/TrainingLmsPanel";
import { DeskPageTitle } from "@/components/erp/DeskShell";
import { isDeskAuthenticated, getDeskRole } from "@/lib/desk-auth";
import { manualsForDeskRole } from "@/lib/erp/training-manuals";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Training",
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
      <section
        id="stay-money"
        className="scroll-mt-20 rounded-lg border bg-card px-4 py-3 text-sm"
      >
        <h2 className="text-base font-semibold tracking-tight">
          How stay money works
        </h2>
        <p className="mt-1.5 text-muted-foreground">
          Guest due is one number everywhere — StayHub Folio, Open bills, Unpaid
          bills, and invoice print (when charges exist). Nightly base is the
          agreed sheet rate; posted room lines include tax/SC as configured.
          Void wrong lines first (manager PIN if the night is period-locked),
          preview then post missing nights, reopen the tax invoice after voids,
          collect until Clear, then check out. Pay-at-leave stays use Collect
          payment — not Agent bill.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Architecture:{" "}
          <a
            href="/erp/unpaid-bills"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Unpaid bills
          </a>
          {" · "}
          empty invoice print links here when all lines were voided.
        </p>
      </section>
      <TrainingLmsPanel propertyId={propertyId} manuals={manuals} />
    </div>
  );
}
