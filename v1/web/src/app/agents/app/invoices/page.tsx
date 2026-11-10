import {
  AgentGhostLink,
  AgentMetric,
  AgentPageHero,
  AgentPrimaryLink,
  AgentSection,
} from "@/components/erp/agent-portal/AgentPortalChrome";
import { AgentInvoicesTable } from "@/components/erp/agent-portal/AgentInvoicesTable";
import { requireAgentPropertySession } from "@/lib/agent-auth";
import { loadAgentLivingDashboard } from "@/lib/agent-portal-dashboard";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Invoices · Partner",
  robots: { index: false, follow: false },
};

export default async function AgentInvoicesListPage() {
  const session = await requireAgentPropertySession();
  const admin = createSupabaseAdminClient();
  const dash = await loadAgentLivingDashboard(admin, {
    agentId: session.agentId,
    propertyId: session.activePropertyId,
    sessionAgentId: session.agentId,
  });

  const invTotal = dash.invoices.reduce(
    (s, i) => s + (i.totalBtn ?? 0),
    0,
  );
  const invoicesOnly = dash.invoices.filter((i) => i.docKind === "invoice");
  const receipts = dash.invoices.filter((i) => i.docKind === "receipt");

  return (
    <div className="space-y-6">
      <AgentPageHero
        eyebrow="Fiscal INV-…"
        title="Invoices & receipts"
        blurb="Tax invoices INV-… from the hotel (not PS stay confirmations). View and print."
        actions={
          <>
            <AgentPrimaryLink href="/agents/app/payments">
              Payments
            </AgentPrimaryLink>
            <AgentGhostLink href="/agents/app/stays">Stays</AgentGhostLink>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <AgentMetric
          label="Invoices"
          value={String(invoicesOnly.length)}
          tone="accent"
        />
        <AgentMetric label="Receipts" value={String(receipts.length)} />
        <AgentMetric label="Document total" value={formatBtn(invTotal)} />
      </div>
      <AgentSection title="Documents" description="INV and RCP for your agent">
        <AgentInvoicesTable rows={dash.invoices} />
      </AgentSection>
    </div>
  );
}
