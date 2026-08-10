import { AgentsAccordionTable } from "@/components/erp/AgentsAccordionTable";
import { AgentPinProvisionForm } from "@/components/erp/AgentAuthForms";
import { DeskEmptyState } from "@/components/erp/DeskEmptyState";
import { DeskListShell, DeskSearchForm } from "@/components/erp/DeskListShell";
import { DeskMetricRow } from "@/components/erp/DeskMetricRow";
import { DeskViewSwitcher } from "@/components/erp/DeskViewSwitcher";
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
  open_room_cap: number | null;
  wants_mou: boolean | null;
  approved_at: string | null;
  created_at: string;
  portal_token: string | null;
};

type ViewFilter = "trade" | "directory" | "pending" | "all";

function parseFilter(raw: string | string[] | undefined): ViewFilter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "directory" || v === "pending" || v === "all" || v === "trade") {
    return v;
  }
  return "trade";
}

export default async function ErpAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; id?: string; q?: string }>;
}) {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const sp = await searchParams;
  const view = parseFilter(sp.view);
  const searchQuery = (sp.q ?? "").trim().toLowerCase();

  const admin = createSupabaseAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();

  const propertyId = property?.id as string | undefined;

  // Scoped loads so directory bulk does not crowd out trade partners.
  let agentsQ = admin
    .from("agents")
    .select(
      "id, company_name, market, contact_name, contact_phone, contact_email, license_url, notes, status, rate_tier, credit_limit, credit_used, open_room_cap, wants_mou, approved_at, created_at, portal_token",
    );

  if (view === "directory") {
    agentsQ = agentsQ
      .eq("status", "directory")
      .order("company_name", { ascending: true })
      .limit(1200);
  } else if (view === "pending") {
    agentsQ = agentsQ
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(200);
  } else if (view === "all") {
    agentsQ = agentsQ
      .order("company_name", { ascending: true })
      .limit(1200);
  } else {
    agentsQ = agentsQ
      .in("status", ["pending", "approved", "demo", "rejected"])
      .order("created_at", { ascending: false })
      .limit(200);
  }

  const pinAgentsQ = admin
    .from("agents")
    .select("id, company_name, market, status")
    .in("status", ["approved", "demo"])
    .order("company_name")
    .limit(200);

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

  const countsQ = Promise.all([
    admin
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("status", "directory"),
    admin
      .from("agents")
      .select("id", { count: "exact", head: true })
      .in("status", ["approved", "demo"]),
  ]);

  const [agentsRes, ledgerRes, countRes, pinAgentsRes] = await Promise.all([
    agentsQ,
    ledgerQ,
    countsQ,
    pinAgentsQ,
  ]);

  if (agentsRes.error) {
    console.error("erp/agents agents query failed", agentsRes.error);
  }

  const pendingCount = countRes[0].count ?? 0;
  const directoryCount = countRes[1].count ?? 0;
  const tradeCount = countRes[2].count ?? 0;

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
    open_room_cap: Number(row.open_room_cap ?? 15),
    wants_mou: Boolean(row.wants_mou),
    approved_at: row.approved_at ?? null,
    created_at: row.created_at,
    portal_token: row.portal_token ?? null,
  }));

  const visibleAgents = searchQuery
    ? agents.filter((a) => {
        const hay = [
          a.company_name,
          a.market,
          a.contact_name,
          a.contact_phone,
          a.contact_email,
          a.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(searchQuery);
      })
    : agents;

  const agentIds = visibleAgents.map((a) => a.id);
  let docRows: AgentDocRaw[] = [];
  if (agentIds.length && view !== "directory") {
    // Directory bulk view skips document hydrate for performance.
    const docsRes = await admin
      .from("agent_documents")
      .select(
        "id, kind, doc_url, doc_name, notes, uploaded_by, created_at, agent_id",
      )
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

  const totalApprovedCredit = visibleAgents
    .filter((a) => a.status === "approved" || a.status === "demo")
    .reduce((sum, a) => sum + a.credit_limit, 0);
  const totalUsedCredit = visibleAgents
    .filter((a) => a.status === "approved" || a.status === "demo")
    .reduce((sum, a) => sum + a.credit_used, 0);

  const filterTabs: { key: ViewFilter; label: string; count?: number }[] = [
    { key: "trade", label: "Trade partners", count: tradeCount + pendingCount },
    { key: "pending", label: "Pending", count: pendingCount },
    { key: "directory", label: "TCB directory", count: directoryCount },
    { key: "all", label: "All" },
  ];

  const emptyByView: Record<ViewFilter, string> = {
    trade: "No trade partners or applications yet.",
    pending: "No pending applications.",
    directory: "No TCB directory operators yet.",
    all: "No agents yet.",
  };

  return (
    <DeskListShell
      eyebrow="Channels"
      heading="Agents"
      subtitle="Trade partners, credit, and TCB directory"
      blurb="Approve applications, set MoU/demo status, credit limits, and record credit payments. Markets: Bhutan, Jaigaon, India. TCB directory operators are searchable on bookings but are not credit partners until you Approve."
      filters={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <DeskSearchForm
            action={
              view === "trade"
                ? "/erp/agents"
                : `/erp/agents?view=${view}`
            }
            q={sp.q}
            placeholder="Company, contact, phone, email…"
          />
          <DeskViewSwitcher
            label="Agent list filters"
            items={filterTabs.map((tab) => ({
              href:
                tab.key === "trade"
                  ? "/erp/agents"
                  : `/erp/agents?view=${tab.key}`,
              label: tab.label,
              count: tab.count,
              active: view === tab.key,
            }))}
          />
        </div>
      }
      metrics={
        <DeskMetricRow
          metrics={[
            {
              label: "Pending applications",
              value: String(pendingCount),
              href: "/erp/agents?view=pending",
            },
            {
              label: "Approved credit",
              value: formatBtn(totalApprovedCredit),
            },
            {
              label: "Outstanding used",
              value: formatBtn(totalUsedCredit),
              tone: "destructive",
            },
            {
              label: "Confirmed call list",
              value: "→",
              href: "/erp/agents/confirmed",
              hint: "Phone & email for agents with rooms",
            },
            {
              label: "Call tasks",
              value: "→",
              href: "/erp/agents/call-tasks",
              hint: "FO call-down lists with tick-off",
            },
          ]}
        />
      }
    >
      {visibleAgents.length === 0 ? (
        <DeskEmptyState
          title={searchQuery ? "No agents match your search." : emptyByView[view]}
          description={
            view === "directory"
              ? "Import TCB tour operators after migrating status=directory."
              : "Applications and approved partners will appear here."
          }
        />
      ) : (
        <Suspense
          fallback={
            <p className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
              Loading agents…
            </p>
          }
        >
          <AgentsAccordionTable
            filter={view}
            data={visibleAgents.map((row) => ({
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
            emptyMessage={emptyByView[view]}
          />
        </Suspense>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Agent app login</CardTitle>
          <CardDescription>
            Issue an agent code + PIN so an approved partner can sign into the
            installable Work app at{" "}
            <code className="font-mono text-xs">/agents/app</code> to book on
            their rate and see their own bookings. PINs are stored only in
            Supabase Auth. Directory listings are not eligible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AgentPinProvisionForm
            agents={(pinAgentsRes.data ?? []).map((a) => ({
              id: a.id as string,
              label: `${a.company_name as string} · ${a.market as string}`,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent rates</CardTitle>
          <CardDescription>
            Per-agent <code className="font-mono text-xs">rate_tier</code>{" "}
            (agents, mou_agents, etc.) selects which column group applies at
            booking. Base Nu amounts live on the Room rates sheet — not here.
            Directory operators use public rates until approved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/erp/rates"
            className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Open room rates sheet →
          </Link>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <header className="space-y-0.5">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
            Credit ledger
          </p>
          <p className="text-sm text-muted-foreground">
            Recent charges and payments.
          </p>
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
    </DeskListShell>
  );
}
