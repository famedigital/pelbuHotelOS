import { AgentApplyForm } from "@/components/agents/AgentApplyForm";
import { EngineShell } from "@/components/site/EngineShell";
import { Button } from "@/components/ui/button";
import {
  breadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";

export const metadata = {
  title: "Travel Agent Partners | Pelbu Suites",
  description:
    "Apply as a Bhutan, Jaigaon, or India travel trade partner — agent rates, MoU credit, and complimentary guide and driver beds.",
  alternates: { canonical: "/agents" },
};

export default function AgentsPage() {
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
        description="Apply once. We review your license, set the appropriate rate tier, and enable a private booking workspace with isolated availability."
        actions={
          <>
            <Button asChild>
              <a href="/agents/login">Agent sign in</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/book">Book direct</a>
            </Button>
          </>
        }
      >
        <AgentApplyForm />
      </EngineShell>
    </>
  );
}
