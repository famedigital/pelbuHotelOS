import { AssessmentUploadForm } from "@/components/erp/finance/StatementForms";
import { FinanceShell } from "@/components/erp/finance/FinanceShell";
import { loadRrcoView } from "@/lib/finance/rrco-pack";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "RRCO assessment", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function RrcoAssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const year = Number((await searchParams).year) || new Date().getFullYear();
  const admin = createSupabaseAdminClient();
  const view = await loadRrcoView(admin, await resolveActivePropertyId(admin), year);
  return (
    <FinanceShell
      showTax
      title="Assessment file"
      description="Backup for the return: canonical invoices and bills, complimentary lines, and every line left off profit with its reason."
    >
      <section>
        <h2 className="mb-2 font-semibold">Uploaded backups</h2>
        <ul className="mb-4 text-sm">
          {view.files.length === 0 ? <li className="text-muted-foreground">None yet.</li> : null}
          {view.files.map((f) => (
            <li key={f.id}>
              {f.kind} · {f.label}
              {f.notes ? ` · ${f.notes}` : ""}
              {f.storagePath ? " · file stored" : ""}
            </li>
          ))}
        </ul>
        <AssessmentUploadForm year={year} />
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Complimentary schedule</h2>
        <ul className="text-sm">
          {view.comps.length === 0 ? <li className="text-muted-foreground">None.</li> : null}
          {view.comps.map((r) => (
            <li key={r.id}>
              {r.date} · {r.party} · {r.description} · {formatBtn(r.amount)}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Reason schedule</h2>
        <ul className="text-sm">
          {view.reasons.map((r) => (
            <li key={r.id}>
              {r.date} · {r.treatment} · {r.description} · {formatBtn(r.amount)}
              {r.reason ? ` · ${r.reason}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </FinanceShell>
  );
}
