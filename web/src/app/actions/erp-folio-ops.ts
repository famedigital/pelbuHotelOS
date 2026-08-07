"use server";

import { writeAuditEvent } from "@/lib/audit";
import { resolveDeskActor } from "@/lib/desk/actor";
import { periodGuardFromForm } from "@/lib/accounting/period-guard-form";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { todayInTimezone } from "@/lib/erp-lists";
import { postFolioCharge } from "@/lib/folio/post-charge";
import { postExtraBedFolioLine } from "@/lib/folio/extra-bed";
import { postMealPlanFolioLine } from "@/lib/folio/meal-plan";
import { postFolioPaymentRecord } from "@/lib/folio/post-payment";
import { postOpenFolioGuestRateRoundAdj } from "@/lib/folio/rate-adj";
import {
  postRoomNightsForBooking,
  postRoomNightsForDate,
} from "@/lib/folio/room-night";
import {
  voidFolioLineWithReversal,
} from "@/lib/folio/void-line";
import { issueFiscalDocument } from "@/lib/fiscal/issue-document";
import { executeNightAudit } from "@/lib/night-audit/run";
import {
  claimPaymentLinkOpen,
  releasePaymentLinkClaim,
} from "@/lib/payments/claim-link";
import { roundBtn } from "@/lib/pricing";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { captureServerError } from "@/lib/observability";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type ErpFolioOpsState = {
  ok: boolean;
  error?: string;
  message?: string;
  token?: string;
  auditId?: string;
};

const PAY_METHODS = new Set([
  "cash",
  "bank",
  "card",
  "agent_credit",
  "bank_qr",
  "pay_bt",
  "deposit",
]);

async function requireMoney() {
  const { requireMoneyDesk } = await import("@/lib/desk-auth");
  await requireMoneyDesk();
}

async function propertyId(admin: Admin) {
  return resolveActivePropertyId(admin);
}

function revalidateFolio(folioId?: string) {
  revalidatePath("/erp");
  revalidatePath("/erp/reports");
  revalidatePath("/erp/night-audit");
  revalidatePath("/erp/finance");
  revalidatePath("/erp/invoices");
  if (folioId) revalidatePath(`/erp/folios/${folioId}`);
}

