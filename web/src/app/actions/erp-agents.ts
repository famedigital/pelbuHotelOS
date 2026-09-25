"use server";

import { writeAuditEvent } from "@/lib/audit";
import {
  isAgentStatus,
  creditAgentIneligibilityMessage,
  isCreditAgentStatus,
} from "@/lib/agents/status";
import { isDeskAuthenticated, requireMoneyDesk } from "@/lib/desk-auth";
import { postFolioPaymentRecord, rollbackFolioPaymentRecord } from "@/lib/folio/post-payment";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired, assertOptionalEmail, assertPhone } from "@/lib/validation";
import { revalidatePath } from "next/cache";

const RATE_TIERS = new Set([
  "public",
  "friends",
  "family",
  "mutual_friends",
  "agents",
  "mou_agents",
]);
const MARKETS = new Set(["bhutan", "jaigaon", "india"]);

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type ErpAgentState = {
  ok: boolean;
  error?: string;
  message?: string;
};

export type CreateDeskAgentState = {
  ok: boolean;
  agentId?: string;
  agent?: {
    id: string;
    company_name: string;
    market: string;
    status: string;
  };
  error?: string;
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
  revalidatePath("/erp/rates");
  revalidatePath("/erp");
  revalidatePath("/erp/fast-book");
  revalidatePath("/erp/calendar");
}

/**
 * Desk-created trade partner. Starts as pending so Innora can verify license;
 * hotel gets a local link immediately for booking while verification is open.
 */
