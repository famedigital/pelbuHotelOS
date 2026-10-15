"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated, requirePosSettleDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { buildPosReceiptMessage } from "@/lib/pos-receipt-message";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { Resend } from "resend";

export type PosReceiptEmailState = {
  ok: boolean;
  error?: string;
  message?: string;
};

function resendFrom(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Pelbu Suites <onboarding@resend.dev>"
  );
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Email a POS ticket receipt summary via Resend (plain text).
 * Form: order_id, to, optional recipient_name.
 */
export async function emailPosOrderReceipt(
  _prev: PosReceiptEmailState,
  formData: FormData,
): Promise<PosReceiptEmailState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }
    await requirePosSettleDesk();

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("Email is not configured (RESEND_API_KEY).");
    }

    const orderId = trimRequired(formData.get("order_id"), "Order");
    const to = optionalTrim(formData.get("to"));
    const recipientName = optionalTrim(formData.get("recipient_name"));

    if (!to || !isEmail(to)) {
      throw new Error("Enter a valid guest email address.");
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);

    const { data: order } = await admin
      .from("orders")
      .select(
        `id, property_id, outlet, customer_name, phone, subtotal_btn, service_charge_btn,
         gst_btn, total_btn, created_at, settled_at, voided_at,
         order_items(name_snapshot, qty, unit_price_btn, voided_at),
         order_tenders(method, amount_btn, reference)`,
      )
      .eq("id", orderId)
      .maybeSingle();

    if (!order) throw new Error("Order not found.");
    assertDeskProperty(propertyId, order.property_id as string, "Order");
    if (order.voided_at) throw new Error("This ticket was voided.");

    const { data: property } = await admin
      .from("properties")
      .select("name, legal_name, email")
      .eq("id", propertyId)
      .maybeSingle();

    const lines = (
      (order.order_items as
        | {
            name_snapshot: string;
            qty: number;
            unit_price_btn: number;
            voided_at: string | null;
          }[]
        | null) ?? []
    )
      .filter((line) => !line.voided_at)
      .map((line) => {
        const qty = Number(line.qty);
        const unit = Number(line.unit_price_btn);
        return {
          name: line.name_snapshot,
          qty,
          unitPriceBtn: unit,
          lineTotalBtn: Math.round(qty * unit * 100) / 100,
        };
      });

    const tenders = (
      (order.order_tenders as
        | { method: string; amount_btn: number; reference: string | null }[]
        | null) ?? []
    ).map((t) => ({
      method: t.method,
      amountBtn: Number(t.amount_btn),
      reference: t.reference ?? null,
    }));

    const brand = (property?.name as string | null)?.trim() || "Hotel";
    const guest =
      recipientName ||
      ((order.customer_name as string | null)?.trim() || "Guest");
    const unpaid = !order.settled_at;

    const body = buildPosReceiptMessage({
      propertyName: brand,
      orderId: order.id as string,
      customerName: guest,
      outlet: (order.outlet as string | null) ?? null,
      createdAt: (order.created_at as string | null) ?? null,
      settledAt: (order.settled_at as string | null) ?? null,
      subtotalBtn: Number(order.subtotal_btn ?? 0),
      serviceChargeBtn: Number(order.service_charge_btn ?? 0),
      gstBtn: Number(order.gst_btn ?? 0),
      totalBtn: Number(order.total_btn ?? 0),
      lines,
      tenders,
      unpaid,
    });

    const greeting = `Dear ${guest},`;
    const text = [
      greeting,
      "",
      body,
      "",
      "This message is an office copy from the desk.",
      property?.email ? `Queries: ${property.email}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: resendFrom(),
      to: [to],
      subject: `${unpaid ? "Order" : "Receipt"} · ${orderId.slice(0, 8)} · ${brand}`,
      text,
    });
    if (error) throw new Error(error.message || "Could not send email.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "pos.receipt.email",
      entityType: "orders",
      entityId: orderId,
      summary: `POS receipt emailed to ${to}`,
      meta: { to, unpaid },
    });

    return { ok: true, message: `Sent to ${to}.` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not send email.",
    };
  }
}
