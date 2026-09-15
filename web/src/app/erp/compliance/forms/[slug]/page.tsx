import { CompliancePrintShell } from "@/components/erp/compliance/CompliancePrintShell";
import { getComplianceDoc } from "@/lib/compliance-pack/catalog";
import { FORM_RENDERERS } from "@/lib/compliance-pack/forms";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getComplianceDoc(slug);
  return {
    title: doc ? `${doc.title} | Innora` : "Compliance form",
    robots: { index: false, follow: false },
  };
}

export default async function ComplianceFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { slug } = await params;
  const doc = getComplianceDoc(slug);
  const render = FORM_RENDERERS[slug];
  if (!doc || doc.kind !== "form" || !render) notFound();

  return (
    <CompliancePrintShell
      title={doc.title}
      subtitle={`${doc.blurb} · HCS ${doc.checklistCodes.join(", ")}`}
      wide
    >
      {render()}
    </CompliancePrintShell>
  );
}
