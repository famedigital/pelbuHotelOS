import { AgentBookForm } from "@/components/erp/AgentBookForm";
import {
  AgentPageHero,
  AgentSection,
} from "@/components/erp/agent-portal/AgentPortalChrome";
import { requireAgentPropertySession } from "@/lib/agent-auth";
import { resolveHoldTtlHours } from "@/lib/holds";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { thimphuToday } from "@/lib/erp-lists";

export const dynamic = "force-dynamic";

export default async function AgentBookPage() {
  const session = await requireAgentPropertySession();
  const admin = createSupabaseAdminClient();
  const { hours, seasonKind } = await resolveHoldTtlHours(
    admin,
    session.activePropertyId,
    "agent",
    thimphuToday(),
  );

  return (
    <div className="space-y-6">
      <AgentPageHero
        eyebrow="Free-sell"
        title="Hold rooms on your rate"
        blurb={`Live availability + partner rates. Rooms stay held for ${hours}h (${seasonKind} season) until the desk confirms against your credit.`}
      />
      <AgentSection title="New hold" description="Flight-style timer starts on submit">
        <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6">
          <AgentBookForm />
        </div>
      </AgentSection>
    </div>
  );
}
