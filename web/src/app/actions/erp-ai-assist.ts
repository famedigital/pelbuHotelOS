"use server";

import { createHash } from "crypto";

import { writeAuditEvent } from "@/lib/audit";
import {
  GEMINI_CONSENT_SYSTEM,
  generateGeminiJson,
  loadGeminiByok,
} from "@/lib/ai/gemini-byok";
import {
  decryptSecret,
  encryptSecret,
  maskApiKey,
} from "@/lib/ai/secret-crypto";
import { isDeskAuthenticated, requireDeskRole } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { guestLedgerBalance } from "@/lib/folio/guest-ledger";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type AiSettingsState = {
  ok: boolean;
  error?: string;
  message?: string;
};

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function trimRequired(v: FormDataEntryValue | null, label: string): string {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`${label} is required.`);
  return s;
}

function promptHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export type AiAssistStatus = {
  configured: boolean;
  enabled: boolean;
  model: string;
  maskedKey: string | null;
};

export async function getPropertyAiAssistStatus(
  propertyId: string,
): Promise<AiAssistStatus> {
  await requireDesk();
  const admin = createSupabaseAdminClient();
  await assertDeskProperty(
    await resolveActivePropertyId(admin),
    propertyId,
    "Property",
  );
  const { data } = await admin
    .from("property_ai_settings")
    .select("gemini_api_key_enc, gemini_model, enabled")
    .eq("property_id", propertyId)
    .maybeSingle();
  const plain = decryptSecret(data?.gemini_api_key_enc as string | null);
  return {
    configured: Boolean(plain),
    enabled: Boolean(data?.enabled) && Boolean(plain),
    model: (data?.gemini_model as string | null)?.trim() || "gemini-2.0-flash",
    maskedKey: maskApiKey(plain),
  };
}

export async function savePropertyGeminiByok(
  _prev: AiSettingsState,
  formData: FormData,
): Promise<AiSettingsState> {
  try {
    await requireDesk();
    await requireDeskRole(["owner", "gm"]);
    const admin = createSupabaseAdminClient();
    const propertyId = trimRequired(formData.get("property_id"), "Property");
    await assertDeskProperty(
      await resolveActivePropertyId(admin),
      propertyId,
      "Property",
    );

    const model =
      String(formData.get("gemini_model") ?? "").trim() || "gemini-2.0-flash";
    const enabled = formData.get("enabled") === "on";
    const clearKey = formData.get("clear_key") === "on";
    const newKey = String(formData.get("gemini_api_key") ?? "").trim();

    const { data: existing } = await admin
      .from("property_ai_settings")
      .select("gemini_api_key_enc")
      .eq("property_id", propertyId)
      .maybeSingle();

    let enc = (existing?.gemini_api_key_enc as string | null) ?? null;
    if (clearKey) enc = null;
    else if (newKey) enc = encryptSecret(newKey);

    const row = {
      property_id: propertyId,
      gemini_api_key_enc: enc,
      gemini_model: model,
      enabled: enabled && Boolean(enc),
      updated_at: new Date().toISOString(),
      updated_by: "desk",
    };

    const { error } = await admin.from("property_ai_settings").upsert(row);
    if (error) throw new Error("Could not save Gemini settings.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "property.settings.gemini_byok",
      entityType: "property_ai_settings",
      entityId: propertyId,
      summary: enabled
        ? "Saved property Gemini BYOK (Assist enabled)"
        : "Saved property Gemini BYOK (Assist disabled)",
      meta: {
        model,
        enabled: row.enabled,
        key_cleared: clearKey,
        key_updated: Boolean(newKey),
      },
    });

    revalidatePath("/erp/settings");
    return {
      ok: true,
      message: row.enabled
        ? "Gemini Assist enabled for this hotel (draft-only until Confirm)."
        : "Gemini Assist settings saved.",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save Gemini settings.",
    };
  }
}

export type AiDraftResult =
  | {
      ok: true;
      draft: unknown;
      model: string;
      promptHash: string;
      mode: string;
    }
  | { ok: false; error: string };

