"use server";

import { isDeskAuthenticated } from "@/lib/desk-auth";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

const STATUSES = new Set(["pending", "approved", "rejected", "demo"]);
const RATE_TIERS = new Set([
  "public",
  "friends",
  "family",
  "mutual_friends",
  "agents",
  "mou_agents",
]);

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type ErpAgentState = {
  ok: boolean;
  error?: string;
  message?: string;
};

export type AgentDocumentRow = {
  id: string;
  agent_id: string;
  kind: string;
  doc_url: string;
  doc_name: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type RoomTypeLite = {
  id: string;
  code: string;
  name: string;
  inventory_kind: string;
};

export type RateMatrixRow = {
  id: string | null;
  room_type_id: string;
  room_type_name: string;
  season_kind: string;
  rate_tier: string;
  amount_btn: number;
};

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

async function propertyId(admin: Admin) {
  return resolveActivePropertyId(admin);
}

function revalidateAgents() {
  revalidatePath("/erp/agents");
  revalidatePath("/erp");
  revalidatePath("/erp/fast-book");
}

async function appendLedger(
  admin: Admin,
  args: {
    propertyId: string;
    agentId: string;
    entryType: "charge" | "payment" | "adjustment" | "limit_set";
    amountBtn: number;
    balanceAfterBtn: number;
    note?: string | null;
    bookingId?: string | null;
    paymentId?: string | null;
  },
) {
  const { error } = await admin.from("agent_credit_ledger").insert({
    property_id: args.propertyId,
    agent_id: args.agentId,
    entry_type: args.entryType,
    amount_btn: args.amountBtn,
    balance_after_btn: args.balanceAfterBtn,
    note: args.note ?? null,
    booking_id: args.bookingId ?? null,
    payment_id: args.paymentId ?? null,
  });
  if (error) {
    console.error("agent_credit_ledger insert failed", error);
    throw new Error("Could not write credit ledger.");
  }
}

export async function updateAgentDeskStatus(
  _prev: ErpAgentState,
  formData: FormData,
): Promise<ErpAgentState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const agentId = trimRequired(formData.get("agent_id"), "Agent");
    const status = trimRequired(formData.get("status"), "Status").toLowerCase();
    if (!STATUSES.has(status)) {
      throw new Error("Status must be pending, approved, rejected, or demo.");
    }

    const rateTierRaw = optionalTrim(formData.get("rate_tier"));
    const patch: Record<string, string | number | boolean> = { status };
    if (rateTierRaw) {
      if (!RATE_TIERS.has(rateTierRaw)) {
        throw new Error("Invalid rate tier.");
      }
      patch.rate_tier = rateTierRaw;
    }

    const wantsMou = formData.get("wants_mou");
    patch.wants_mou = wantsMou === "on";

    const { error } = await admin.from("agents").update(patch).eq("id", agentId);
    if (error) {
      console.error("updateAgentDeskStatus failed", error);
      throw new Error("Could not update agent.");
    }

    revalidateAgents();
    return { ok: true, message: `Agent marked ${status}.` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Update failed.",
    };
  }
}

export async function setAgentCreditLimit(
  _prev: ErpAgentState,
  formData: FormData,
): Promise<ErpAgentState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propId = await propertyId(admin);
    const agentId = trimRequired(formData.get("agent_id"), "Agent");
    const limitRaw = trimRequired(formData.get("credit_limit"), "Credit limit");
    const creditLimit = roundBtn(Number(limitRaw));
    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
      throw new Error("Credit limit must be a non-negative number.");
    }

    const { data: agent, error: fetchError } = await admin
      .from("agents")
      .select("id, credit_used, credit_limit")
      .eq("id", agentId)
      .single();
    if (fetchError || !agent) throw new Error("Agent not found.");

    const used = Number(agent.credit_used ?? 0);
    if (creditLimit < used) {
      throw new Error(
        `Limit Nu ${creditLimit} is below used Nu ${used}. Collect payment first.`,
      );
    }

    const { error } = await admin
      .from("agents")
      .update({ credit_limit: creditLimit })
      .eq("id", agentId);
    if (error) throw new Error("Could not set credit limit.");

    await appendLedger(admin, {
      propertyId: propId,
      agentId,
      entryType: "limit_set",
      amountBtn: creditLimit,
      balanceAfterBtn: used,
      note: `Credit limit set to Nu ${creditLimit}`,
    });

    revalidateAgents();
    return { ok: true, message: `Credit limit set to Nu ${creditLimit}.` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not set limit.",
    };
  }
}

