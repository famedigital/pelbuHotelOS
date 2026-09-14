import {
  COMPLIANCE_DEPARTMENTS,
  COMPLIANCE_PACK,
  PELBU_PROPERTY,
  type ComplianceDocMeta,
  type ComplianceDepartment,
} from "@/lib/compliance-pack/catalog";
import { Button } from "@/components/ui/button";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Compliance pack | Hotel OS",
  description:
    "ISR, BAFRA department SOPs, kitchen cleaning logs, and wall posters for DOT / MoLHR inspections.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CompliancePackPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const isr = COMPLIANCE_PACK.filter((d) => d.kind === "isr");
  const posters = COMPLIANCE_PACK.filter((d) => d.kind === "poster");
  const bafraKitchenCleaning = COMPLIANCE_PACK.filter((d) =>
    ["cleaning-daily", "cleaning-weekly", "cleaning-monthly"].includes(d.slug),
  );
  const formsByDept = COMPLIANCE_DEPARTMENTS.map((dept) => ({
    ...dept,
    items: COMPLIANCE_PACK.filter(
      (d) =>
        d.kind === "form" &&
        d.department === dept.id &&
        !["cleaning-daily", "cleaning-weekly", "cleaning-monthly"].includes(
          d.slug,
        ),
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="erp mx-auto w-full max-w-3xl space-y-8 p-4 md:p-6">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-sky-600 uppercase">
          DOT · MoLHR · BAFRA
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Compliance pack
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Printable BAFRA department SOPs, licences, and kitchen cleaning logs
          for {PELBU_PROPERTY.name}. Digital daily logs at{" "}
          <Link href="/erp/kitchen/compliance" className="underline">
            Kitchen compliance
          </Link>
          ; signed ISR at{" "}
          <Link href="/erp/hr/isr" className="underline">
            Team → ISR
          </Link>
          .
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href="/erp/dot-assessment">DOT assessment</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/erp/settings?tab=compliance">
              Settings · file uploads
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/erp/compliance/forms/cleaning-daily">
              Daily cleaning log
            </Link>
          </Button>
        </div>
      </header>

      <PackSection
        title="Kitchen cleaning logs (BAFRA · daily / weekly / monthly)"
        items={bafraKitchenCleaning}
      />
      <PackSection title="ISR (MoLHR submission)" items={isr} />

      {formsByDept.map((g) => (
        <PackSection
          key={g.id}
          title={`${g.label} — SOPs & log books`}
          items={g.items}
        />
      ))}

      <PackSection
        title="Wall posters (print · laminate · photo for DOT)"
        items={posters}
      />
    </div>
  );
}

function PackSection({
  title,
  items,
}: {
  title: string;
  items: ComplianceDocMeta[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      <ul className="space-y-2">
        {items.map((d) => (
          <li key={d.slug}>
            <Link
              href={d.href}
              className="block rounded-xl border bg-card p-4 transition-colors hover:border-sky-400/60"
            >
              <p className="font-medium">{d.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{d.blurb}</p>
              <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] text-muted-foreground">
                {d.bafra ? <span className="text-sky-700">BAFRA</span> : null}
                {d.department && d.department !== "all" ? (
                  <span>{deptLabel(d.department)}</span>
                ) : null}
                {d.checklistCodes.length > 0 ? (
                  <span>HCS: {d.checklistCodes.join(" · ")}</span>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function deptLabel(id: ComplianceDepartment) {
  return COMPLIANCE_DEPARTMENTS.find((d) => d.id === id)?.label ?? id;
}
