import {
  AgentGhostLink,
  AgentMetric,
  AgentPageHero,
  AgentPrimaryLink,
  AgentSection,
} from "@/components/erp/agent-portal/AgentPortalChrome";
import { AgentGuestsTable } from "@/components/erp/agent-portal/AgentGuestsTable";
import { requireAgentPropertySession } from "@/lib/agent-auth";
import { loadAgentLivingDashboard } from "@/lib/agent-portal-dashboard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Guest registrations · Partner",
  robots: { index: false, follow: false },
};

export default async function AgentGuestsPage() {
  const session = await requireAgentPropertySession();
  const admin = createSupabaseAdminClient();
  const dash = await loadAgentLivingDashboard(admin, {
    agentId: session.agentId,
    propertyId: session.activePropertyId,
    sessionAgentId: session.agentId,
  });

  const arriving = dash.guests.filter((g) =>
    dash.arrivalsToday.some((a) => a.id === g.bookingId),
  ).length;

  return (
    <div className="space-y-6">
      <AgentPageHero
        eyebrow="Registrations"
        title="Guest register"
        blurb="Names, passport/CID and SDF refs captured at check-in for your stays."
        actions={
          <>
            <AgentPrimaryLink href="/agents/app">Dashboard</AgentPrimaryLink>
            <AgentGhostLink href="/agents/app/stays">Stays</AgentGhostLink>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <AgentMetric
          label="Registered guests"
          value={String(dash.guests.length)}
          tone="accent"
        />
        <AgentMetric
          label="Arrivals today"
          value={String(dash.metrics.arrivalsToday)}
        />
        <AgentMetric
          label="On arrival list"
          value={String(arriving)}
          tone="ok"
        />
      </div>
      <AgentSection
        title="All guests"
        description="Linked to your bookings at this hotel"
      >
        <AgentGuestsTable rows={dash.guests} />
      </AgentSection>
    </div>
  );
}
