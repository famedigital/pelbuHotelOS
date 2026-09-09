import {
  COMPLIANCE_PACK,
  PELBU_PROPERTY,
} from "@/lib/compliance-pack/catalog";
import { Button } from "@/components/ui/button";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Compliance pack | Pelbu OS",
  description:
    "ISR, log books, and BAFRA wall posters for DOT / MoLHR / kitchen inspections.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CompliancePackPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const isr = COMPLIANCE_PACK.filter((d) => d.kind === "isr");
  const forms = COMPLIANCE_PACK.filter((d) => d.kind === "form");
  const posters = COMPLIANCE_PACK.filter((d) => d.kind === "poster");

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
          Printable Internal Service Rules, inspection log books, and kitchen
          wall posters for {PELBU_PROPERTY.name}. Digital kitchen logs stay at{" "}
          <Link href="/erp/kitchen/compliance" className="underline">
            Kitchen compliance
          </Link>
          ; signed ISR PDF lifecycle at{" "}
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
        </div>
      </header>

      <PackSection title="ISR (MoLHR submission)" items={isr} />
      <PackSection title="Log books & SOPs" items={forms} />
      <PackSection title="Wall posters (print · laminate · photo for DOT)" items={posters} />
    </div>
  );
}

function PackSection({
  title,
  items,
}: {
  title: string;
  items: typeof COMPLIANCE_PACK;
}) {
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
              {d.checklistCodes.length > 0 ? (
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                  HCS: {d.checklistCodes.join(" · ")}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
