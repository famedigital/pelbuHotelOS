import {
  AgentGhostLink,
  AgentMetric,
  AgentPageHero,
  AgentPrimaryLink,
  AgentSection,
} from "@/components/erp/agent-portal/AgentPortalChrome";
import { AgentStaysTable } from "@/components/erp/agent-portal/AgentStaysTable";
import { requireAgentPropertySession } from "@/lib/agent-auth";
import { loadAgentLivingDashboard } from "@/lib/agent-portal-dashboard";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Checkouts · Partner",
  robots: { index: false, follow: false },
};

export default async function AgentCheckoutsPage() {
  const session = await requireAgentPropertySession();
  const admin = createSupabaseAdminClient();
  const dash = await loadAgentLivingDashboard(admin, {
    agentId: session.agentId,
    propertyId: session.activePropertyId,
    sessionAgentId: session.agentId,
  });

  const rows = [...dash.checkoutsToday, ...dash.recentCheckouts];
  // de-dupe by id preserving order
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  return (
    <div className="space-y-6">
      <AgentPageHero
        eyebrow="Departures"
        title="Checkouts"
        blurb="Due-out today and recent departures — settle open balances with the desk."
        actions={
          <>
            <AgentPrimaryLink href="/agents/app/payments">
              Payments
            </AgentPrimaryLink>
            <AgentGhostLink href="/agents/app">Dashboard</AgentGhostLink>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <AgentMetric
          label="Due-out today"
          value={String(dash.metrics.checkoutsToday)}
          tone={dash.metrics.checkoutsToday ? "warn" : "default"}
        />
        <AgentMetric
          label="Unpaid checkouts"
          value={String(dash.metrics.unpaidCheckouts)}
          tone={dash.metrics.unpaidCheckouts ? "warn" : "ok"}
        />
        <AgentMetric
          label="Open due (all)"
          value={formatBtn(dash.metrics.openDueBtn)}
        />
      </div>
      <AgentSection title="Checkout list" description="Today + last 14 days">
        <AgentStaysTable rows={unique} />
      </AgentSection>
    </div>
  );
}
