import type { AdapterCtx } from "./types.js";

/**
 * Agents are global (`agents`); per-hotel terms live on `agent_property_links`
 * (status / rate_tier / credit_limit / credit_used). Never filter `agents` by
 * property_id — that column does not exist.
 */
type AgentRow = {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  login_code: string | null;
  market: string | null;
  status: string | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function listAgents(ctx: AdapterCtx) {
  const { data, error } = await ctx.admin
    .from("agent_property_links")
    .select(
      `id, status, rate_tier, credit_limit, credit_used, open_room_cap,
       agents(id, company_name, contact_name, contact_phone, contact_email, login_code, market, status)`,
    )
    .eq("property_id", ctx.jwt.propertyId);
  if (error) throw error;

  const agents = (data ?? [])
    .map((link) => {
      const a = one(link.agents as AgentRow | AgentRow[] | null);
      if (!a) return null;
      const limit = Number(link.credit_limit ?? 0);
      const used = Number(link.credit_used ?? 0);
      return {
        id: a.id,
        linkId: link.id as string,
        companyName: a.company_name,
        contactName: a.contact_name,
        phone: a.contact_phone,
        email: a.contact_email,
        agentCode: a.login_code,
        market: a.market,
        rateTier: link.rate_tier as string,
        linkStatus: link.status as string,
        isActive: link.status === "approved" && a.status !== "rejected",
        creditLimitBtn: limit,
        /** Outstanding credit used at this hotel (what the agent owes). */
        balanceBtn: used,
        creditAvailableBtn: Math.max(0, limit - used),
        openRoomCap: link.open_room_cap as number | null,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null)
    .sort((x, y) => String(x.companyName).localeCompare(String(y.companyName)));

  return { agents };
}

export async function getAgentDossier(ctx: AdapterCtx, agentId: string) {
  const { data: link, error: linkErr } = await ctx.admin
    .from("agent_property_links")
    .select(
      "id, status, rate_tier, credit_limit, credit_used, open_room_cap, notes",
    )
    .eq("property_id", ctx.jwt.propertyId)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (linkErr) throw linkErr;
  if (!link) throw new Error("Agent is not linked to this property");

  const [{ data: agent, error: aErr }, { data: bookings, error: bErr }, { data: ledger, error: lErr }] =
    await Promise.all([
      ctx.admin
        .from("agents")
        .select(
          "id, company_name, contact_name, contact_phone, contact_email, market, status, login_code, commission_pct, dzongkhag, notes",
        )
        .eq("id", agentId)
        .maybeSingle(),
      ctx.admin
        .from("bookings")
        .select(
          "id, confirmation_code, contact_name, status, check_in, check_out, quoted_total_btn",
        )
        .eq("agent_id", agentId)
        .eq("property_id", ctx.jwt.propertyId)
        .order("check_in", { ascending: false })
        .limit(50),
      ctx.admin
        .from("agent_credit_ledger")
        .select(
          "id, entry_type, amount_btn, balance_after_btn, note, booking_id, payment_id, created_at",
        )
        .eq("agent_id", agentId)
        .eq("property_id", ctx.jwt.propertyId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
  if (aErr) throw aErr;
  if (bErr) throw bErr;
  if (lErr) throw lErr;

  return {
    agent,
    link,
    bookings: bookings ?? [],
    creditLedger: ledger ?? [],
  };
}
