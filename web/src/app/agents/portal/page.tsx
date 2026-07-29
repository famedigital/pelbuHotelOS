import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { formatBtn } from "@/lib/pricing";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent portal | Pelbu Suites",
  description: "Your approved partner account — status, rate tier, credit ledger.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type LedgerRow = {
  id: string;
  entry_type: string;
  amount_btn: number;
  balance_after_btn: number;
  note: string | null;
  created_at: string;
};

type AgentRow = {
  id: string;
  company_name: string;
  market: string;
  contact_name: string | null;
  contact_phone: string | null;
  status: string;
  rate_tier: string;
  credit_limit: number;
  credit_used: number;
  wants_mou: boolean;
  approved_at: string | null;
  portal_token: string | null;
};

function notFound() {
  return (
    <div className="min-h-screen bg-ivory">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-20 md:px-8">
        <p className="text-xs uppercase tracking-[0.22em] text-gold">
          Agent portal
        </p>
        <h1 className="mt-3 text-3xl text-espresso">No partner account found</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This link is missing or has expired. If you have already been approved,
          ask the Pelbu desk to re-issue your portal token.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/agents"
            className="inline-flex min-h-11 items-center rounded-sm bg-espresso px-5 text-sm font-medium text-ivory"
          >
            Apply / agent info
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center rounded-sm border border-espresso/25 px-5 text-sm text-espresso"
          >
            Contact desk
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default async function AgentPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = (params.token ?? "").trim();
  if (!token || token.length < 16) return notFound();

  const admin = createSupabaseAdminClient();

  const { data: property } = await admin
    .from("properties")
    .select("id, name")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  if (!property) return notFound();

  const { data: agentRow } = await admin
    .from("agents")
    .select(
      "id, company_name, market, contact_name, contact_phone, status, rate_tier, credit_limit, credit_used, wants_mou, approved_at, portal_token",
    )
    .eq("portal_token", token)
    .maybeSingle();

  if (!agentRow) return notFound();

  const agent = {
    ...(agentRow as Omit<AgentRow, "portal_token">),
    portal_token: token,
  } as AgentRow;

  // Only approved / demo agents can use the portal.
  if (agent.status !== "approved" && agent.status !== "demo") {
    return (
      <div className="min-h-screen bg-ivory">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-6 py-20 md:px-8">
          <p className="text-xs uppercase tracking-[0.22em] text-gold">
            Agent portal
          </p>
          <h1 className="mt-3 text-3xl text-espresso">
            Account under review
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Your application status is{" "}
            <strong className="text-espresso">{agent.status}</strong>. The Pelbu
            desk will be in touch once it is approved.
          </p>
          <div className="mt-6">
            <Link
              href="/agents"
              className="inline-flex min-h-11 items-center rounded-sm border border-espresso/25 px-5 text-sm text-espresso"
            >
              Back to agent info
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const { data: ledgerRows } = await admin
    .from("agent_credit_ledger")
    .select(
      "id, entry_type, amount_btn, balance_after_btn, note, created_at",
    )
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false })
    .limit(60);

  const ledger = (ledgerRows ?? []) as unknown as LedgerRow[];

  const { data: rateRows } = await admin
    .from("room_rates")
    .select(
      "season_kind, rate_tier, amount_btn, room_types(name), rate_tier",
    )
    .eq("property_id", property.id as string)
    .in("rate_tier", [agent.rate_tier, "public"])
    .order("season_kind")
    .order("rate_tier");

  type RateRow = {
    season_kind: string;
    rate_tier: string;
    amount_btn: number;
    room_types?:
      | { name: string }
      | { name: string }[]
      | null;
  };
  const rates = (rateRows ?? []) as unknown as RateRow[];

  const available = Math.max(0, agent.credit_limit - agent.credit_used);

  return (
    <div className="min-h-screen bg-ivory">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-6 py-12 md:px-8 md:py-16">
        <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-espresso/15 pb-4 print:hidden">
          <div>
            <p className="text-xs tracking-[0.22em] text-gold uppercase">
              Partner portal
            </p>
            <h1 className="mt-1 text-3xl text-espresso">{agent.company_name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {(agent as AgentRow).market} Â· status {agent.status} Â· tier{" "}
              {agent.rate_tier.replace(/_/g, " ")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-11 items-center rounded-sm border border-espresso/25 px-5 text-sm text-espresso print:hidden"
          >
            Print statement
          </button>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-6">
          <SummaryCard label="Credit limit" value={formatBtn(agent.credit_limit)} />
          <SummaryCard label="Available" value={formatBtn(available)} tone="gold" />
          <SummaryCard label="Used" value={formatBtn(agent.credit_used)} tone="maroon" />
        </section>

        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
            Your {agent.rate_tier.replace(/_/g, " ")} rate sheet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Per-night Nu rates that apply to your bookings, by season. Public
            rates are shown for comparison.
          </p>
          <div className="mt-4 overflow-x-auto border border-espresso/10 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-espresso/10 text-xs uppercase tracking-wide text-espresso/55">
                <tr>
                  <th className="px-4 py-3 font-medium">Room</th>
                  <th className="px-4 py-3 font-medium">Season</th>
                  <th className="px-4 py-3 font-medium">Tier</th>
                  <th className="px-4 py-3 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {rates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-5 text-espresso/60">
                      Rates not published yet. Ask the desk.
                    </td>
                  </tr>
                ) : (
                  rates.map((r, i) => {
                    const rt = r.room_types;
                    const room = Array.isArray(rt) ? rt[0] : rt;
                    const mine = r.rate_tier === agent.rate_tier;
                    return (
                      <tr
                        key={`${r.season_kind}-${r.rate_tier}-${i}`}
                        className={`border-b border-espresso/5 ${mine ? "" : "opacity-70"}`}
                      >
                        <td className="px-4 py-2.5 text-espresso">
                          {room?.name ?? "—"}{" "}
                          {!mine ? (
                            <span className="ml-1 text-[10px] uppercase tracking-wide text-espresso/45">
                              public
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 capitalize text-espresso/80">
                          {r.season_kind}
                        </td>
                        <td className="px-4 py-2.5 text-espresso/80">
                          {r.rate_tier.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-2.5 text-espresso">
                          {formatBtn(Number(r.amount_btn))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
              Credit statement
            </h2>
            <p className="text-xs text-muted-foreground">
              {ledger.length} most recent entries Â· generated{" "}
              {new Date().toLocaleString("en-BT", { timeZone: "Asia/Thimphu" })}
            </p>
          </div>
          {ledger.length === 0 ? (
            <p className="mt-3 border border-espresso/10 bg-white px-4 py-5 text-sm text-espresso/70">
              No credit activity yet. Charges and payments will appear here.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto border border-espresso/10 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-espresso/10 text-xs uppercase tracking-wide text-espresso/55">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Note</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((row) => {
                    const sign = row.entry_type === "payment" ? -1 : 1;
                    const amount = sign * Number(row.amount_btn);
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-espresso/5 last:border-0"
                      >
                        <td className="whitespace-nowrap px-4 py-2.5 text-espresso/80">
                          {new Date(row.created_at).toLocaleDateString("en-BT", {
                            timeZone: "Asia/Thimphu",
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-2.5 capitalize text-espresso/80">
                          {row.entry_type.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-2.5 text-espresso/70">
                          {row.note ?? "—"}
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-2.5 text-right tabular-nums ${
                            amount < 0 ? "text-espresso" : "text-maroon"
                          }`}
                        >
                          {formatBtn(amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-espresso">
                          {formatBtn(Number(row.balance_after_btn))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-12 border-t border-espresso/10 pt-6 text-sm text-muted-foreground">
          <p>
            Question about a charge or rate? Call the desk — your contact is{" "}
            <span className="text-espresso">{agent.contact_name ?? "—"}</span>{" "}
            ({agent.contact_phone ?? "—"}).
          </p>
        </section>
      </main>
      <SiteFooter />
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
  tone?: "espresso" | "gold" | "maroon";
}) {
  const color =
    tone === "gold"
      ? "text-gold"
      : tone === "maroon"
        ? "text-maroon"
        : "text-espresso";
  return (
    <div className="border border-espresso/10 bg-white px-5 py-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-espresso/55">
        {label}
      </p>
      <p className={`mt-1.5 text-2xl ${color}`}>{value}</p>
    </div>
  );
}