async function runDraft(opts: {
  propertyId: string;
  mode: string;
  systemExtra: string;
  user: string;
  entityType?: string;
  entityId?: string | null;
}): Promise<AiDraftResult> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const active = await resolveActivePropertyId(admin);
    await assertDeskProperty(active, opts.propertyId, "Property");

    const byok = await loadGeminiByok(admin, opts.propertyId);
    if (!byok.enabled || !byok.apiKey) {
      return {
        ok: false,
        error:
          "Gemini Assist is off. Owner/GM: Settings → Gemini Assist (paste your API key).",
      };
    }

    const user = opts.user.slice(0, 12_000);
    const hash = promptHash(`${opts.mode}:${user}`);
    const result = await generateGeminiJson({
      apiKey: byok.apiKey,
      model: byok.model,
      system: `${GEMINI_CONSENT_SYSTEM}\n${opts.systemExtra}`,
      user,
    });

    if (!result.ok) return { ok: false, error: result.error };

    await writeAuditEvent(admin, {
      propertyId: opts.propertyId,
      action: "ai.draft_created",
      entityType: opts.entityType ?? "ai_assist",
      entityId: opts.entityId ?? null,
      summary: `Gemini draft: ${opts.mode}`,
      meta: { mode: opts.mode, prompt_hash: hash, model: result.model },
    });

    return {
      ok: true,
      draft: result.data,
      model: result.model,
      promptHash: hash,
      mode: opts.mode,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Assist draft failed.",
    };
  }
}

