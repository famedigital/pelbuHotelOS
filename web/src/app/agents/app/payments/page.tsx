import {
  AgentGhostLink,
  AgentMetric,
  AgentPageHero,
  AgentPrimaryLink,
  AgentSection,
} from "@/components/erp/agent-portal/AgentPortalChrome";
import { AgentPaymentsTable } from "@/components/erp/agent-portal/AgentPaymentsTable";
import { requireAgentPropertySession } from "@/lib/agent-auth";
import { loadAgentLivingDashboard } from "@/lib/agent-portal-dashboard";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Payments · Partner",
  robots: { index: false, follow: false },
};

export default async function AgentPaymentsPage() {
  const session = await requireAgentPropertySession();
  const admin = createSupabaseAdminClient();
  const dash = await loadAgentLivingDashboard(admin, {
    agentId: session.agentId,
    propertyId: session.activePropertyId,
    sessionAgentId: session.agentId,
  });

  return (
    <div className="space-y-6">
      <AgentPageHero
        eyebrow="Collections"
        title="Payments"
        blurb="Money posted against your stays. Upload transfer screenshots from each stay detail."
        actions={
          <>
            <AgentPrimaryLink href="/agents/app/money">
              Money cockpit
            </AgentPrimaryLink>
            <AgentGhostLink href="/agents/app/invoices">
              Invoices
            </AgentGhostLink>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <AgentMetric
          label="Payments"
          value={String(dash.payments.length)}
          tone="accent"
        />
        <AgentMetric
          label="Paid total"
          value={formatBtn(dash.metrics.paidBtn)}
          tone="ok"
        />
        <AgentMetric
          label="Still due"
          value={formatBtn(dash.metrics.openDueBtn)}
          tone={Math.abs(dash.metrics.openDueBtn) > 0.5 ? "warn" : "default"}
        />
      </div>
      <AgentSection title="Payment ledger" description="Newest first">
        <AgentPaymentsTable rows={dash.payments} />
      </AgentSection>
    </div>
  );
}
