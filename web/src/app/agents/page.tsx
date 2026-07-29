import { AgentApplyForm } from "@/components/agents/AgentApplyForm";
import { ConversionShell } from "@/components/site/ConversionShell";

export const metadata = {
  title: "Travel Agent Partners | Pelbu Suites",
  description:
    "Apply as a Bhutan, Jaigaon, or India travel trade partner — agent rates, MoU credit, and complimentary guide and driver beds.",
};

export default function AgentsPage() {
  return (
    <ConversionShell
      eyebrow="Agents"
      title="Built for the Bhutan travel trade."
      body="Apply once. We review your license, set your rate tier, and open an account-based booking desk."
      aside={
        <div className="space-y-6">
          <div>
            <p className="font-medium text-ink">You get</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Agent and MoU rate tiers</li>
              <li>Complimentary guide / driver beds</li>
              <li>Credit ledger with settlements</li>
            </ul>
          </div>
          <p>
            Need a room today?{" "}
            <a href="/book" className="underline underline-offset-4">
              Book direct
            </a>
            . Already approved?{" "}
            <a href="/agents/portal" className="underline underline-offset-4">
              Agent portal
            </a>
            .
          </p>
        </div>
      }
    >
      <AgentApplyForm />
    </ConversionShell>
  );
}
