import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PlatformDashboardKpis = {
  hotels: number;
  distributors: number;
  newLeads: number;
  overdueAmc: number;
  royaltyDueBtn: number;
  openTickets: number;
  commissionMtdBtn: number;
  mouPending: number;
  mouActive: number;
  hermesActiveChats: number;
  hermesAvailable: boolean;
};

export type MouRegistryRow = {
  id: string;
  agentId: string;
  agentName: string;
  propertyId: string;
  propertyName: string;
  status: string;
  creditLimit: number;
  creditUsed: number;
  mouSignedAt: string | null;
  source: "agent_property_links" | "v2_agent_mou_links";
  notes: string | null;
};

export type CommissionLedgerRow = {
  id: string;
  propertyId: string;
  propertyName: string;
  bookingId: string | null;
  market: string;
  grossBtn: number;
  commissionRate: number;
  commissionBtn: number;
  currency: string;
  createdAt: string;
};

export type TenantLicenseRow = {
  propertyId: string;
  name: string;
  slug: string;
  packageCode: string | null;
  isDemo: boolean;
  goLiveAt: string | null;
  amcAmountBtn: number | null;
  tier: string;
  licenseStatus: string;
  mrrBtn: number;
  paidThrough: string | null;
  graceUntil: string | null;
};

export type HermesChatRow = {
  id: string;
  propertyId: string;
  propertyName: string;
  chatId: number;
  chatType: string;
  role: string;
  status: string;
  displayName: string | null;
  agentId: string | null;
  pairedAt: string | null;
  lastSeenAt: string | null;
};

export type HermesTopicRow = {
  id: string;
  propertyId: string;
  propertyName: string;
  chatId: number;
  threadId: number;
  kind: string;
};

export type HermesStaffLinkRow = {
  id: string;
  propertyId: string;
  propertyName: string;
  tgUserId: number;
  staffName: string;
  role: string;
  active: boolean;
  linkedAt: string;
};

function monthStartIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function loadPlatformDashboardKpis(): Promise<PlatformDashboardKpis> {
  const admin = createSupabaseAdminClient();
  const empty: PlatformDashboardKpis = {
    hotels: 0,
    distributors: 0,
    newLeads: 0,
    overdueAmc: 0,
    royaltyDueBtn: 0,
    openTickets: 0,
    commissionMtdBtn: 0,
    mouPending: 0,
    mouActive: 0,
    hermesActiveChats: 0,
    hermesAvailable: false,
  };

  try {
    const safeCount = async (
      label: string,
      run: () => PromiseLike<{ count: number | null; error: { message: string } | null }>,
    ): Promise<number> => {
      try {
        const { count, error } = await run();
        if (error) {
          console.error(`[platform.dashboard] ${label}`, error);
          return 0;
        }
        return count ?? 0;
      } catch (err) {
        console.error(`[platform.dashboard] ${label}`, err);
        return 0;
      }
    };

    const hotels = await safeCount("properties", () =>
      admin.from("properties").select("id", { count: "exact", head: true }).eq("is_demo", false),
    );
    const distributors = await safeCount("distributors", () =>
      admin.from("distributors").select("id", { count: "exact", head: true }),
    );
    const newLeads = await safeCount("sales_leads", () =>
      admin.from("sales_leads").select("id", { count: "exact", head: true }).eq("status", "new"),
    );
    const overdueAmc = await safeCount("amc_invoices", () =>
      admin.from("amc_invoices").select("id", { count: "exact", head: true }).eq("status", "overdue"),
    );
    const openTickets = await safeCount("support_tickets", () =>
      admin.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    );

    let royaltyDueBtn = 0;
    try {
      const { data } = await admin
        .from("royalty_invoices")
        .select("amount_btn")
        .in("status", ["sent", "overdue", "draft"]);
      royaltyDueBtn = (data ?? []).reduce(
        (sum, row) => sum + Number(row.amount_btn ?? 0),
        0,
      );
    } catch (err) {
      console.error("[platform.dashboard] royalty", err);
    }

    let commissionMtdBtn = 0;
    try {
      const { data } = await admin
        .from("marketplace_commission_ledger")
        .select("commission_btn")
        .gte("created_at", monthStartIso());
      commissionMtdBtn = (data ?? []).reduce(
        (sum, row) => sum + Number(row.commission_btn ?? 0),
        0,
      );
    } catch (err) {
      console.error("[platform.dashboard] commission", err);
    }

    let mouPending = 0;
    let mouActive = 0;
    try {
      const { data: links } = await admin
        .from("agent_property_links")
        .select("id, status, mou_signed_at");
      mouActive = (links ?? []).filter(
        (row) => row.status === "approved" && row.mou_signed_at != null,
      ).length;
      mouPending = (links ?? []).filter(
        (row) =>
          row.status === "invited" ||
          (row.status === "approved" && !row.mou_signed_at),
      ).length;
    } catch (err) {
      console.error("[platform.dashboard] mou", err);
    }

    let hermesActiveChats = 0;
    let hermesAvailable = false;
    try {
      const v2 = admin.schema("v2");
      const chats = await v2
        .from("telegram_chats")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");
      hermesActiveChats = chats.count ?? 0;
      hermesAvailable = !chats.error;
    } catch (err) {
      console.error("[platform.dashboard] hermes schema", err);
      hermesAvailable = false;
    }

    return {
      hotels,
      distributors,
      newLeads,
      overdueAmc,
      royaltyDueBtn,
      openTickets,
      commissionMtdBtn,
      mouPending,
      mouActive,
      hermesActiveChats,
      hermesAvailable,
    };
  } catch (err) {
    console.error("[platform.dashboard] load", err);
    return empty;
  }
}

