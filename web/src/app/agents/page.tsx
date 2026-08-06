import { AgentApplyForm } from "@/components/agents/AgentApplyForm";
import { AgentRatePdfGate } from "@/components/agents/AgentRatePdfGate";
import { EngineShell } from "@/components/site/EngineShell";
import { Button } from "@/components/ui/button";
import { getAgentRatePdfDownloadTotal } from "@/app/actions/agent-rate-pdf";
import {
  breadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";

import { PAGE_SEO, buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  ...PAGE_SEO.agents,
  path: "/agents",
});

export default async function AgentsPage() {
  const propertyId = await resolvePublicPropertyId();
  const totalDownloads = propertyId
    ? await getAgentRatePdfDownloadTotal(propertyId)
    : 0;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Agents", path: "/agents" },
            ]),
          ),
        }}
      />
      <EngineShell
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Agents" },
        ]}
        eyebrow="Agents"
        title="Built for the Bhutan travel trade."
        description="Download the trade rate card after leaving your phone and email, or apply for a full partner account with a private booking workspace."
        actions={
          <>
            <Button asChild>
              <a href="#agent-rate-pdf-heading">Download rate card</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/agents/login">Agent sign in</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/book">Book direct</a>
            </Button>
          </>
        }
      >
        <AgentRatePdfGate initialTotalDownloads={totalDownloads} />
        <div className="mt-12 border-t border-border/60 pt-10">
          <div className="mb-6 max-w-lg space-y-2">
            <h2 className="font-display text-2xl text-foreground sm:text-3xl">
              Apply for a partner account
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We review your license, set the appropriate rate tier, and enable
              a private booking workspace with isolated availability.
            </p>
          </div>
          <AgentApplyForm />
        </div>
      </EngineShell>
    </>
  );
}