export async function createDeskAgent(
  _prev: CreateDeskAgentState,
  formData: FormData,
): Promise<CreateDeskAgentState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propId = await propertyId(admin);

    const companyName = trimRequired(formData.get("company_name"), "Company name");
    const market = trimRequired(formData.get("market"), "Market").toLowerCase();
    if (!MARKETS.has(market)) {
      throw new Error("Choose Bhutan, Jaigaon, or India as the market.");
    }

    const contactName = trimRequired(formData.get("contact_name"), "Contact name");
    const contactPhone = trimRequired(formData.get("contact_phone"), "Phone");
    assertPhone(contactPhone);

    const contactEmail = optionalTrim(formData.get("contact_email"));
    assertOptionalEmail(contactEmail);
    const notes = optionalTrim(formData.get("notes"));
    const licenseNo = optionalTrim(formData.get("license_no"));

    // Hotel-typed agents are bookable as directory while Innora verifies license.
    const statusRaw = (optionalTrim(formData.get("status")) ?? "directory").toLowerCase();
    if (
      statusRaw !== "approved" &&
      statusRaw !== "demo" &&
      statusRaw !== "directory" &&
      statusRaw !== "pending"
    ) {
      throw new Error("Invalid agent status.");
    }

    const { data: agent, error } = await admin
      .from("agents")
      .insert({
        company_name: companyName,
        market,
        contact_name: contactName,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        notes: [notes, licenseNo ? `license:${licenseNo}` : null]
          .filter(Boolean)
          .join("\n"),
        wants_mou: formData.get("wants_mou") === "on",
        status: statusRaw,
        rate_tier: "agents",
        credit_limit: 0,
        credit_used: 0,
        approved_at: statusRaw === "approved" ? new Date().toISOString() : null,
      })
      .select("id, company_name, market, status")
      .single();

    if (error || !agent) {
      console.error("createDeskAgent insert failed", error);
      throw new Error("Could not create agent. Please try again.");
    }

    const { upsertAgentPropertyLink } = await import(
      "@/lib/erp/agent-property-links"
    );
    await upsertAgentPropertyLink(admin, {
      agentId: agent.id as string,
      propertyId: propId,
      status: statusRaw === "pending" ? "invited" : "approved",
    });

    // Always notify Innora when a hotel types a new agent (verify license / details).
    const { enqueuePlatformVerification } = await import(
      "@/lib/platform-verification"
    );
    await enqueuePlatformVerification(admin, {
      entityType: "agent",
      entityId: agent.id as string,
      propertyId: propId,
      submittedBy: "desk",
      payload: {
        companyName,
        contactName,
        contactPhone,
        contactEmail,
        licenseNo,
        market,
        status: statusRaw,
      },
    });

    revalidateAgents();
    return {
      ok: true,
      agentId: agent.id as string,
      agent: {
        id: agent.id as string,
        company_name: agent.company_name as string,
        market: agent.market as string,
        status: agent.status as string,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not create agent.",
    };
  }
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
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const agentId = trimRequired(formData.get("agent_id"), "Agent");
    const status = trimRequired(formData.get("status"), "Status").toLowerCase();
    if (!isAgentStatus(status)) {
      throw new Error(
        "Status must be pending, approved, rejected, demo, or directory.",
      );
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
    await requireMoneyDesk();
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
      .select("id, credit_used, credit_limit, status")
      .eq("id", agentId)
      .single();
    if (fetchError || !agent) throw new Error("Agent not found.");
    {
      const blocked = creditAgentIneligibilityMessage(
        agent.status as string,
      );
      if (blocked) throw new Error(blocked);
    }

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

export async function setAgentOpenRoomCap(
  _prev: ErpAgentState,
  formData: FormData,
): Promise<ErpAgentState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const propId = await propertyId(admin);
    const agentId = trimRequired(formData.get("agent_id"), "Agent");
    const capRaw = trimRequired(formData.get("open_room_cap"), "Open room cap");
    const cap = Math.floor(Number(capRaw));
    if (!Number.isFinite(cap) || cap < 0 || cap > 500) {
      throw new Error("Open room cap must be 0–500.");
    }

    const { data: agent, error: fetchError } = await admin
      .from("agents")
      .select("id, company_name")
      .eq("id", agentId)
      .single();
    if (fetchError || !agent) throw new Error("Agent not found.");

    const { error } = await admin
      .from("agents")
      .update({ open_room_cap: cap })
      .eq("id", agentId);
    if (error) throw new Error("Could not set open room cap.");

    await writeAuditEvent(admin, {
      propertyId: propId,
      action: "agent.open_room_cap",
      entityType: "agents",
      entityId: agentId,
      summary: `Open room cap set to ${cap} · ${agent.company_name}`,
      meta: { open_room_cap: cap },
    });

    revalidateAgents();
    return {
      ok: true,
      message: `Open room cap set to ${cap} concurrent rooms.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not set room cap.",
    };
  }
}

export async function recordAgentCreditPayment(
  _prev: ErpAgentState,
  formData: FormData,
): Promise<ErpAgentState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const propId = await propertyId(admin);
    const agentId = trimRequired(formData.get("agent_id"), "Agent");
    const amountRaw = trimRequired(formData.get("amount_btn"), "Amount");
    const amount = roundBtn(Number(amountRaw));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }
    const note = optionalTrim(formData.get("note"));
    const idempotencyKey = optionalTrim(formData.get("idempotency_key"));

    const { data: agent, error: fetchError } = await admin
      .from("agents")
      .select("id, credit_used, company_name")
      .eq("id", agentId)
      .single();
    if (fetchError || !agent) throw new Error("Agent not found.");

    if (idempotencyKey) {
      const { data: existingPay } = await admin
        .from("payments")
        .select("id")
        .eq("property_id", propId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existingPay?.id) {
        const { data: ledger } = await admin
          .from("agent_credit_ledger")
          .select("id")
          .eq("payment_id", existingPay.id as string)
          .maybeSingle();
        if (ledger) {
          revalidateAgents();
          return { ok: true, message: "Payment already recorded." };
        }
      }
    }

    const used = Number(agent.credit_used ?? 0);
    const nextUsed = roundBtn(Math.max(0, used - amount));

    const pay = await postFolioPaymentRecord(admin, {
      property_id: propId,
      method: "bank",
      kind: "settlement",
      amount_btn: amount,
      reference: "agent_credit_payment",
      notes:
        note ??
        `Agent credit payment — ${(agent.company_name as string) ?? agentId}`,
      idempotency_key:
        idempotencyKey ?? `agent_credit_payment:${agentId}:${amount}`,
    });

    if (pay.alreadyExists) {
      const { data: ledger } = await admin
        .from("agent_credit_ledger")
        .select("id")
        .eq("payment_id", pay.paymentId)
        .maybeSingle();
      if (ledger) {
        revalidateAgents();
        return { ok: true, message: "Payment already recorded." };
      }
    }

    try {
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
        paymentId: pay.paymentId,
      });
    } catch (err) {
      if (!pay.alreadyExists) {
        await rollbackFolioPaymentRecord(admin, propId, pay.paymentId);
      }
      throw err;
    }

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

  {
    const blocked = creditAgentIneligibilityMessage(
      agent.status as string,
      agent.company_name as string | null,
    );
    if (blocked) throw new Error(blocked);
  }

  // Soft tracker only — Bhutan FO does not hard-block on Nu credit_limit.
  // credit_used = agent AR outstanding for reminders / dossier.
  const used = Number(agent.credit_used ?? 0);
  const nextUsed = roundBtn(used + amount);

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

/**
 * Reverse an agent credit charge (decreases credit_used) with ledger audit.
 * Used when voiding agent_credit folio payments / reverse settle mistakes.
 */
export async function releaseAgentCredit(
  admin: Admin,
  args: {
    agentId: string;
    amountBtn: number;
    bookingId?: string | null;
    paymentId?: string | null;
    note?: string | null;
  },
): Promise<{ creditUsed: number }> {
  const propId = await propertyId(admin);
  const amount = roundBtn(args.amountBtn);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Credit release must be greater than zero.");
  }

  const { data: agent, error } = await admin
    .from("agents")
    .select("id, credit_used, company_name")
    .eq("id", args.agentId)
    .single();
  if (error || !agent) throw new Error("Agent not found for credit release.");

  const used = Number(agent.credit_used ?? 0);
  const nextUsed = roundBtn(Math.max(0, used - amount));

  const { error: upd } = await admin
    .from("agents")
    .update({ credit_used: nextUsed })
    .eq("id", args.agentId);
  if (upd) throw new Error("Could not update agent credit used.");

  await appendLedger(admin, {
    propertyId: propId,
    agentId: args.agentId,
    entryType: "adjustment",
    amountBtn: -amount,
    balanceAfterBtn: nextUsed,
    note: args.note ?? "Agent credit reverse / void",
    bookingId: args.bookingId ?? null,
    paymentId: args.paymentId ?? null,
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
  prev: ErpAgentState,
  formData: FormData,
): Promise<ErpAgentState> {
  const { upsertRoomRate: saveRate } = await import("@/app/actions/erp-rates");
  return saveRate(prev, formData);
}

// Legacy inline implementation removed — see erp-rates.ts

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

    if (kind === "mou_signed") {
      const { upsertAgentPropertyLink } = await import(
        "@/lib/erp/agent-property-links"
      );
      await upsertAgentPropertyLink(admin, {
        agentId,
        propertyId: propId,
        status: "approved",
        mouSignedAt: new Date().toISOString(),
      });
    }

    revalidateAgents();
    return { ok: true, message: kind === "mou_signed" ? "MoU recorded — agent can see rates & inventory for this hotel." : "Document added." };
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
    await requireMoneyDesk();
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

/**
 * In-flow promote: directory (or other non-credit) listing → approved trade partner
 * so FO can finish an on-credit booking without leaving Fast Book / Calendar.
 * Optional credit limit can be set in the same step.
 */
export type PromoteAgentForCreditState = {
  ok: boolean;
  error?: string;
  message?: string;
  agent?: {
    id: string;
    company_name: string;
    market: string;
    status: string;
  };
};

export async function promoteAgentForCredit(
  _prev: PromoteAgentForCreditState,
  formData: FormData,
): Promise<PromoteAgentForCreditState> {
  try {
    // Same bar as desk-created partners — FO can finish credit book mid-stay entry.
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propId = await propertyId(admin);
    const agentId = trimRequired(formData.get("agent_id"), "Agent");
    const rateTierRaw = optionalTrim(formData.get("rate_tier"));
    const rateTier =
      rateTierRaw && RATE_TIERS.has(rateTierRaw) ? rateTierRaw : "agents";

    const limitRaw = optionalTrim(formData.get("credit_limit"));
    let creditLimit: number | null = null;
    if (limitRaw) {
      creditLimit = roundBtn(Number(limitRaw));
      if (!Number.isFinite(creditLimit) || creditLimit < 0) {
        throw new Error("Credit limit must be a non-negative number.");
      }
    }

    const { data: agent, error: fetchError } = await admin
      .from("agents")
      .select("id, company_name, market, status, credit_used, credit_limit")
      .eq("id", agentId)
      .single();
    if (fetchError || !agent) throw new Error("Agent not found.");

    if (isCreditAgentStatus(agent.status as string)) {
      return {
        ok: true,
        message: "Already a trade partner (credit eligible).",
        agent: {
          id: agent.id as string,
          company_name: agent.company_name as string,
          market: agent.market as string,
          status: agent.status as string,
        },
      };
    }

    if ((agent.status as string) === "rejected") {
      throw new Error("This agent was rejected. Re-open them from Agents first.");
    }

    // Soft portal token (same as approveAgent); failures are non-blocking.
    const { data: rpcToken, error: rpcError } = await admin.rpc(
      "issue_agent_portal_token",
      { p_agent_id: agentId },
    );
    if (rpcError || typeof rpcToken !== "string") {
      try {
        const { randomBytes } = await import("node:crypto");
        const portalToken = randomBytes(24).toString("hex");
        await admin
          .from("agents")
          .update({
            portal_token: portalToken,
            portal_token_issued_at: new Date().toISOString(),
          })
          .eq("id", agentId);
      } catch (e) {
        console.error("promoteAgentForCredit portal token skip", e);
      }
    }

    const used = Number(agent.credit_used ?? 0);
    const patch: Record<string, string | number | null> = {
      status: "approved",
      rate_tier: rateTier,
      approved_at: new Date().toISOString(),
    };
    if (creditLimit != null) {
      if (creditLimit < used) {
        throw new Error(
          `Limit Nu ${creditLimit} is below used Nu ${used}. Collect payment first.`,
        );
      }
      patch.credit_limit = creditLimit;
    }

    const { data: updated, error } = await admin
      .from("agents")
      .update(patch)
      .eq("id", agentId)
      .select("id, company_name, market, status")
      .single();
    if (error || !updated) throw new Error("Could not approve agent for credit.");

    if (creditLimit != null) {
      await appendLedger(admin, {
        propertyId: propId,
        agentId,
        entryType: "limit_set",
        amountBtn: creditLimit,
        balanceAfterBtn: used,
        note: `Credit limit set to Nu ${creditLimit} (in-flow promote)`,
      });
    }

    revalidateAgents();
    return {
      ok: true,
      message:
        creditLimit != null
          ? `Approved as trade partner. Credit limit Nu ${creditLimit}.`
          : "Approved as trade partner. Continue on credit.",
      agent: {
        id: updated.id as string,
        company_name: updated.company_name as string,
        market: updated.market as string,
        status: updated.status as string,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Could not promote agent for credit.",
    };
  }
}

export async function rejectAgent(
  _prev: ErpAgentState,
  formData: FormData,
): Promise<ErpAgentState> {
  try {
    await requireMoneyDesk();
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