export async function loadMouRegistry(): Promise<{
  rows: MouRegistryRow[];
  error: string | null;
}> {
  const admin = createSupabaseAdminClient();
  try {
    const { data: links, error } = await admin
      .from("agent_property_links")
      .select(
        "id, agent_id, property_id, status, credit_limit, credit_used, mou_signed_at, notes",
      )
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[platform.mou] links", error);
      return { rows: [], error: error.message };
    }

    const agentIds = [...new Set((links ?? []).map((r) => r.agent_id as string))];
    const propertyIds = [...new Set((links ?? []).map((r) => r.property_id as string))];

    const [{ data: agents }, { data: properties }] = await Promise.all([
      agentIds.length
        ? admin.from("agents").select("id, company_name").in("id", agentIds)
        : Promise.resolve({ data: [] as Array<{ id: string; company_name: string }> }),
      propertyIds.length
        ? admin.from("properties").select("id, name").in("id", propertyIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    ]);

    const agentName = new Map((agents ?? []).map((a) => [a.id, a.company_name]));
    const propertyName = new Map((properties ?? []).map((p) => [p.id, p.name]));

    const rows: MouRegistryRow[] = (links ?? []).map((row) => ({
      id: row.id as string,
      agentId: row.agent_id as string,
      agentName: agentName.get(row.agent_id as string) ?? row.agent_id,
      propertyId: row.property_id as string,
      propertyName: propertyName.get(row.property_id as string) ?? row.property_id,
      status: deriveMouDisplayStatus(row.status as string, row.mou_signed_at as string | null),
      creditLimit: Number(row.credit_limit ?? 0),
      creditUsed: Number(row.credit_used ?? 0),
      mouSignedAt: (row.mou_signed_at as string | null) ?? null,
      source: "agent_property_links",
      notes: (row.notes as string | null) ?? null,
    }));

    // Prefer durable public links; overlay v2 bilateral lifecycle when present.
    try {
      const v2 = admin.schema("v2");
      const { data: v2Links, error: v2Err } = await v2
        .from("agent_mou_links")
        .select(
          "id, property_id, agent_id, status, credit_limit_btn, notes, proposed_at, decided_at",
        )
        .order("proposed_at", { ascending: false })
        .limit(500);
      if (!v2Err && v2Links?.length) {
        const v2PropIds = [...new Set(v2Links.map((r) => r.property_id as string))];
        const { data: v2Props } = await admin
          .from("properties")
          .select("id, name")
          .in("id", v2PropIds);
        const v2PropName = new Map((v2Props ?? []).map((p) => [p.id, p.name]));
        for (const row of v2Links) {
          rows.push({
            id: `v2:${row.id as string}`,
            agentId: String(row.agent_id),
            agentName: String(row.agent_id),
            propertyId: row.property_id as string,
            propertyName: v2PropName.get(row.property_id as string) ?? row.property_id,
            status: String(row.status),
            creditLimit: Number(row.credit_limit_btn ?? 0),
            creditUsed: 0,
            mouSignedAt: (row.decided_at as string | null) ?? null,
            source: "v2_agent_mou_links",
            notes: (row.notes as string | null) ?? null,
          });
        }
      }
    } catch (err) {
      console.error("[platform.mou] v2 overlay", err);
    }

    return { rows, error: null };
  } catch (err) {
    console.error("[platform.mou] load", err);
    return {
      rows: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function deriveMouDisplayStatus(
  linkStatus: string,
  mouSignedAt: string | null,
): string {
  if (linkStatus === "suspended") return "suspended";
  if (linkStatus === "invited") return "pending_counterparty";
  if (linkStatus === "approved" && mouSignedAt) return "active";
  if (linkStatus === "approved") return "pending_mou_signature";
  return linkStatus;
}

export async function loadCommissionLedger(limit = 200): Promise<{
  rows: CommissionLedgerRow[];
  error: string | null;
  mtdBtn: number;
}> {
  const admin = createSupabaseAdminClient();
  try {
    const { data, error } = await admin
      .from("marketplace_commission_ledger")
      .select(
        "id, property_id, booking_id, market, gross_btn, commission_rate, commission_btn, currency, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[platform.commissions]", error);
      return { rows: [], error: error.message, mtdBtn: 0 };
    }

    const propIds = [...new Set((data ?? []).map((r) => r.property_id as string))];
    const { data: props } = propIds.length
      ? await admin.from("properties").select("id, name").in("id", propIds)
      : { data: [] as Array<{ id: string; name: string }> };
    const names = new Map((props ?? []).map((p) => [p.id, p.name]));
    const start = monthStartIso();
    const rows: CommissionLedgerRow[] = (data ?? []).map((r) => ({
      id: r.id as string,
      propertyId: r.property_id as string,
      propertyName: names.get(r.property_id as string) ?? r.property_id,
      bookingId: (r.booking_id as string | null) ?? null,
      market: r.market as string,
      grossBtn: Number(r.gross_btn ?? 0),
      commissionRate: Number(r.commission_rate ?? 0),
      commissionBtn: Number(r.commission_btn ?? 0),
      currency: (r.currency as string) ?? "BTN",
      createdAt: r.created_at as string,
    }));
    const mtdBtn = rows
      .filter((r) => r.createdAt >= start)
      .reduce((s, r) => s + r.commissionBtn, 0);
    return { rows, error: null, mtdBtn };
  } catch (err) {
    console.error("[platform.commissions] load", err);
    return {
      rows: [],
      error: err instanceof Error ? err.message : String(err),
      mtdBtn: 0,
    };
  }
}

export async function loadTenantLicenses(): Promise<{
  rows: TenantLicenseRow[];
  error: string | null;
}> {
  const admin = createSupabaseAdminClient();
  try {
    const [{ data: props, error: pErr }, { data: licenses, error: lErr }] =
      await Promise.all([
        admin
          .from("properties")
          .select(
            "id, name, slug, package_code, go_live_at, is_demo, amc_amount_btn",
          )
          .order("name"),
        admin.from("saas_tenant_licenses").select("*"),
      ]);
    if (pErr) {
      console.error("[platform.tenants] properties", pErr);
      return { rows: [], error: pErr.message };
    }
    if (lErr) {
      console.error("[platform.tenants] licenses", lErr);
    }
    const byId = new Map((licenses ?? []).map((l) => [l.property_id as string, l]));
    const rows: TenantLicenseRow[] = (props ?? []).map((p) => {
      const lic = byId.get(p.id as string);
      return {
        propertyId: p.id as string,
        name: p.name as string,
        slug: p.slug as string,
        packageCode: (p.package_code as string | null) ?? null,
        isDemo: Boolean(p.is_demo),
        goLiveAt: (p.go_live_at as string | null) ?? null,
        amcAmountBtn:
          p.amc_amount_btn != null ? Number(p.amc_amount_btn) : null,
        tier: (lic?.tier as string) ?? "boutique",
        licenseStatus: (lic?.status as string) ?? "active",
        mrrBtn: Number(lic?.mrr_btn ?? 3500),
        paidThrough: (lic?.paid_through as string | null) ?? null,
        graceUntil: (lic?.grace_until as string | null) ?? null,
      };
    });
    return { rows, error: null };
  } catch (err) {
    console.error("[platform.tenants] load", err);
    return {
      rows: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function loadHermesFleet(): Promise<{
  chats: HermesChatRow[];
  topics: HermesTopicRow[];
  staff: HermesStaffLinkRow[];
  available: boolean;
  error: string | null;
}> {
  const admin = createSupabaseAdminClient();
  try {
    const v2 = admin.schema("v2");
    const [chatsRes, topicsRes, staffRes] = await Promise.all([
      v2
        .from("telegram_chats")
        .select(
          "id, property_id, chat_id, chat_type, role, status, display_name, agent_id, paired_at, last_seen_at",
        )
        .order("paired_at", { ascending: false })
        .limit(300),
      v2
        .from("telegram_topics")
        .select("id, property_id, chat_id, thread_id, kind")
        .limit(300),
      v2
        .from("telegram_staff_links")
        .select("id, property_id, tg_user_id, staff_name, role, active, linked_at")
        .order("linked_at", { ascending: false })
        .limit(300),
    ]);

    if (chatsRes.error && topicsRes.error && staffRes.error) {
      return {
        chats: [],
        topics: [],
        staff: [],
        available: false,
        error:
          chatsRes.error.message ||
          "Hermes tables unavailable (apply v2 migrations 0008/0009).",
      };
    }

    const propIds = [
      ...new Set(
        [
          ...(chatsRes.data ?? []).map((r) => r.property_id as string),
          ...(topicsRes.data ?? []).map((r) => r.property_id as string),
          ...(staffRes.data ?? []).map((r) => r.property_id as string),
        ].filter(Boolean),
      ),
    ];
    const { data: props } = propIds.length
      ? await admin.from("properties").select("id, name").in("id", propIds)
      : { data: [] as Array<{ id: string; name: string }> };
    const names = new Map((props ?? []).map((p) => [p.id, p.name]));

    return {
      available: true,
      error: null,
      chats: (chatsRes.data ?? []).map((r) => ({
        id: r.id as string,
        propertyId: r.property_id as string,
        propertyName: names.get(r.property_id as string) ?? r.property_id,
        chatId: Number(r.chat_id),
        chatType: String(r.chat_type),
        role: String(r.role),
        status: String(r.status),
        displayName: (r.display_name as string | null) ?? null,
        agentId: (r.agent_id as string | null) ?? null,
        pairedAt: (r.paired_at as string | null) ?? null,
        lastSeenAt: (r.last_seen_at as string | null) ?? null,
      })),
      topics: (topicsRes.data ?? []).map((r) => ({
        id: r.id as string,
        propertyId: r.property_id as string,
        propertyName: names.get(r.property_id as string) ?? r.property_id,
        chatId: Number(r.chat_id),
        threadId: Number(r.thread_id),
        kind: String(r.kind),
      })),
      staff: (staffRes.data ?? []).map((r) => ({
        id: r.id as string,
        propertyId: r.property_id as string,
        propertyName: names.get(r.property_id as string) ?? r.property_id,
        tgUserId: Number(r.tg_user_id),
        staffName: String(r.staff_name),
        role: String(r.role),
        active: Boolean(r.active),
        linkedAt: r.linked_at as string,
      })),
    };
  } catch (err) {
    console.error("[platform.hermes] load", err);
    return {
      chats: [],
      topics: [],
      staff: [],
      available: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function loadVaultAgentCommercial(): Promise<{
  byAgentId: Map<
    string,
    { mouActive: number; mouPending: number; creditUsed: number; creditLimit: number }
  >;
}> {
  const admin = createSupabaseAdminClient();
  const byAgentId = new Map<
    string,
    { mouActive: number; mouPending: number; creditUsed: number; creditLimit: number }
  >();
  try {
    const { data } = await admin
      .from("agent_property_links")
      .select("agent_id, status, mou_signed_at, credit_limit, credit_used");
    for (const row of data ?? []) {
      const id = row.agent_id as string;
      const cur = byAgentId.get(id) ?? {
        mouActive: 0,
        mouPending: 0,
        creditUsed: 0,
        creditLimit: 0,
      };
      if (row.status === "approved" && row.mou_signed_at) cur.mouActive += 1;
      else if (row.status === "invited" || (row.status === "approved" && !row.mou_signed_at))
        cur.mouPending += 1;
      cur.creditUsed += Number(row.credit_used ?? 0);
      cur.creditLimit += Number(row.credit_limit ?? 0);
      byAgentId.set(id, cur);
    }
  } catch (err) {
    console.error("[platform.vault] commercial", err);
  }
  return { byAgentId };
}
