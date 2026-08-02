import { AgentsAccordionTable } from "@/components/erp/AgentsAccordionTable";
import { AgentPinProvisionForm } from "@/components/erp/AgentAuthForms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Agents | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AgentDocRaw = {
  id: string;
  kind: string;
  doc_url: string;
  doc_name: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  agent_id: string;
};

type AgentRaw = {
  id: string;
  company_name: string;
  market: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  license_url: string | null;
  notes: string | null;
  status: string;
  rate_tier: string | null;
  credit_limit: number | null;
  credit_used: number | null;
  wants_mou: boolean | null;
  approved_at: string | null;
  created_at: string;
  portal_token: string | null;
};

export default async function ErpAgentsPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const admin = createSupabaseAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();

  const propertyId = property?.id as string | undefined;

  const agentsQ = admin
    .from("agents")
    .select(
      "id, company_name, market, contact_name, contact_phone, contact_email, license_url, notes, status, rate_tier, credit_limit, credit_used, wants_mou, approved_at, created_at, portal_token",
    )
    .order("created_at", { ascending: false })
    .limit(80);

  const ledgerQ = propertyId
    ? admin
        .from("agent_credit_ledger")
        .select(
          "id, entry_type, amount_btn, balance_after_btn, note, created_at, agents(company_name)",
        )
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(30)
    : Promise.resolve({ data: [] as Record<string, unknown>[], error: null });

  const [agentsRes, ledgerRes] = await Promise.all([agentsQ, ledgerQ]);

  if (agentsRes.error) {
    console.error("erp/agents agents query failed", agentsRes.error);
  }

  const agentRows = (agentsRes.data ?? []) as unknown as AgentRaw[];
  const ledger = ledgerRes.data ?? [];

  const agents = agentRows.map((row) => ({
    id: row.id,
    company_name: row.company_name,
    market: row.market,
    contact_name: row.contact_name ?? null,
    contact_phone: row.contact_phone ?? null,
    contact_email: row.contact_email ?? null,
    license_url: row.license_url ?? null,
    notes: row.notes ?? null,
    status: row.status,
    rate_tier: row.rate_tier ?? "agents",
    credit_limit: Number(row.credit_limit ?? 0),
    credit_used: Number(row.credit_used ?? 0),
    wants_mou: Boolean(row.wants_mou),
    approved_at: row.approved_at ?? null,
    created_at: row.created_at,
    portal_token: row.portal_token ?? null,
  }));

  const agentIds = agents.map((a) => a.id);
  let docRows: AgentDocRaw[] = [];
  if (agentIds.length) {
    const docsRes = await admin
      .from("agent_documents")
      .select("id, kind, doc_url, doc_name, notes, uploaded_by, created_at, agent_id")
      .in("agent_id", agentIds)
      .order("created_at", { ascending: false });
    if (docsRes.error) {
      console.error("erp/agents documents query failed", docsRes.error);
    } else {
      docRows = (docsRes.data ?? []) as AgentDocRaw[];
    }
  }

  const docsByAgent = new Map<string, AgentDocRaw[]>();
  for (const doc of docRows) {
    const arr = docsByAgent.get(doc.agent_id) ?? [];
    arr.push(doc);
    docsByAgent.set(doc.agent_id, arr);
  }

  const pendingCount = agents.filter((a) => a.status === "pending").length;
  const totalApprovedCredit = agents
    .filter((a) => a.status === "approved" || a.status === "demo")
    .reduce((sum, a) => sum + a.credit_limit, 0);
  const totalUsedCredit = agents
    .filter((a) => a.status === "approved" || a.status === "demo")
    .reduce((sum, a) => sum + a.credit_used, 0);

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-10 p-4 md:p-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Pending applications" value={String(pendingCount)} />
        <SummaryCard
          label="Approved credit"
          value={formatBtn(totalApprovedCredit)}
        />
        <SummaryCard
          label="Outstanding used"
          value={formatBtn(totalUsedCredit)}
          tone="destructive"
        />
      </section>

      <section className="space-y-4">
        <header className="space-y-1.5">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Trade partners
          </p>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Approve applications, set MoU/demo status, credit limits, and record
            credit payments. Markets: Bhutan, Jaigaon, India.
          </p>
        </header>

        {agents.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No agent applications yet.
            </CardContent>
          </Card>
        ) : (
          <Suspense
            fallback={
              <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                Loading agents…
              </p>
            }
          >
            <AgentsAccordionTable
              data={agents.map((row) => ({
                ...row,
                documents: (docsByAgent.get(row.id) ?? []).map((d) => ({
                  id: d.id,
                  agent_id: d.agent_id,
                  kind: d.kind,
                  doc_url: d.doc_url,
                  doc_name: d.doc_name,
                  notes: d.notes,
                  uploaded_by: d.uploaded_by,
                  created_at: d.created_at,
                })),
              }))}
              emptyMessage="No agent applications yet."
            />
          </Suspense>
        )}
      </section>

      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Agent app login</CardTitle>
            <CardDescription>
              Issue an agent code + PIN so an approved partner can sign into the
              installable Work app at{" "}
              <code className="font-mono text-xs">/agents/app</code> to book on
              their rate and see their own bookings. PINs are stored only in
              Supabase Auth.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AgentPinProvisionForm
              agents={agents
                .filter((a) => a.status === "approved" || a.status === "demo")
                .map((a) => ({
                  id: a.id,
                  label: `${a.company_name} · ${a.market}`,
                }))}
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Agent rates</CardTitle>
            <CardDescription>
              Per-agent <code className="font-mono text-xs">rate_tier</code>{" "}
              (agents, mou_agents, etc.) selects which column group applies at
              booking. Base Nu amounts live on the Room rates sheet — not here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/erp/rates"
              className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              Open room rates sheet →
            </Link>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <header className="space-y-1.5">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Credit ledger
          </p>
          <p className="text-sm text-muted-foreground">Recent charges and payments.</p>
        </header>
        <Card>
          <CardHeader className="sr-only">
            <CardTitle>Credit ledger</CardTitle>
            <CardDescription>Recent agent credit movements</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {(ledger ?? []).length === 0 ? (
                <li className="px-4 py-5 text-sm text-muted-foreground">
                  No ledger entries yet.
                </li>
              ) : (
                (ledger ?? []).map((row) => {
                  const agent = row.agents as
                    | { company_name: string }
                    | { company_name: string }[]
                    | null;
                  const company = Array.isArray(agent)
                    ? agent[0]?.company_name
                    : agent?.company_name;
                  return (
                    <li
                      key={row.id as string}
                      className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm"
                    >
                      <div>
                        <span className="font-medium text-foreground">
                          {company ?? "Agent"}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          {row.entry_type as string}
                        </span>
                        {row.note ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {row.note as string}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="text-foreground">
                          {formatBtn(Number(row.amount_btn))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          bal {formatBtn(Number(row.balance_after_btn))}
                        </p>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "destructive";
}) {
  return (
    <Card className="gap-2 py-5">
      <CardContent>
        <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          {label}
        </p>
        <p
          className={`mt-1.5 text-2xl font-semibold tracking-tight ${
            tone === "destructive" ? "text-destructive" : "text-foreground"
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
