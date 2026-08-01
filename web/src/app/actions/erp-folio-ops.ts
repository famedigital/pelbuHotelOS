"use server";

import { writeAuditEvent } from "@/lib/audit";
import { resolveDeskActor } from "@/lib/desk/actor";
import { periodGuardFromForm } from "@/lib/accounting/period-guard-form";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { todayInTimezone } from "@/lib/erp-lists";
import { postFolioCharge } from "@/lib/folio/post-charge";
import { postFolioPaymentRecord } from "@/lib/folio/post-payment";
import { voidFolioLineWithReversal } from "@/lib/folio/void-line";
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
    const reason = trimRequired(formData.get("void_reason"), "Void reason");

    const { data: line, error } = await admin
      .from("folio_lines")
      .select("id, folio_id, status, description, total_btn, source_type, folios!inner(property_id)")
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
      },
    });

    revalidateFolio(result.folioId);
    return { ok: true, message: "Line voided." };
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
    return {
      ok: true,
      message: `Night audit ${result.businessDate} complete — ${parts.join(" · ")}.`,
      auditId: result.auditId,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