/** Audit when desk confirms applying a draft (mutation still via existing actions). */
export async function acceptAiDraft(input: {
  propertyId: string;
  mode: string;
  promptHash: string;
  entityType?: string;
  entityId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    await assertDeskProperty(
      await resolveActivePropertyId(admin),
      input.propertyId,
      "Property",
    );
    await writeAuditEvent(admin, {
      propertyId: input.propertyId,
      action: "ai.draft_accepted",
      entityType: input.entityType ?? "ai_assist",
      entityId: input.entityId ?? null,
      summary: `Desk confirmed Gemini draft: ${input.mode}`,
      meta: { mode: input.mode, prompt_hash: input.promptHash },
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not audit Confirm.",
    };
  }
}

export async function draftStayFromText(input: {
  propertyId: string;
  text: string;
}): Promise<AiDraftResult> {
  return runDraft({
    propertyId: input.propertyId,
    mode: "paste_to_stay",
    systemExtra: `Schema: {
  "guestName": string,
  "checkIn": "YYYY-MM-DD"|null,
  "checkOut": "YYYY-MM-DD"|null,
  "rooms": number|null,
  "mealPlan": string|null,
  "nightlyRateBtn": number|null,
  "agentName": string|null,
  "guideName": string|null,
  "notes": string|null,
  "confidence": "high"|"medium"|"low",
  "summary": string
}`,
    user: `Extract a stay draft from this agent/guest message:\n\n${input.text}`,
  });
}

export async function explainFolioDue(input: {
  propertyId: string;
  bookingId: string;
}): Promise<AiDraftResult> {
  await requireDesk();
  const admin = createSupabaseAdminClient();
  await assertDeskProperty(
    await resolveActivePropertyId(admin),
    input.propertyId,
    "Property",
  );

  const { data: booking } = await admin
    .from("bookings")
    .select("id, property_id, confirmation_code, contact_name, status")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (!booking || booking.property_id !== input.propertyId) {
    return { ok: false, error: "Stay not found." };
  }

  const { data: folio } = await admin
    .from("folios")
    .select("id")
    .eq("booking_id", input.bookingId)
    .maybeSingle();

  let due = 0;
  let lineSummary: Array<{
    kind: string;
    description: string;
    total: number;
    voided: boolean;
  }> = [];

  if (folio?.id) {
    const { data: lines } = await admin
      .from("folio_lines")
      .select(
        "id, status, kind, description, total_btn, source_type, reverses_line_id",
      )
      .eq("folio_id", folio.id)
      .order("created_at", { ascending: true })
      .limit(80);
    const rows = lines ?? [];
    due = guestLedgerBalance(
      rows.map((l, i) => ({
        id: (l.id as string) ?? `tmp-${i}`,
        status: (l.status as string) ?? "posted",
        total_btn: Number(l.total_btn ?? 0),
        reverses_line_id: (l.reverses_line_id as string | null) ?? null,
      })),
    );
    lineSummary = rows.slice(0, 40).map((l) => ({
      kind: String(l.kind ?? ""),
      description: String(l.description ?? ""),
      total: Number(l.total_btn ?? 0),
      voided: String(l.status ?? "") === "voided",
    }));
  }

  return runDraft({
    propertyId: input.propertyId,
    mode: "explain_due",
    entityType: "booking",
    entityId: input.bookingId,
    systemExtra: `Schema: {
  "dueBtn": number,
  "plainExplanation": string,
  "suggestedSteps": string[],
  "voidRepostPlaybook": string|null,
  "confidence": "high"|"medium"|"low"
}
Use guest words (Due, Collect, Bill). Do not invent line amounts — use the ledger snapshot.`,
    user: JSON.stringify({
      confirmation: booking.confirmation_code,
      guest: booking.contact_name,
      status: booking.status,
      dueBtn: due,
      lines: lineSummary,
    }),
  });
}

export async function draftCheckoutChecklist(input: {
  propertyId: string;
  bookingId: string;
}): Promise<AiDraftResult> {
  await requireDesk();
  const admin = createSupabaseAdminClient();
  await assertDeskProperty(
    await resolveActivePropertyId(admin),
    input.propertyId,
    "Property",
  );

  const { data: booking } = await admin
    .from("bookings")
    .select(
      "id, property_id, confirmation_code, contact_name, status, check_out, guide_number, payment_mode, agent_id",
    )
    .eq("id", input.bookingId)
    .maybeSingle();
  if (!booking || booking.property_id !== input.propertyId) {
    return { ok: false, error: "Stay not found." };
  }

  const { data: folio } = await admin
    .from("folios")
    .select("id")
    .eq("booking_id", input.bookingId)
    .maybeSingle();

  let due = 0;
  if (folio?.id) {
    const { data: lines } = await admin
      .from("folio_lines")
      .select("id, status, total_btn, reverses_line_id")
      .eq("folio_id", folio.id);
    due = guestLedgerBalance(
      (lines ?? []).map((l, i) => ({
        id: (l.id as string) ?? `tmp-${i}`,
        status: (l.status as string) ?? "posted",
        total_btn: Number(l.total_btn ?? 0),
        reverses_line_id: (l.reverses_line_id as string | null) ?? null,
      })),
    );
  }

  return runDraft({
    propertyId: input.propertyId,
    mode: "checkout_checklist",
    entityType: "booking",
    entityId: input.bookingId,
    systemExtra: `Schema: {
  "ready": boolean,
  "blockers": string[],
  "checklist": Array<{ "item": string, "ok": boolean, "hint": string }>,
  "plainSummary": string
}
Due must be clear (~0) before checkout. Never say the system will auto-collect.`,
    user: JSON.stringify({
      guest: booking.contact_name,
      status: booking.status,
      checkOut: booking.check_out,
      guide: booking.guide_number,
      paymentMode: booking.payment_mode,
      hasAgent: Boolean(booking.agent_id),
      dueBtn: due,
    }),
  });
}

export async function draftPosTicket(input: {
  propertyId: string;
  text: string;
  menuHints?: string[];
}): Promise<AiDraftResult> {
  const hints = (input.menuHints ?? []).slice(0, 40).join(", ");
  return runDraft({
    propertyId: input.propertyId,
    mode: "pos_ticket",
    systemExtra: `Schema: {
  "lines": Array<{ "name": string, "qty": number, "notes": string|null }>,
  "guestNote": string|null,
  "summary": string,
  "confidence": "high"|"medium"|"low"
}
Suggest ticket lines only. Desk must Confirm before adding to the order.`,
    user: `Menu hints (optional): ${hints || "(none)"}\n\nOrder text:\n${input.text}`,
  });
}

export async function draftInvoiceNotes(input: {
  propertyId: string;
  bookingId: string;
  context?: string;
}): Promise<AiDraftResult> {
  return runDraft({
    propertyId: input.propertyId,
    mode: "invoice_notes",
    entityType: "booking",
    entityId: input.bookingId,
    systemExtra: `Schema: {
  "notes": string,
  "shareText": string,
  "warning": string|null
}
Draft guest-facing invoice notes. Do not invent invoice numbers.`,
    user: `Booking ${input.bookingId}. Context: ${input.context ?? "FO invoice"}`,
  });
}

export async function draftCheckInFromStay(input: {
  propertyId: string;
  bookingId: string;
}): Promise<AiDraftResult> {
  await requireDesk();
  const admin = createSupabaseAdminClient();
  await assertDeskProperty(
    await resolveActivePropertyId(admin),
    input.propertyId,
    "Property",
  );
  const { data: booking } = await admin
    .from("bookings")
    .select(
      "id, property_id, contact_name, status, adults, children, guide_number, guest_origin, check_in, check_out",
    )
    .eq("id", input.bookingId)
    .maybeSingle();
  if (!booking || booking.property_id !== input.propertyId) {
    return { ok: false, error: "Stay not found." };
  }
  return runDraft({
    propertyId: input.propertyId,
    mode: "check_in",
    entityType: "booking",
    entityId: input.bookingId,
    systemExtra: `Schema: {
  "nationality": string|null,
  "adults": number|null,
  "children": number|null,
  "guideNumber": string|null,
  "roomSuggestion": string|null,
  "notes": string|null,
  "summary": string
}
Suggest check-in fields only. Desk must Confirm check-in.`,
    user: JSON.stringify({
      guest: booking.contact_name,
      status: booking.status,
      adults: booking.adults,
      children: booking.children,
      guideNumber: booking.guide_number,
      origin: booking.guest_origin,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
    }),
  });
}

export async function summarizeNightClose(input: {
  propertyId: string;
  notes?: string;
}): Promise<AiDraftResult> {
  await requireDesk();
  const admin = createSupabaseAdminClient();
  await assertDeskProperty(
    await resolveActivePropertyId(admin),
    input.propertyId,
    "Property",
  );
  const { data: property } = await admin
    .from("properties")
    .select("current_business_date")
    .eq("id", input.propertyId)
    .maybeSingle();
  const biz = (property?.current_business_date as string | null) ?? "";
  const [{ count: openShifts }, { count: inHouse }] = await Promise.all([
    admin
      .from("pos_shifts")
      .select("*", { count: "exact", head: true })
      .eq("property_id", input.propertyId)
      .eq("status", "open"),
    admin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("property_id", input.propertyId)
      .eq("status", "checked_in"),
  ]);
  return runDraft({
    propertyId: input.propertyId,
    mode: "night_close",
    systemExtra: `Schema: {
  "blockers": string[],
  "plainSummary": string,
  "readyToRun": boolean
}
Coach only — never say the system will auto-run night audit.`,
    user: JSON.stringify({
      businessDate: biz,
      openPosShifts: openShifts ?? 0,
      inHouse: inHouse ?? 0,
      notes: input.notes ?? "",
    }),
  });
}

export async function draftAgentRateSheet(input: {
  propertyId: string;
  hint?: string;
}): Promise<AiDraftResult> {
  return runDraft({
    propertyId: input.propertyId,
    mode: "rate_sheet",
    systemExtra: `Schema: {
  "agentsPctOfPublic": number,
  "summary": string,
  "cells": Array<{ "roomTypeCode": string|null, "seasonKind": string|null, "proposedBtn": number|null }>
}
Propose Agents tier as % of Public. Desk must Save the sheet.`,
    user: `Property ${input.propertyId}. Hint: ${input.hint ?? "90% of Public"}`,
  });
}

export async function draftFoShiftBriefing(input: {
  propertyId: string;
  snapshot: Record<string, unknown>;
}): Promise<AiDraftResult> {
  return runDraft({
    propertyId: input.propertyId,
    mode: "shift_briefing",
    systemExtra: `Schema: {
  "briefing": string,
  "focus": string[]
}
Plain class-8 words for front desk. No money mutations.`,
    user: JSON.stringify(input.snapshot).slice(0, 4000),
  });
}

/** Explain travel-agent AR / credit — draft only; desk Collects via Hub or Money tab. */
export async function explainAgentDue(input: {
  propertyId: string;
  agentId: string;
}): Promise<AiDraftResult> {
  await requireDesk();
  const admin = createSupabaseAdminClient();
  await assertDeskProperty(
    await resolveActivePropertyId(admin),
    input.propertyId,
    "Property",
  );

  const { data: agent } = await admin
    .from("agents")
    .select(
      "id, company_name, status, credit_limit, credit_used, open_room_cap, contact_name",
    )
    .eq("id", input.agentId)
    .maybeSingle();
  if (!agent) {
    return { ok: false, error: "Partner not found." };
  }

  const { data: link } = await admin
    .from("agent_property_links")
    .select("agent_id")
    .eq("agent_id", input.agentId)
    .eq("property_id", input.propertyId)
    .maybeSingle();
  if (!link) {
    const { count } = await admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("property_id", input.propertyId)
      .eq("agent_id", input.agentId)
      .limit(1);
    if (!count) {
      return { ok: false, error: "Partner not found for this property." };
    }
  }

  const { data: bookingRows } = await admin
    .from("bookings")
    .select("id, status, contact_name, check_out")
    .eq("property_id", input.propertyId)
    .eq("agent_id", input.agentId)
    .in("status", ["checked_in", "confirmed", "held"])
    .order("check_out", { ascending: true })
    .limit(24);

  const bookingIds = (bookingRows ?? []).map((b) => b.id as string);
  let openStayDue = 0;
  const staySnaps: Array<{
    guest: string | null;
    status: string;
    dueBtn: number;
  }> = [];

  if (bookingIds.length) {
    const { data: folios } = await admin
      .from("folios")
      .select("id, booking_id")
      .in("booking_id", bookingIds);
    const folioByBooking = new Map(
      (folios ?? []).map((f) => [f.booking_id as string, f.id as string]),
    );
    const folioIds = [...folioByBooking.values()];
    const linesByFolio = new Map<
      string,
      Array<{
        id: string;
        status: string;
        total_btn: number;
        reverses_line_id: string | null;
      }>
    >();
    if (folioIds.length) {
      const { data: lines } = await admin
        .from("folio_lines")
        .select("id, folio_id, status, total_btn, reverses_line_id")
        .in("folio_id", folioIds);
      for (const l of lines ?? []) {
        const fid = l.folio_id as string;
        const arr = linesByFolio.get(fid) ?? [];
        arr.push({
          id: (l.id as string) ?? "tmp",
          status: (l.status as string) ?? "posted",
          total_btn: Number(l.total_btn ?? 0),
          reverses_line_id: (l.reverses_line_id as string | null) ?? null,
        });
        linesByFolio.set(fid, arr);
      }
    }
    for (const b of bookingRows ?? []) {
      const fid = folioByBooking.get(b.id as string);
      const due = fid
        ? guestLedgerBalance(linesByFolio.get(fid) ?? [])
        : 0;
      if (Math.abs(due) > 0.5) {
        openStayDue += due;
        staySnaps.push({
          guest: (b.contact_name as string | null) ?? null,
          status: String(b.status ?? ""),
          dueBtn: due,
        });
      }
    }
  }

  const creditUsed = Number(agent.credit_used ?? 0);
  const creditLimit = Number(agent.credit_limit ?? 0);
  const dueBtn = Math.max(Math.abs(openStayDue), Math.abs(creditUsed));

  return runDraft({
    propertyId: input.propertyId,
    mode: "explain_agent_due",
    entityType: "agent",
    entityId: input.agentId,
    systemExtra: `Schema: {
  "dueBtn": number,
  "plainExplanation": string,
  "suggestedSteps": string[],
  "voidRepostPlaybook": string|null,
  "confidence": "high"|"medium"|"low"
}
Explain travel-agent credit / open stay dues for front desk. Suggest Collect via StayView Hub or Money tab. Never invent amounts — use the snapshot. Never say the system will auto-collect.`,
    user: JSON.stringify({
      company: agent.company_name,
      status: agent.status,
      contact: agent.contact_name,
      creditLimit,
      creditUsed,
      creditAvailable: Math.max(0, creditLimit - creditUsed),
      openRoomCap: Number(agent.open_room_cap ?? 0),
      openStayDueBtn: openStayDue,
      openStaysWithDue: staySnaps.slice(0, 12),
      dueBtn,
    }),
  });
}
