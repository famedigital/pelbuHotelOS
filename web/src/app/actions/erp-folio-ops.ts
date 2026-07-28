"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
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

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

async function propertyId(admin: Admin) {
  return resolveActivePropertyId(admin);
}

function revalidateFolio(folioId?: string) {
  revalidatePath("/erp");
  revalidatePath("/erp/reports");
  revalidatePath("/erp/night-audit");
  revalidatePath("/erp/finance");
  if (folioId) revalidatePath(`/erp/folios/${folioId}`);
}

export async function voidFolioLine(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const lineId = trimRequired(formData.get("line_id"), "Line");
    const reason = trimRequired(formData.get("void_reason"), "Void reason");

    const { data: line, error } = await admin
      .from("folio_lines")
      .select("id, folio_id, status, description, total_btn, source_type")
      .eq("id", lineId)
      .single();
    if (error || !line) throw new Error("Folio line not found.");

    const { data: folio } = await admin
      .from("folios")
      .select("id, property_id, status")
      .eq("id", line.folio_id)
      .single();
    if (!folio || (folio.property_id as string) !== pid) {
      throw new Error("Folio line not found.");
    }
    if ((folio.status as string) !== "open") throw new Error("Folio is not open.");
    if ((line.status as string) === "voided") throw new Error("Already voided.");
    if ((line.source_type as string) === "payment") {
      throw new Error("Void payments via a refund adjustment — not line void.");
    }

    const { error: upd } = await admin
      .from("folio_lines")
      .update({
        status: "voided",
        void_reason: reason,
        voided_at: new Date().toISOString(),
        voided_by: "desk",
      })
      .eq("id", lineId);
    if (upd) throw new Error("Could not void line.");

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "folio.void",
      entityType: "folio_lines",
      entityId: lineId,
      summary: `Voided ${line.description} (${line.total_btn} Nu) · ${reason}`,
      meta: { folioId: line.folio_id, reason },
    });

    revalidateFolio(line.folio_id as string);
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
    await requireDesk();
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
    if ((folio.status as string) !== "open") throw new Error("Folio is not open.");

    const { data: line, error } = await admin
      .from("folio_lines")
      .insert({
        folio_id: folioId,
        booking_id: folio.booking_id,
        source_type: "comp",
        description: `Comp · ${reason}`,
        qty: 1,
        unit_price_btn: -amountBtn,
        amount_btn: -amountBtn,
        gst_applicable: false,
        gst_btn: 0,
        total_btn: -amountBtn,
        status: "posted",
        is_comp: true,
      })
      .select("id")
      .single();
    if (error || !line) {
      console.error("comp insert failed", error);
      throw new Error("Could not post comp.");
    }

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "folio.comp",
      entityType: "folio_lines",
      entityId: line.id as string,
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
    await requireDesk();
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
        .select("id, booking_id")
        .eq("id", folioId)
        .eq("property_id", pid)
        .single();
      if (!folio) throw new Error("Folio not found.");
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
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const linkId = trimRequired(formData.get("link_id"), "Link");
    const method = (optionalTrim(formData.get("method")) ?? "bank_qr").toLowerCase();
    if (!PAY_METHODS.has(method)) throw new Error("Invalid payment method.");
    const reference = optionalTrim(formData.get("reference"));

    const { data: link } = await admin
      .from("payment_links")
      .select("id, status, amount_btn, folio_id, booking_id, purpose")
      .eq("id", linkId)
      .eq("property_id", pid)
      .single();
    if (!link) throw new Error("Link not found.");
    if ((link.status as string) !== "open") throw new Error("Link is not open.");

    const amountBtn = roundBtn(Number(link.amount_btn));
    let paymentId: string | null = null;

    if (link.folio_id) {
      const { data: folio } = await admin
        .from("folios")
        .select("id, booking_id, status")
        .eq("id", link.folio_id)
        .single();
      if (!folio || (folio.status as string) !== "open") {
        throw new Error("Linked folio is not open.");
      }

      const { data: payment, error: payErr } = await admin
        .from("payments")
        .insert({
          property_id: pid,
          folio_id: link.folio_id,
          booking_id: folio.booking_id ?? link.booking_id,
          method,
          kind: link.purpose === "deposit" ? "deposit" : "settlement",
          amount_btn: amountBtn,
          reference,
          notes: `Payment link ${linkId}`,
        })
        .select("id")
        .single();
      if (payErr || !payment) throw new Error("Could not record payment.");
      paymentId = payment.id as string;

      await admin.from("folio_lines").insert({
        folio_id: link.folio_id,
        booking_id: folio.booking_id ?? link.booking_id,
        source_type: "deposit",
        source_id: paymentId,
        description: `Deposit · ${method}${reference ? ` · ${reference}` : ""}`,
        qty: 1,
        unit_price_btn: -amountBtn,
        amount_btn: -amountBtn,
        gst_applicable: false,
        gst_btn: 0,
        total_btn: -amountBtn,
        status: "posted",
      });
    } else {
      const { data: payment, error: payErr } = await admin
        .from("payments")
        .insert({
          property_id: pid,
          booking_id: link.booking_id,
          method,
          kind: "deposit",
          amount_btn: amountBtn,
          reference,
          notes: `Payment link ${linkId} (no folio)`,
        })
        .select("id")
        .single();
      if (payErr || !payment) throw new Error("Could not record payment.");
      paymentId = payment.id as string;
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
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function attachFolioToMaster(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const folioId = trimRequired(formData.get("folio_id"), "Folio");
    const masterId = trimRequired(formData.get("master_folio_id"), "Master folio");
    if (folioId === masterId) throw new Error("Cannot attach folio to itself.");

    const { data: rows } = await admin
      .from("folios")
      .select("id, status, folio_type")
      .eq("property_id", pid)
      .in("id", [folioId, masterId]);
    const folio = rows?.find((r) => r.id === folioId);
    const master = rows?.find((r) => r.id === masterId);
    if (!folio || !master) throw new Error("Folio not found.");
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
    return { ok: true, message: "Attached to master folio." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function runNightAudit(
  _prev: ErpFolioOpsState,
  formData: FormData,
): Promise<ErpFolioOpsState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const businessDate =
      optionalTrim(formData.get("business_date")) ??
      new Date().toISOString().slice(0, 10);
    const notes = optionalTrim(formData.get("notes"));

    const { data: existing } = await admin
      .from("night_audits")
      .select("id")
      .eq("property_id", pid)
      .eq("business_date", businessDate)
      .maybeSingle();
    if (existing) {
      throw new Error(`Night audit already run for ${businessDate}.`);
    }

    const nextDay = (() => {
      const d = new Date(`${businessDate}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    })();

    const [{ data: inHouse }, { data: openFolios }, { data: dayLines }] =
      await Promise.all([
        admin
          .from("bookings")
          .select("id, booking_rooms(qty, inventory_kind)")
          .eq("property_id", pid)
          .in("status", ["confirmed", "checked_in"])
          .lte("check_in", businessDate)
          .gt("check_out", businessDate),
        admin
          .from("folios")
          .select("id")
          .eq("property_id", pid)
          .eq("status", "open"),
        admin
          .from("folios")
          .select(
            "id, folio_lines(source_type, total_btn, status, created_at, is_comp)",
          )
          .eq("property_id", pid)
          .limit(400),
      ]);

    let roomsOccupied = 0;
    let roomsComp = 0;
    for (const b of inHouse ?? []) {
      for (const line of (b.booking_rooms as { qty: number; inventory_kind: string }[] | null) ?? []) {
        if (line.inventory_kind === "sellable_guest") {
          roomsOccupied += Number(line.qty);
        } else if (
          line.inventory_kind === "guide_comp" ||
          line.inventory_kind === "driver_comp"
        ) {
          roomsComp += Number(line.qty);
        }
      }
    }

    let charges = 0;
    let payments = 0;
    for (const f of dayLines ?? []) {
      for (const line of (f.folio_lines as {
        source_type: string;
        total_btn: number;
        status: string;
        created_at: string;
      }[] | null) ?? []) {
        if (line.status !== "posted") continue;
        const day = String(line.created_at).slice(0, 10);
        if (day !== businessDate) continue;
        const total = Number(line.total_btn);
        if (line.source_type === "payment" || line.source_type === "deposit") {
          payments += Math.abs(total);
        } else {
          charges += total;
        }
      }
    }

    const summary = {
      business_date: businessDate,
      next_day: nextDay,
      in_house_bookings: (inHouse ?? []).length,
    };

    const { data: audit, error } = await admin
      .from("night_audits")
      .insert({
        property_id: pid,
        business_date: businessDate,
        status: "completed",
        rooms_occupied: roomsOccupied,
        rooms_comp: roomsComp,
        folio_charges_btn: roundBtn(charges),
        folio_payments_btn: roundBtn(payments),
        open_folios: (openFolios ?? []).length,
        summary,
        run_by: "desk",
        notes,
      })
      .select("id")
      .single();
    if (error || !audit) {
      console.error("night_audits insert failed", error);
      throw new Error("Could not save night audit.");
    }

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "night_audit.run",
      entityType: "night_audits",
      entityId: audit.id as string,
      summary: `Night audit ${businessDate} · occ ${roomsOccupied} + comp ${roomsComp}`,
      meta: summary,
    });

    revalidateFolio();
    return {
      ok: true,
      message: `Night audit ${businessDate} complete.`,
      auditId: audit.id as string,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
