import { PartyStatementSheet } from "@/components/erp/finance/PartyStatementSheet";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadAgentStatement } from "@/lib/finance/party-statement";
import { thimphuToday } from "@/lib/erp-lists";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AgentStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; from?: string; to?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const property = await loadProperty(admin, propertyId);
  const today = thimphuToday();
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : `${today.slice(0, 7)}-01`;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : today;
  const { data: agents } = await admin
    .from("agents")
    .select("id, company_name")
    .order("company_name")
    .limit(300);
  const agentId = sp.agent || (agents?.[0]?.id as string | undefined) || "";
  const statement = agentId
    ? await loadAgentStatement(admin, propertyId, agentId, from, to)
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form className="flex flex-wrap items-center gap-2 border-b px-3 py-1.5" action="/erp/finance/agent-statement">
        <h1 className="text-sm font-semibold">Agent statement</h1>
        <select name="agent" defaultValue={agentId} aria-label="Agent" className="h-8 max-w-xs rounded-md border px-2 text-sm">
          {(agents ?? []).map((agent) => (
            <option key={agent.id as string} value={agent.id as string}>
              {agent.company_name as string}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={from} aria-label="From" className="h-8 rounded-md border px-2 text-sm" />
        <input type="date" name="to" defaultValue={to} aria-label="To" className="h-8 rounded-md border px-2 text-sm" />
        <button type="submit" className="h-8 rounded-md border px-2 text-sm">Show</button>
        {agentId ? (
          <a className="text-sm text-sky-800" href={`/erp/finance/agent-statement/print?agent=${agentId}&from=${from}&to=${to}`}>
            Print
          </a>
        ) : null}
      </form>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {statement ? (
          <PartyStatementSheet hotel={property?.name ?? "Hotel"} statement={statement} />
        ) : (
          <p className="text-sm text-muted-foreground">No agent selected.</p>
        )}
      </div>
    </div>
  );
}
