import { IsrWorkbench, type IsrRow } from "@/components/erp/IsrWorkbench";
import { Button } from "@/components/ui/button";
import { getDeskRole, isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import type { IsrStatus } from "@/lib/hr/isr-bhutan";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Internal Service Rules | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpHrIsrPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const role = await getDeskRole();
  if (role !== "owner" && role !== "gm") redirect("/erp/hr");

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const { data: rows, error } = await admin
    .from("hr_internal_service_rules")
    .select(
      "id, version_label, title, status, notes, scope_summary, submitted_on, labour_office, labour_reference, approved_on, approval_reference, signed_on, signed_by_name, pdf_public_id, pdf_resource_type, pdf_file_name, pdf_uploaded_at, effective_from, effective_to, is_current, created_at",
    )
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error?.message?.includes("hr_internal_service_rules")) {
    return (
      <div className="erp mx-auto max-w-lg space-y-3 p-6">
        <h1 className="text-xl font-semibold">ISR not ready</h1>
        <p className="text-sm text-muted-foreground">
          Apply migration{" "}
          <code className="text-xs">20260806102331_hr_internal_service_rules</code>{" "}
          then reload.
        </p>
        <Button asChild variant="outline">
          <Link href="/erp/hr">← Staff directory</Link>
        </Button>
      </div>
    );
  }

  const isrRows: IsrRow[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    versionLabel: r.version_label as string,
    title: (r.title as string) ?? "Internal Service Rules",
    status: r.status as IsrStatus,
    notes: (r.notes as string | null) ?? null,
    scopeSummary: (r.scope_summary as string | null) ?? null,
    submittedOn: (r.submitted_on as string | null) ?? null,
    labourOffice: (r.labour_office as string | null) ?? null,
    labourReference: (r.labour_reference as string | null) ?? null,
    approvedOn: (r.approved_on as string | null) ?? null,
    approvalReference: (r.approval_reference as string | null) ?? null,
    signedOn: (r.signed_on as string | null) ?? null,
    signedByName: (r.signed_by_name as string | null) ?? null,
    pdfPublicId: (r.pdf_public_id as string | null) ?? null,
    pdfResourceType: (r.pdf_resource_type as string) ?? "raw",
    pdfFileName: (r.pdf_file_name as string | null) ?? null,
    pdfUploadedAt: (r.pdf_uploaded_at as string | null) ?? null,
    effectiveFrom: (r.effective_from as string | null) ?? null,
    effectiveTo: (r.effective_to as string | null) ?? null,
    isCurrent: Boolean(r.is_current),
    createdAt: r.created_at as string,
  }));

  return (
    <div className="erp mx-auto w-full max-w-[1100px] space-y-8 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            HR · Labour compliance
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Internal Service Rules
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Draft, submit to Labour, record approval, then upload the signed
            PDF. Staff and auditors treat the active signed file as the in-force
            ISR.
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/erp/hr">← Staff directory</Link>
        </Button>
      </header>

      <IsrWorkbench rows={isrRows} />
    </div>
  );
}
