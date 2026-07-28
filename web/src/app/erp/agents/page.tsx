import { AgentDeskCard } from "@/components/erp/AgentDeskCard";
import { DeskHeader } from "@/components/erp/DeskHeader";
import { RateMatrixEditor } from "@/components/erp/RateMatrixEditor";
import { deskPinConfigured, isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Agents & rates | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type RoomRateRaw = {
  id: string;
  season_kind: string;
  rate_tier: string;
  amount_btn: number;
  room_type_id?: string;
  room_types?:
    | { id: string; code: string; name: string; inventory_kind: string }
    | { id: string; code: string; name: string; inventory_kind: string }[]
    | null;
};

type RoomTypeLiteRaw = {
  id: string;
  code: string;
  name: string;
  inventory_kind: string;
};

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

  const ratesQ = propertyId
    ? admin
        .from("room_rates")
        .select(
          "id, season_kind, rate_tier, amount_btn, room_type_id, room_types(id, code, name, inventory_kind)",
        )
        .eq("property_id", propertyId)
        .order("season_kind")
        .order("rate_tier")
        .limit(200)
    : Promise.resolve({ data: [] as RoomRateRaw[], error: null });

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

  const roomTypesQ = propertyId
    ? admin
        .from("room_types")
        .select("id, code, name, inventory_kind")
        .eq("property_id", propertyId)
        .order("name")
    : Promise.resolve({ data: [] as RoomTypeLiteRaw[], error: null });

  const [agentsRes, ratesRes, ledgerRes, roomTypesRes] = await Promise.all([
    agentsQ,
    ratesQ,
    ledgerQ,
    roomTypesQ,
  ]);

  if (agentsRes.error) {
    console.error("erp/agents agents query failed", agentsRes.error);
  }

  const agentRows = (agentsRes.data ?? []) as unknown as AgentRaw[];
  const rateRows = (ratesRes.data ?? []) as unknown as RoomRateRaw[];
  const ledger = ledgerRes.data ?? [];
  const roomTypesRaw = (roomTypesRes.data ?? []) as unknown as RoomTypeLiteRaw[];

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

  // Documents for the visible agents (one query, group client-side)
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

  const rates = rateRows;
  const rateMatrixRows = rates.map((r) => {
    const rt = r.room_types;
    const room = Array.isArray(rt) ? rt[0] : rt;
    return {
      id: r.id,
      room_type_id: (r.room_type_id ?? room?.id) as string,
      room_type_name: room?.name ?? "—",
      season_kind: r.season_kind,
      rate_tier: r.rate_tier,
      amount_btn: Number(r.amount_btn ?? 0),
    };
  });

  const roomTypeLites: RoomTypeLiteRaw[] = roomTypesRaw.map((rt) => ({
    id: rt.id,
    code: rt.code,
    name: rt.name,
    inventory_kind: rt.inventory_kind,
  }));

  const pendingCount = agents.filter((a) => a.status === "pending").length;
  const totalApprovedCredit = agents
    .filter((a) => a.status === "approved" || a.status === "demo")
    .reduce((sum, a) => sum + a.credit_limit, 0);
  const totalUsedCredit = agents
    .filter((a) => a.status === "approved" || a.status === "demo")
    .reduce((sum, a) => sum + a.credit_used, 0);

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader title="Agents & rates" />
      <main className="mx-auto max-w-[1200px] px-6 py-10 md:px-8">
        {!deskPinConfigured() ? (
          <p className="mb-8 border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-espresso">
            Dev mode: desk PIN not set. Add <code className="font-mono">DESK_PIN</code>{" "}
            before production.
          </p>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Pending applications" value={String(pendingCount)} />
          <SummaryCard
            label="Approved credit"
            value={formatBtn(totalApprovedCredit)}
          />
          <SummaryCard
            label="Outstanding used"
            value={formatBtn(totalUsedCredit)}
            tone="maroon"
          />
        </section>

        <section className="mt-12 space-y-4">
          <header>
            <h2 className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
              Trade partners
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-espresso/70">
              Approve applications, set MoU/demo status, credit limits, and record
              credit payments. Markets: Bhutan, Jaigaon, India.
            </p>
          </header>

          {agents.length === 0 ? (
            <p className="border border-espresso/10 bg-white px-5 py-6 text-sm text-espresso/70">
              No agent applications yet.
            </p>
          ) : (
            <div className="space-y-4">
              {agents.map((row) => (
                <AgentDeskCard
                  key={row.id}
                  agent={row}
                  documents={(docsByAgent.get(row.id) ?? []).map((d) => ({
                    id: d.id,
                    agent_id: d.agent_id,
                    kind: d.kind,
                    doc_url: d.doc_url,
                    doc_name: d.doc_name,
                    notes: d.notes,
                    uploaded_by: d.uploaded_by,
                    created_at: d.created_at,
                  }))}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-14">
          <header>
            <h2 className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
              Rate matrix
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-espresso/70">
              Edit per-night Nu rates by season × tier. Changes apply immediately to
              fast-book, check-in on-credit estimates, and the public agent portal.
            </p>
          </header>
          <RateMatrixEditor rows={rateMatrixRows} roomTypes={roomTypeLites} />
        </section>

        <section className="mt-14">
          <header>
            <h2 className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
              Credit ledger
            </h2>
            <p className="mt-2 text-sm text-espresso/70">Recent charges and payments.</p>
          </header>
          <ul className="mt-4 divide-y divide-espresso/8 border border-espresso/10 bg-white">
            {(ledger ?? []).length === 0 ? (
              <li className="px-4 py-5 text-sm text-espresso/60">No ledger entries yet.</li>
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
                      <span className="font-medium text-espresso">
                        {company ?? "Agent"}
                      </span>
                      <span className="ml-2 text-espresso/55">
                        {row.entry_type as string}
                      </span>
                      {row.note ? (
                        <span className="mt-0.5 block text-xs text-espresso/50">
                          {row.note as string}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-espresso">
                        {formatBtn(Number(row.amount_btn))}
                      </p>
                      <p className="text-xs text-espresso/50">
                        bal {formatBtn(Number(row.balance_after_btn))}
                      </p>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "espresso",
}: {
  label: string;
  value: string;
  tone?: "espresso" | "maroon";
}) {
  return (
    <div className="border border-espresso/10 bg-white px-5 py-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-espresso/55">
        {label}
      </p>
      <p
        className={`mt-1.5 text-2xl ${tone === "maroon" ? "text-maroon" : "text-espresso"}`}
      >
        {value}
      </p>
    </div>
  );
}
