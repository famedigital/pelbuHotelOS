import { CompliancePrintShell } from "@/components/erp/compliance/CompliancePrintShell";
import { getComplianceDoc } from "@/lib/compliance-pack/catalog";
import { POSTER_RENDERERS } from "@/lib/compliance-pack/posters";
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
    title: doc ? `${doc.title} | Pelbu OS` : "Compliance poster",
    robots: { index: false, follow: false },
  };
}

export default async function CompliancePosterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { slug } = await params;
  const doc = getComplianceDoc(slug);
  const render = POSTER_RENDERERS[slug];
  if (!doc || doc.kind !== "poster" || !render) notFound();

  return (
    <CompliancePrintShell
      title={doc.title}
      subtitle="Print large · laminate · display · photograph for DOT evidence"
      wide
    >
      <div className="rounded-2xl border-2 border-neutral-800 p-6 print:border-black">
        {render()}
      </div>
    </CompliancePrintShell>
  );
}