export async function voidFolioLine(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const lineId = trimRequired(formData.get("line_id"), "Line");
    const reasonBase = trimRequired(formData.get("void_reason"), "Void reason");
    const reasonDetail = optionalTrim(formData.get("void_reason_detail"));
    const reason = reasonDetail
      ? `${reasonBase} · ${reasonDetail}`
      : reasonBase;

    const { data: line, error } = await admin
      .from("folio_lines")
      .select("id, folio_id, status, description, total_btn, source_type, source_id, reverses_line_id, folios!inner(property_id)")
      .eq("id", lineId)
      .single();
    if (error || !line) throw new Error("Folio line not found.");
    const folioPropertyId = (line.folios as { property_id?: string } | null)
      ?.property_id;
    assertDeskProperty(pid, folioPropertyId, "Folio line");

    const { actor } = await resolveDeskActor();

    const result = await voidFolioLineWithReversal(admin, pid, {
      lineId,
      reason,
      voidedBy: actor,
      period_guard: periodGuardFromForm(formData, pid),
    });

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "folio.void",
      entityType: "folio_lines",
      entityId: lineId,
      summary: `Voided ${line.description} (${line.total_btn} Nu) · ${reason}`,
      meta: {
        folioId: result.folioId,
        reason,
        reversalLineId: result.reversalLineId,
        journalReversed: result.journalReversed,
        linkedVoided: result.linkedVoided,
      },
    });

    revalidateFolio(result.folioId);
    return { ok: true, message: "Line voided · balance updated." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function postGuestRoundFigureAdj(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const folioId = trimRequired(formData.get("folio_id"), "Folio");

    const { data: folio } = await admin
      .from("folios")
      .select("id, booking_id, status, property_id")
      .eq("id", folioId)
      .eq("property_id", pid)
      .single();
    if (!folio) throw new Error("Folio not found.");
    assertDeskProperty(pid, folio.property_id as string, "Folio");
    if ((folio.status as string) !== "open") throw new Error("Folio is not open.");

    const result = await postOpenFolioGuestRateRoundAdj(admin, pid, {
      folioId,
      bookingId: (folio.booking_id as string | null) ?? null,
      period_guard: periodGuardFromForm(formData, pid),
    });

    if (!result.lineId || result.absorbBtn >= -0.009) {
      revalidateFolio(folioId);
      return {
        ok: true,
        message: "Already whole Nu ending 0 or 5 — no rate adj needed.",
      };
    }

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "folio.rate_round_adj",
      entityType: "folio_lines",
      entityId: result.lineId,
      summary: `Rate adj · ${result.absorbBtn} Nu (charges ${result.chargesSumBtn} → ${result.targetBtn})`,
      meta: {
        folioId,
        absorbBtn: result.absorbBtn,
        chargesSumBtn: result.chargesSumBtn,
        targetBtn: result.targetBtn,
        streams: result.streams,
      },
    });

    revalidateFolio(folioId);
    return {
      ok: true,
      message: `Rounded Master / Room / F&B · adj ${result.absorbBtn} Nu · guest now Nu ${result.targetBtn}.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function postCompCredit(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const folioId = trimRequired(formData.get("folio_id"), "Folio");
    const reason = trimRequired(formData.get("comp_reason"), "Comp reason");
    const amount = Number(String(formData.get("amount_btn") ?? "").replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Comp amount must be positive.");
    }
    const amountBtn = roundBtn(amount);

    const { data: folio } = await admin
      .from("folios")
      .select("id, booking_id, status, property_id")
      .eq("id", folioId)
      .eq("property_id", pid)
      .single();
    if (!folio) throw new Error("Folio not found.");
    assertDeskProperty(pid, folio.property_id as string, "Folio");
    if ((folio.status as string) !== "open") throw new Error("Folio is not open.");

    const charge = await postFolioCharge(admin, pid, {
      folio_id: folioId,
      booking_id: folio.booking_id as string | null,
      source_type: "comp",
      description: `Comp · ${reason}`,
      qty: 1,
      unit_price_btn: -amountBtn,
      amount_btn: -amountBtn,
      gst_applicable: false,
      gst_btn: 0,
      total_btn: -amountBtn,
      is_comp: true,
      period_guard: periodGuardFromForm(formData, pid),
    });

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "folio.comp",
      entityType: "folio_lines",
      entityId: charge.lineId,
      summary: `Comp ${amountBtn} Nu · ${reason}`,
      meta: { folioId, reason },
    });

    revalidateFolio(folioId);
    return { ok: true, message: "Comp posted." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function createDepositLink(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const folioId = optionalTrim(formData.get("folio_id"));
    const bookingId = optionalTrim(formData.get("booking_id"));
    const amount = Number(String(formData.get("amount_btn") ?? "").replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Deposit amount must be positive.");
    }
    const amountBtn = roundBtn(amount);
    const purpose = (optionalTrim(formData.get("purpose")) ?? "deposit").toLowerCase();
    if (!["deposit", "balance", "agent_topup"].includes(purpose)) {
      throw new Error("Invalid purpose.");
    }

    if (folioId) {
      const { data: folio } = await admin
        .from("folios")
        .select("id, booking_id, property_id")
        .eq("id", folioId)
        .single();
      if (!folio) throw new Error("Folio not found.");
      assertDeskProperty(pid, folio.property_id as string, "Folio");
    }
    if (bookingId) {
      const { data: booking } = await admin
        .from("bookings")
        .select("id, property_id")
        .eq("id", bookingId)
        .single();
      if (!booking) throw new Error("Booking not found.");
      assertDeskProperty(pid, booking.property_id as string, "Booking");
    }

    const token = createHash("sha256")
      .update(randomBytes(24))
      .digest("hex")
      .slice(0, 24);

    const expires = new Date();
    expires.setDate(expires.getDate() + 7);

    const { data: link, error } = await admin
      .from("payment_links")
      .insert({
        property_id: pid,
        folio_id: folioId,
        booking_id: bookingId,
        token,
        amount_btn: amountBtn,
        purpose,
        payee_name: optionalTrim(formData.get("payee_name")),
        payee_phone: optionalTrim(formData.get("payee_phone")),
        bank_hint:
          optionalTrim(formData.get("bank_hint")) ??
          "BoB / BNB / TBank / DrukPNB — quote booking ref",
        expires_at: expires.toISOString(),
        notes: optionalTrim(formData.get("notes")),
        status: "open",
      })
      .select("id, token")
      .single();
    if (error || !link) {
      console.error("payment_links insert failed", error);
      throw new Error("Could not create deposit link.");
    }

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "deposit.link",
      entityType: "payment_links",
      entityId: link.id as string,
      summary: `Deposit link ${amountBtn} Nu`,
    });

    revalidateFolio(folioId ?? undefined);
    return {
      ok: true,
      message: "Deposit link created.",
      token: link.token as string,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function markDepositLinkPaid(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const linkId = trimRequired(formData.get("link_id"), "Link");
    const method = (optionalTrim(formData.get("method")) ?? "bank_qr").toLowerCase();
    if (!PAY_METHODS.has(method)) throw new Error("Invalid payment method.");
    const reference = optionalTrim(formData.get("reference"));

    const claim = await claimPaymentLinkOpen(admin, linkId, pid);
    if (!claim.ok) throw new Error(claim.error);
    if (!claim.claimed) {
      if (claim.reason === "already_paid") {
        return { ok: true, message: "Deposit already marked paid." };
      }
      if (claim.reason === "processing") {
        throw new Error("Link is being processed — wait and refresh.");
      }
      throw new Error("Link is not open.");
    }

    const link = claim.link;
    const amountBtn = roundBtn(Number(link.amount_btn));
    let paymentId: string | null = null;
    let claimed = true;

    try {
      if (link.folio_id) {
        const { data: folio } = await admin
          .from("folios")
          .select("id, booking_id, status, property_id")
          .eq("id", link.folio_id)
          .single();
        if (!folio) throw new Error("Linked folio not found.");
        assertDeskProperty(pid, folio.property_id as string, "Folio");
        if ((folio.status as string) !== "open") {
          throw new Error("Linked folio is not open.");
        }

        const pay = await postFolioPaymentRecord(admin, {
          property_id: pid,
          folio_id: link.folio_id as string,
          booking_id: (folio.booking_id ?? link.booking_id) as string | null,
          method,
          kind: link.purpose === "deposit" ? "deposit" : "settlement",
          amount_btn: amountBtn,
          reference,
          notes: `Payment link ${linkId}`,
          folio_line_source: "deposit",
          idempotency_key: `deposit_link:${linkId}`,
          period_guard: periodGuardFromForm(formData, pid),
        });
        paymentId = pay.paymentId;
      } else {
        const pay = await postFolioPaymentRecord(admin, {
          property_id: pid,
          booking_id: link.booking_id as string | null,
          method,
          kind: "deposit",
          amount_btn: amountBtn,
          reference,
          notes: `Payment link ${linkId} (no folio)`,
          idempotency_key: `deposit_link:${linkId}`,
          period_guard: periodGuardFromForm(formData, pid),
        });
        paymentId = pay.paymentId;
      }

      await admin
        .from("payment_links")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_id: paymentId,
        })
        .eq("id", linkId);

      await writeAuditEvent(admin, {
        propertyId: pid,
        action: "deposit.paid",
        entityType: "payment_links",
        entityId: linkId,
        summary: `Deposit paid ${amountBtn} Nu via ${method}`,
      });

      revalidateFolio((link.folio_id as string) ?? undefined);
      return { ok: true, message: "Deposit marked paid." };
    } catch (e) {
      if (claimed) {
        await releasePaymentLinkClaim(admin, linkId);
      }
      throw e;
    }
  } catch (e) {
    await captureServerError(e, { action: "markDepositLinkPaid" });
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function issueFolioInvoice(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const folioId = trimRequired(formData.get("folio_id"), "Folio");

    const doc = await issueFiscalDocument(admin, pid, {
      docKind: "invoice",
      folioId,
      issuedBy: "desk",
      periodGuard: periodGuardFromForm(formData, pid),
    });

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "fiscal.invoice.issue",
      entityType: "fiscal_documents",
      entityId: doc.id,
      summary: `Issued tax invoice ${doc.docNo}`,
      meta: { folioId, docNo: doc.docNo },
    });

    revalidateFolio(folioId);
    return { ok: true, message: `Tax invoice ${doc.docNo} issued.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function issueFolioReceipt(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const folioId = trimRequired(formData.get("folio_id"), "Folio");
    const paymentId = optionalTrim(formData.get("payment_id"));

    const doc = await issueFiscalDocument(admin, pid, {
      docKind: "receipt",
      folioId,
      paymentId,
      issuedBy: "desk",
      periodGuard: periodGuardFromForm(formData, pid),
    });

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "fiscal.receipt.issue",
      entityType: "fiscal_documents",
      entityId: doc.id,
      summary: `Issued receipt ${doc.docNo}`,
      meta: { folioId, paymentId, docNo: doc.docNo },
    });

    revalidateFolio(folioId);
    revalidatePath(`/erp/folios/${folioId}/receipt`);
    return {
      ok: true,
      message: `Receipt ${doc.docNo} issued.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function issueFolioCreditNote(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const folioId = trimRequired(formData.get("folio_id"), "Folio");

    const doc = await issueFiscalDocument(admin, pid, {
      docKind: "credit_note",
      folioId,
      issuedBy: "desk",
      periodGuard: periodGuardFromForm(formData, pid),
    });

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "fiscal.credit_note.issue",
      entityType: "fiscal_documents",
      entityId: doc.id,
      summary: `Issued credit note ${doc.docNo}`,
      meta: { folioId, docNo: doc.docNo },
    });

    revalidateFolio(folioId);
    revalidatePath(`/erp/invoices/${doc.id}/print`);
    return {
      ok: true,
      message: `Credit note ${doc.docNo} issued.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function attachFolioToMaster(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const folioId = trimRequired(formData.get("folio_id"), "Folio");
    const masterId = trimRequired(formData.get("master_folio_id"), "Master folio");
    if (folioId === masterId) throw new Error("Cannot attach folio to itself.");

    const { data: rows } = await admin
      .from("folios")
      .select("id, status, folio_type, property_id")
      .eq("property_id", pid)
      .in("id", [folioId, masterId]);
    const folio = rows?.find((r) => r.id === folioId);
    const master = rows?.find((r) => r.id === masterId);
    if (!folio || !master) throw new Error("Folio not found.");
    assertDeskProperty(pid, folio.property_id as string, "Folio");
    assertDeskProperty(pid, master.property_id as string, "Master folio");
    if ((folio.status as string) !== "open" || (master.status as string) !== "open") {
      throw new Error("Both folios must be open.");
    }

    const { error } = await admin
      .from("folios")
      .update({
        master_folio_id: masterId,
        folio_type: "guest",
      })
      .eq("id", folioId);
    if (error) throw new Error("Could not attach to master.");

    await admin
      .from("folios")
      .update({ folio_type: "master" })
      .eq("id", masterId);

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "folio.group",
      entityType: "folios",
      entityId: folioId,
      summary: `Attached folio to master ${masterId}`,
    });

    revalidateFolio(folioId);
    revalidateFolio(masterId);
    revalidatePath("/erp/folios");
    return { ok: true, message: "Attached to master folio." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Promote this open folio to a city-ledger / group master. */
export async function promoteFolioToMaster(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const folioId = trimRequired(formData.get("folio_id"), "Folio");

    const { data: folio } = await admin
      .from("folios")
      .select("id, status, folio_type, property_id, label")
      .eq("id", folioId)
      .single();
    if (!folio) throw new Error("Folio not found.");
    assertDeskProperty(pid, folio.property_id as string, "Folio");
    if ((folio.status as string) !== "open") {
      throw new Error("Only open folios can become masters.");
    }

    const { error } = await admin
      .from("folios")
      .update({ folio_type: "master", master_folio_id: null })
      .eq("id", folioId)
      .eq("property_id", pid);
    if (error) throw new Error("Could not promote folio.");

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "folio.promote_master",
      entityType: "folios",
      entityId: folioId,
      summary: `Promoted ${folio.label as string} to master / city ledger`,
    });

    revalidateFolio(folioId);
    revalidatePath("/erp/folios");
    return { ok: true, message: "Folio is now a master (city ledger)." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function transferFolioLine(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const lineId = trimRequired(formData.get("line_id"), "Line");
    const targetFolioId = trimRequired(formData.get("target_folio_id"), "Target folio");

    const { data: line } = await admin
      .from("folio_lines")
      .select(
        "id, folio_id, status, description, booking_id, folios!inner(property_id, status)",
      )
      .eq("id", lineId)
      .single();
    if (!line) throw new Error("Folio line not found.");
    assertDeskProperty(
      pid,
      (line.folios as { property_id?: string }).property_id,
      "Folio line",
    );
    if ((line.status as string) !== "posted") {
      throw new Error("Only posted lines can be transferred.");
    }

    const { data: target } = await admin
      .from("folios")
      .select("id, status, property_id, booking_id")
      .eq("id", targetFolioId)
      .eq("property_id", pid)
      .single();
    if (!target) throw new Error("Target folio not found.");
    assertDeskProperty(pid, target.property_id as string, "Target folio");
    if ((target.status as string) !== "open") {
      throw new Error("Target folio must be open.");
    }
    if (targetFolioId === (line.folio_id as string)) {
      throw new Error("Line is already on that folio.");
    }

    const { error } = await admin
      .from("folio_lines")
      .update({
        folio_id: targetFolioId,
        booking_id: target.booking_id ?? line.booking_id,
      })
      .eq("id", lineId);
    if (error) throw new Error("Could not transfer line.");

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "folio.transfer_line",
      entityType: "folio_lines",
      entityId: lineId,
      summary: `Transferred line to folio ${targetFolioId}`,
      meta: { from: line.folio_id, to: targetFolioId },
    });

    revalidateFolio(line.folio_id as string);
    revalidateFolio(targetFolioId);
    return { ok: true, message: "Line transferred." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function runNightAudit(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const property = await loadProperty(admin, pid);
    const businessDate =
      optionalTrim(formData.get("business_date")) ??
      todayInTimezone(property?.timezone);
    const notes = optionalTrim(formData.get("notes"));

    const result = await executeNightAudit(admin, pid, businessDate, {
      runBy: "desk",
      notes,
    });

    revalidateFolio();
    const parts = [
      `Occupancy ${result.roomsOccupied} sellable + ${result.roomsComp} comp`,
      result.posted > 0
        ? `${result.posted} room-night(s) posted`
        : result.skipped > 0
          ? `${result.skipped} room-night(s) already posted (skipped)`
          : "0 room-nights posted",
      `Open folios ${result.openFolios}`,
      `Day charges ${result.folioChargesBtn} Nu · payments ${result.folioPaymentsBtn} Nu`,
    ];
    if (result.roomNightErrors.length > 0) {
      parts.push(`${result.roomNightErrors.length} room-night error(s)`);
    }
    if (result.hotelBackup?.emailed) {
      parts.push("hotel backup emailed");
    } else if (result.hotelBackup && !result.hotelBackup.ok) {
      parts.push("hotel backup pack failed (audit still saved)");
    } else if (result.hotelBackup?.ok) {
      parts.push("hotel backup stored");
    }
    return {
      ok: true,
      message: `Night audit ${result.businessDate} complete — ${parts.join(" · ")}.`,
      auditId: result.auditId,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Submit bank/QR proof — creates pending_bank payment (no GL until confirmed). */
export async function submitBankPaymentProof(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const folioId = trimRequired(formData.get("folio_id"), "Folio");
    const method = (optionalTrim(formData.get("method")) ?? "bank_qr").toLowerCase();
    if (!["bank_qr", "bank"].includes(method)) {
      throw new Error("Proof flow supports bank QR or NEFT/bank transfer only.");
    }
    const amount = Number(String(formData.get("amount_btn") ?? "").replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Amount must be positive.");
    }
    const amountBtn = roundBtn(amount);
    const proofUrl = trimRequired(formData.get("proof_url"), "Payment screenshot");
    const reference = optionalTrim(formData.get("reference"));

    const { data: folio } = await admin
      .from("folios")
      .select("id, booking_id, status, property_id")
      .eq("id", folioId)
      .eq("property_id", pid)
      .single();
    if (!folio) throw new Error("Folio not found.");
    if ((folio.status as string) !== "open") throw new Error("Folio is not open.");

    const pay = await postFolioPaymentRecord(admin, {
      property_id: pid,
      folio_id: folioId,
      booking_id: folio.booking_id as string | null,
      method,
      amount_btn: amountBtn,
      kind: "settlement",
      reference,
      notes: "Awaiting bank confirmation (2–3 days)",
      confirmation_status: "pending_bank",
      proof_url: proofUrl,
      idempotency_key: `pending:${folioId}:${method}:${amountBtn}:${reference ?? "none"}`,
      period_guard: periodGuardFromForm(formData, pid),
    });

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "payment.proof_submitted",
      entityType: "payments",
      entityId: pay.paymentId,
      summary: `Bank proof ${amountBtn} Nu · pending`,
      meta: { folioId, method },
    });

    revalidateFolio(folioId);
    revalidatePath("/erp/finance/bank-proofs");
    return {
      ok: true,
      message: "Proof submitted — pending bank confirmation (2–3 days).",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Desk confirms pending bank payment → posts folio + GL + receipt path. */
export async function confirmPendingBankPayment(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const paymentId = trimRequired(formData.get("payment_id"), "Payment");

    const { data: payment } = await admin
      .from("payments")
      .select(
        "id, property_id, folio_id, booking_id, method, amount_btn, kind, reference, notes, confirmation_status",
      )
      .eq("id", paymentId)
      .eq("property_id", pid)
      .single();
    if (!payment) throw new Error("Payment not found.");
    if ((payment.confirmation_status as string) !== "pending_bank") {
      throw new Error("Payment is not pending bank confirmation.");
    }

    const amountBtn = roundBtn(Number(payment.amount_btn));
    const folioId = payment.folio_id as string | null;
    const reference = optionalTrim(formData.get("reference")) ?? (payment.reference as string | null);

    if (folioId) {
      const { data: folio } = await admin
        .from("folios")
        .select("id, status")
        .eq("id", folioId)
        .single();
      if (!folio || (folio.status as string) !== "open") {
        throw new Error("Linked folio is not open.");
      }

      const { error: lineError } = await admin.from("folio_lines").insert({
        folio_id: folioId,
        booking_id: payment.booking_id,
        source_type: "payment",
        source_id: paymentId,
        description: `Payment · ${payment.method}${reference ? ` · ${reference}` : ""}`,
        qty: 1,
        unit_price_btn: -amountBtn,
        amount_btn: -amountBtn,
        gst_applicable: false,
        gst_btn: 0,
        total_btn: -amountBtn,
        status: "posted",
      });
      if (lineError) throw new Error("Could not post payment to folio.");
    }

    const { postPayment } = await import("@/lib/accounting/posting");
    const gl = await postPayment(admin, pid, {
      id: paymentId,
      method: payment.method as string,
      kind: (payment.kind as string) ?? "settlement",
      amount_btn: amountBtn,
      notes: payment.notes as string | null,
      period_guard: periodGuardFromForm(formData, pid),
    });
    if (!gl.ok) {
      if (folioId) {
        await admin
          .from("folio_lines")
          .delete()
          .eq("source_type", "payment")
          .eq("source_id", paymentId);
      }
      throw new Error(gl.error ?? "Ledger posting failed.");
    }

    await admin
      .from("payments")
      .update({
        confirmation_status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: "desk",
        reference,
      })
      .eq("id", paymentId);

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "payment.bank_confirmed",
      entityType: "payments",
      entityId: paymentId,
      summary: `Confirmed bank payment ${amountBtn} Nu`,
      meta: { folioId },
    });

    revalidateFolio(folioId ?? undefined);
    revalidatePath("/erp/finance/bank-proofs");
    revalidatePath("/erp/payments");
    return {
      ok: true,
      message: folioId
        ? "Payment confirmed — issue receipt from folio."
        : "Payment confirmed.",
    };
  } catch (e) {
    await captureServerError(e, { action: "confirmPendingBankPayment" });
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Guest submits proof on deposit link → pending_bank. */
export async function submitPaymentLinkProof(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    const admin = createSupabaseAdminClient();
    const token = trimRequired(formData.get("token"), "Token");
    const proofUrl = trimRequired(formData.get("proof_url"), "Screenshot");
    const reference = optionalTrim(formData.get("proof_reference"));

    const { data: link } = await admin
      .from("payment_links")
      .select("id, property_id, status")
      .eq("token", token)
      .maybeSingle();
    if (!link) throw new Error("Payment link not found.");
    if ((link.status as string) !== "open") {
      throw new Error("This link is no longer open for proof upload.");
    }

    const { error } = await admin
      .from("payment_links")
      .update({
        status: "pending_bank",
        proof_url: proofUrl,
        proof_reference: reference,
        proof_submitted_at: new Date().toISOString(),
      })
      .eq("id", link.id);
    if (error) throw new Error(error.message);

    revalidatePath(`/pay/${token}`);
    revalidatePath("/erp/finance/bank-proofs");
    return {
      ok: true,
      message: "Screenshot received — desk confirms in 2–3 days.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Confirm deposit link that has pending_bank proof. */
export async function confirmPaymentLinkProof(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const linkId = trimRequired(formData.get("link_id"), "Link");
    const method = (optionalTrim(formData.get("method")) ?? "bank_qr").toLowerCase();
    const reference = optionalTrim(formData.get("reference"));

    const { data: link } = await admin
      .from("payment_links")
      .select("id, property_id, status, proof_reference")
      .eq("id", linkId)
      .eq("property_id", pid)
      .single();
    if (!link) throw new Error("Link not found.");
    if ((link.status as string) !== "pending_bank") {
      throw new Error("Link is not awaiting bank confirmation.");
    }

    if (reference) formData.set("reference", reference);
    else if (link.proof_reference) {
      formData.set("reference", link.proof_reference as string);
    }
    formData.set("link_id", linkId);
    formData.set("method", method);

    return markDepositLinkPaid({ ok: false }, formData);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/**
 * Post room-night charge(s) for a folio's booking on a business date.
 * Uses live `room_rates` (idempotent). Covers day-1 backfill when check-in
 * left the folio empty, or force-post before night audit.
 */
export async function postFolioRoomNight(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const property = await loadProperty(admin, pid);
    const folioId = trimRequired(formData.get("folio_id"), "Folio");
    const businessDate =
      optionalTrim(formData.get("business_date")) ??
      todayInTimezone(property?.timezone);

    const { data: folio } = await admin
      .from("folios")
      .select("id, status, booking_id, property_id, label")
      .eq("id", folioId)
      .single();
    if (!folio) throw new Error("Folio not found.");
    assertDeskProperty(pid, folio.property_id as string, "Folio");
    if ((folio.status as string) !== "open") {
      throw new Error("Folio must be open to post room nights.");
    }
    const bookingId = folio.booking_id as string | null;
    if (!bookingId) {
      throw new Error("This folio is not linked to a booking.");
    }

    const { data: booking } = await admin
      .from("bookings")
      .select("id, status, check_in, check_out")
      .eq("id", bookingId)
      .single();
    if (!booking) throw new Error("Booking not found.");
    if ((booking.status as string) !== "checked_in") {
      throw new Error("Booking must be checked in to post a room night.");
    }

    const result = await postRoomNightsForBooking(
      admin,
      pid,
      bookingId,
      businessDate,
    );

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "folio.post_room_night",
      entityType: "folios",
      entityId: folioId,
      summary: `Manual room night ${businessDate}: ${result.posted} posted, ${result.skipped} skipped`,
      meta: {
        businessDate,
        posted: result.posted,
        skipped: result.skipped,
        errors: result.errors,
      },
    });

    revalidateFolio(folioId);
    if (result.errors.length && result.posted === 0) {
      return {
        ok: false,
        error: result.errors.slice(0, 3).join(" · "),
      };
    }
    return {
      ok: true,
      message:
        result.posted > 0
          ? `Posted ${result.posted} room night(s) for ${businessDate}.`
          : result.skipped > 0
            ? `Room night already posted for ${businessDate}.`
            : "No sellable rooms to post for that date.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/**
 * Backfill check-in charges: meal plan (if priced) + day-1 room night.
 * Safe to re-run (both paths are idempotent).
 */
export async function postFolioCheckInCharges(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const folioId = trimRequired(formData.get("folio_id"), "Folio");

    const { data: folio } = await admin
      .from("folios")
      .select("id, status, booking_id, property_id")
      .eq("id", folioId)
      .single();
    if (!folio) throw new Error("Folio not found.");
    assertDeskProperty(pid, folio.property_id as string, "Folio");
    if ((folio.status as string) !== "open") {
      throw new Error("Folio must be open.");
    }
    const bookingId = folio.booking_id as string | null;
    if (!bookingId) throw new Error("Folio has no booking.");

    const { data: booking } = await admin
      .from("bookings")
      .select(
        "id, status, check_in, meal_plan_code, meal_plan_amount_btn, extra_beds, extra_bed_amount_btn, contact_name",
      )
      .eq("id", bookingId)
      .single();
    if (!booking) throw new Error("Booking not found.");
    if ((booking.status as string) !== "checked_in") {
      throw new Error("Only checked-in bookings can backfill day-1 charges.");
    }

    const notes: string[] = [];
    const mealAmount = Number(booking.meal_plan_amount_btn ?? 0);
    if (mealAmount > 0) {
      const { data: mealPlan } = await admin
        .from("meal_plans")
        .select("name")
        .eq("property_id", pid)
        .eq("code", booking.meal_plan_code as string)
        .maybeSingle();
      const meal = await postMealPlanFolioLine(admin, pid, {
        folioId,
        bookingId,
        mealPlanCode: (booking.meal_plan_code as string) ?? "EP",
        mealPlanName: (mealPlan?.name as string) ?? "Meals",
        mealPlanAmountBtn: mealAmount,
        businessDate: booking.check_in as string,
      });
      notes.push(meal.posted ? "meal plan posted" : "meal plan already on folio");
    } else {
      notes.push("no priced meal plan");
    }

    const extraBedAmount = Number(booking.extra_bed_amount_btn ?? 0);
    if (extraBedAmount > 0) {
      const bed = await postExtraBedFolioLine(admin, pid, {
        folioId,
        bookingId,
        extraBeds: Number(booking.extra_beds ?? 1),
        extraBedAmountBtn: extraBedAmount,
        businessDate: booking.check_in as string,
      });
      notes.push(bed.posted ? "extra bed posted" : "extra bed already on folio");
    }

    const room = await postRoomNightsForBooking(
      admin,
      pid,
      bookingId,
      booking.check_in as string,
    );
    if (room.posted > 0) notes.push(`${room.posted} room night(s)`);
    else if (room.skipped > 0) notes.push("room night already posted");
    else if (room.errors.length) notes.push(room.errors[0] ?? "room rate missing");
    else notes.push("no room night for arrival date");

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "folio.post_checkin_charges",
      entityType: "folios",
      entityId: folioId,
      summary: `Day-1 charges for ${booking.contact_name ?? bookingId}`,
      meta: { notes, roomErrors: room.errors },
    });

    revalidateFolio(folioId);
    if (room.errors.length && room.posted === 0 && mealAmount <= 0 && extraBedAmount <= 0) {
      return { ok: false, error: room.errors.slice(0, 2).join(" · ") };
    }
    return { ok: true, message: notes.join(" · ") };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** @deprecated use postFolioRoomNight — kept alias for clarity in call sites */
export async function postPropertyRoomNightsForDate(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireMoney();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const property = await loadProperty(admin, pid);
    const businessDate =
      optionalTrim(formData.get("business_date")) ??
      todayInTimezone(property?.timezone);
    const result = await postRoomNightsForDate(admin, pid, businessDate);
    revalidateFolio();
    return {
      ok: true,
      message: `Posted ${result.posted}, skipped ${result.skipped} for ${businessDate}.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
