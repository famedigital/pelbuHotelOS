import {
  AgentGhostLink,
  AgentMetric,
  AgentPageHero,
  AgentPrimaryLink,
  AgentSection,
} from "@/components/erp/agent-portal/AgentPortalChrome";
import { AgentStaysTable } from "@/components/erp/agent-portal/AgentStaysTable";
import { requireAgentPropertySession } from "@/lib/agent-auth";
import { loadAgentStayRows } from "@/lib/agent-portal-stays";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Stays · Partner",
  robots: { index: false, follow: false },
};

export default async function AgentStaysPage() {
  const session = await requireAgentPropertySession();
  const admin = createSupabaseAdminClient();

  let rows: Awaited<ReturnType<typeof loadAgentStayRows>> = [];
  try {
    rows = await loadAgentStayRows(admin, {
      agentId: session.agentId,
      propertyId: session.activePropertyId,
      sessionAgentId: session.agentId,
      limit: 150,
    });
  } catch (e) {
    console.error("agent stays page", e);
  }

  const openDue = rows.reduce(
    (s, r) => s + (Math.abs(r.dueBtn) > 0.5 ? r.dueBtn : 0),
    0,
  );
  const held = rows.filter((r) => r.status === "held").length;
  const quoted = rows.reduce((s, r) => s + (r.quotedBtn ?? 0), 0);

  return (
    <div className="space-y-6">
      <AgentPageHero
        eyebrow="Partner workspace"
        title="Your stays"
        blurb="Full table — amounts, invoices, print vouchers, and payment screenshots for the desk."
        actions={
          <>
            <AgentPrimaryLink href="/agents/app/book">
              Hold rooms
            </AgentPrimaryLink>
            <AgentGhostLink href="/agents/app/money">Money</AgentGhostLink>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AgentMetric label="Stays" value={String(rows.length)} tone="accent" />
        <AgentMetric label="Open holds" value={String(held)} tone="warn" />
        <AgentMetric label="Quoted" value={formatBtn(quoted)} />
        <AgentMetric
          label="Open due"
          value={formatBtn(openDue)}
          tone={Math.abs(openDue) > 0.5 ? "warn" : "ok"}
        />
      </div>

      <AgentSection
        title="All bookings"
        description="Search, sort, open detail · print · upload proof"
      >
        <AgentStaysTable rows={rows} />
      </AgentSection>
    </div>
  );
}