export async function recordAgentCreditPayment(
  _prev: ErpAgentState,
  formData: FormData,
): Promise<ErpAgentState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propId = await propertyId(admin);
    const agentId = trimRequired(formData.get("agent_id"), "Agent");
    const amountRaw = trimRequired(formData.get("amount_btn"), "Amount");
    const amount = roundBtn(Number(amountRaw));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }
    const note = optionalTrim(formData.get("note"));

    const { data: agent, error: fetchError } = await admin
      .from("agents")
      .select("id, credit_used, company_name")
      .eq("id", agentId)
      .single();
    if (fetchError || !agent) throw new Error("Agent not found.");

    const used = Number(agent.credit_used ?? 0);
    const nextUsed = roundBtn(Math.max(0, used - amount));

    const { data: payment, error: payError } = await admin
      .from("payments")
      .insert({
        property_id: propId,
        method: "bank",
        amount_btn: amount,
        reference: "agent_credit_payment",
        notes:
          note ??
          `Agent credit payment — ${(agent.company_name as string) ?? agentId}`,
      })
      .select("id")
      .single();

    if (payError || !payment) {
      console.error("agent credit payment row failed", payError);
    }

    const { error } = await admin
      .from("agents")
      .update({ credit_used: nextUsed })
      .eq("id", agentId);
    if (error) throw new Error("Could not update credit used.");

    await appendLedger(admin, {
      propertyId: propId,
      agentId,
      entryType: "payment",
      amountBtn: -amount,
      balanceAfterBtn: nextUsed,
      note: note ?? "Credit payment received",
      paymentId: payment?.id ?? null,
    });

    revalidateAgents();
    return {
      ok: true,
      message: `Recorded Nu ${amount} payment. Credit used now Nu ${nextUsed}.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Payment failed.",
    };
  }
}

/** Charge agent credit (increases credit_used). Used by fast-book / check-in. */
export async function chargeAgentCredit(
  admin: Admin,
  args: {
    agentId: string;
    amountBtn: number;
    bookingId?: string | null;
    note?: string | null;
  },
): Promise<{ creditUsed: number }> {
  const propId = await propertyId(admin);
  const amount = roundBtn(args.amountBtn);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Credit charge must be greater than zero.");
  }

  const { data: agent, error } = await admin
    .from("agents")
    .select("id, status, credit_limit, credit_used, rate_tier, company_name")
    .eq("id", args.agentId)
    .single();
  if (error || !agent) throw new Error("Agent not found for credit charge.");

  if (!["approved", "demo"].includes(agent.status as string)) {
    throw new Error("Agent must be approved or demo to use credit.");
  }

  const limit = Number(agent.credit_limit ?? 0);
  const used = Number(agent.credit_used ?? 0);
  const nextUsed = roundBtn(used + amount);
  if (nextUsed > limit + 0.001) {
    throw new Error(
      `Insufficient credit. Available Nu ${roundBtn(limit - used)}; need Nu ${amount}.`,
    );
  }

  const { error: upd } = await admin
    .from("agents")
    .update({ credit_used: nextUsed })
    .eq("id", args.agentId);
  if (upd) throw new Error("Could not update agent credit used.");

  await appendLedger(admin, {
    propertyId: propId,
    agentId: args.agentId,
    entryType: "charge",
    amountBtn: amount,
    balanceAfterBtn: nextUsed,
    note: args.note ?? "On-credit booking charge",
    bookingId: args.bookingId ?? null,
  });

  return { creditUsed: nextUsed };
}

// ──────────────────────────── Rate matrix editor ────────────────────────────

const SEASONS = new Set(["peak", "lean", "off"]);
const ROOM_RATE_TIERS = new Set([
  "public",
  "friends",
  "family",
  "mutual_friends",
  "agents",
  "mou_agents",
]);

export type RoomRateRow = {
  id: string;
  room_type_id: string;
  season_kind: string;
  rate_tier: string;
  amount_btn: number;
};

/** Desk: upsert a single room_rate row by (property, room_type, season, tier). */
export async function upsertRoomRate(
  _prev: ErpAgentState,
  formData: FormData,
): Promise<ErpAgentState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propId = await propertyId(admin);

    const roomTypeId = trimRequired(formData.get("room_type_id"), "Room type");
    const seasonKind = trimRequired(formData.get("season_kind"), "Season").toLowerCase();
    const rateTier = trimRequired(formData.get("rate_tier"), "Tier").toLowerCase();
    const amountRaw = trimRequired(formData.get("amount_btn"), "Amount");

    if (!SEASONS.has(seasonKind)) {
      throw new Error("Season must be peak, lean, or off.");
    }
    if (!ROOM_RATE_TIERS.has(rateTier)) {
      throw new Error("Invalid rate tier.");
    }
    const amount = roundBtn(Number(amountRaw));
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Amount must be a non-negative number.");
    }

    const { data: existing } = await admin
      .from("room_rates")
      .select("id")
      .eq("property_id", propId)
      .eq("room_type_id", roomTypeId)
      .eq("season_kind", seasonKind)
      .eq("rate_tier", rateTier)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await admin
        .from("room_rates")
        .update({ amount_btn: amount })
        .eq("id", existing.id);
      if (error) {
        console.error("upsertRoomRate update failed", error);
        throw new Error("Could not update rate.");
      }
    } else {
      const { error } = await admin.from("room_rates").insert({
        property_id: propId,
        room_type_id: roomTypeId,
        season_kind: seasonKind,
        rate_tier: rateTier,
        amount_btn: amount,
      });
      if (error) {
        console.error("upsertRoomRate insert failed", error);
        throw new Error("Could not create rate.");
      }
    }

    revalidateAgents();
    return { ok: true, message: `Rate saved — Nu ${amount}.` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not save rate.",
    };
  }
}

// ──────────────────────────── Agent documents ───────────────────────────────

const DOC_KINDS = new Set([
  "license",
  "mou_draft",
  "mou_signed",
  "gst_cert",
  "other",
]);

export async function uploadAgentDocument(
  _prev: ErpAgentState,
  formData: FormData,
): Promise<ErpAgentState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propId = await propertyId(admin);

    const agentId = trimRequired(formData.get("agent_id"), "Agent");
    const kind = trimRequired(formData.get("kind"), "Document kind").toLowerCase();
    const docUrl = trimRequired(formData.get("doc_url"), "Document URL");
    const docName = optionalTrim(formData.get("doc_name"));
    const notes = optionalTrim(formData.get("notes"));

    if (!DOC_KINDS.has(kind)) {
      throw new Error("Invalid document kind.");
    }
    try {
      const u = new URL(docUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        throw new Error("bad protocol");
      }
    } catch {
      throw new Error("Document URL must be a valid http(s) link.");
    }

    const { error } = await admin.from("agent_documents").insert({
      agent_id: agentId,
      property_id: propId,
      kind,
      doc_url: docUrl,
      doc_name: docName,
      notes,
      uploaded_by: "desk",
    });
    if (error) {
      console.error("uploadAgentDocument insert failed", error);
      throw new Error("Could not save document link.");
    }

    revalidateAgents();
    return { ok: true, message: "Document added." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not save document.",
    };
  }
}

export async function deleteAgentDocument(
  _prev: ErpAgentState,
  formData: FormData,
): Promise<ErpAgentState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const docId = trimRequired(formData.get("doc_id"), "Document");
    const { error } = await admin
      .from("agent_documents")
      .delete()
      .eq("id", docId);
    if (error) {
      console.error("deleteAgentDocument failed", error);
      throw new Error("Could not remove document.");
    }
    revalidateAgents();
    return { ok: true, message: "Document removed." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not remove document.",
    };
  }
}

// ──────────────────────────── Agent approval + portal token ─────────────────

export async function approveAgent(
  _prev: ErpAgentState,
  formData: FormData,
): Promise<ErpAgentState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const agentId = trimRequired(formData.get("agent_id"), "Agent");
    const rateTierRaw = optionalTrim(formData.get("rate_tier"));
    const rateTier = rateTierRaw && ROOM_RATE_TIERS.has(rateTierRaw) ? rateTierRaw : "agents";

    const { data: agent, error: fetchError } = await admin
      .from("agents")
      .select("id, status, rate_tier")
      .eq("id", agentId)
      .single();
    if (fetchError || !agent) throw new Error("Agent not found.");

    let portalToken: string | null = null;
    const { data: rpcToken, error: rpcError } = await admin.rpc(
      "issue_agent_portal_token",
      { p_agent_id: agentId },
    );
    if (!rpcError && typeof rpcToken === "string") {
      portalToken = rpcToken;
    } else {
      // Fallback when RPC missing: write token directly (admin client).
      const { randomBytes } = await import("node:crypto");
      portalToken = randomBytes(24).toString("hex");
      const { error: tokenError } = await admin
        .from("agents")
        .update({
          portal_token: portalToken,
          portal_token_issued_at: new Date().toISOString(),
        })
        .eq("id", agentId);
      if (tokenError) {
        console.error("approveAgent token fallback failed", tokenError);
        portalToken = null;
      }
    }

    const { error } = await admin
      .from("agents")
      .update({
        status: "approved",
        rate_tier: rateTier,
        approved_at: new Date().toISOString(),
      })
      .eq("id", agentId);
    if (error) throw new Error("Could not approve agent.");

    revalidateAgents();
    return {
      ok: true,
      message: portalToken
        ? "Approved. Portal token issued."
        : "Agent approved, but portal token could not be issued. Check migration.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not approve agent.",
    };
  }
}

export async function rejectAgent(
  _prev: ErpAgentState,
  formData: FormData,
): Promise<ErpAgentState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const agentId = trimRequired(formData.get("agent_id"), "Agent");
    const { error } = await admin
      .from("agents")
      .update({
        status: "rejected",
        rejected_at: new Date().toISOString(),
      })
      .eq("id", agentId);
    if (error) throw new Error("Could not reject agent.");
    revalidateAgents();
    return { ok: true, message: "Agent rejected." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not reject agent.",
    };
  }
}
