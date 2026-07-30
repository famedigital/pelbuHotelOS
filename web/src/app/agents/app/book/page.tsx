import { AgentBookForm } from "@/components/erp/AgentBookForm";
import { requireAgentSession } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

export default async function AgentBookPage() {
  await requireAgentSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Book on your rate</h1>
        <p className="text-sm text-muted-foreground">
          Live availability and your partner rates. Rooms are held for the desk
          to confirm against your credit.
        </p>
      </div>
      <AgentBookForm />
    </div>
  );
}
