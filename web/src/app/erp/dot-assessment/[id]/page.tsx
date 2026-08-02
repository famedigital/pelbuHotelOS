import { getDotAssessmentBundle } from "@/app/actions/erp-dot-assessment";
import { DotAssessmentShell } from "@/components/erp/dot-assessment/DotAssessmentShell";
import { getCatalog } from "@/lib/dot-assessment/catalog";
import { getDeskRole, isDeskAuthenticated } from "@/lib/desk-auth";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "DOT Assessment worksheet | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DotAssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { id } = await params;

  let bundle: Awaited<ReturnType<typeof getDotAssessmentBundle>>;
  try {
    bundle = await getDotAssessmentBundle(id);
  } catch {
    notFound();
  }

  const catalog = getCatalog(bundle.assessment.starLevel);
  const role = await getDeskRole();
  const readOnly =
    bundle.assessment.status === "archived" ||
    (role !== "owner" && role !== "gm" && role !== "front_desk");

  return (
    <div className="erp mx-auto w-full max-w-4xl space-y-4 p-4 pb-4 md:p-6">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-sky-600 uppercase">
          {bundle.assessment.starLevel}-star · HCS 2024
        </p>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          DOT walk-through
        </h1>
        <p className="text-sm text-muted-foreground">
          Tap Yes/No, photo evidence, filter Open items. Progress saves instantly.
        </p>
      </header>
      <Suspense
        fallback={
          <div className="space-y-3">
            <div className="h-16 animate-pulse rounded-xl bg-muted" />
            <div className="h-40 animate-pulse rounded-xl bg-muted" />
          </div>
        }
      >
        <DotAssessmentShell
          assessment={bundle.assessment}
          catalog={catalog}
          responses={bundle.responses}
          evidence={bundle.evidence}
          readOnly={readOnly}
        />
      </Suspense>
    </div>
  );
}
