import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listPropertyAgents, loadAgentDossier } from "@/lib/erp-agent-dossier";
import { UniversalAgentDossierView } from "@/components/erp/agents/UniversalAgentDossierView";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Universal Agent Dossier | Hotel OS Bhutan",
  description: "Unified B2B Agent Ledger, Credit Limits, Bookings, and Instant Folio Statements",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpAgentDossierPage({
  searchParams,
}: {
  searchParams: Promise<{
    agentId?: string;
  }>;
}) {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  let propertyId: string | undefined;

  try {
    propertyId = await resolveActivePropertyId(admin);
  } catch {
    propertyId = undefined;
  }

  if (!propertyId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Active property could not be resolved. Please verify property configuration.
      </div>
    );
  }

  // 1. Fetch available agents list
  const agents = await listPropertyAgents(propertyId);

  // 2. Resolve selected agent ID
  const selectedAgentId = sp.agentId || agents[0]?.id;

  // 3. Load full dossier if an agent is selected
  const dossier = selectedAgentId
    ? await loadAgentDossier(propertyId, selectedAgentId)
    : null;

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <UniversalAgentDossierView
        agents={agents}
        selectedAgentId={selectedAgentId}
        initialDossier={dossier}
      />
    </div>
  );
}
