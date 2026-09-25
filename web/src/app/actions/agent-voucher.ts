"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

export type VoucherEmailState = {
  ok: boolean;
  message?: string;
  error?: string;
};

export async function sendAgentVoucher(
  _previous: VoucherEmailState,
  formData: FormData,
): Promise<VoucherEmailState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }
    const bookingId = String(formData.get("booking_id") ?? "").trim();
    if (!bookingId) throw new Error("Booking reference is required.");

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) throw new Error("Resend is not configured.");

    const admin = createSupabaseAdminClient();
    const { data: booking } = await admin
      .from("bookings")
      .select(
        "id, property_id, agent_id, contact_name, check_in, check_out, guide_number, properties(name, phone, email, address), agents(company_name, contact_name, contact_email)",
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking?.agent_id) throw new Error("This booking has no agent.");

    type AgentRow = {
      company_name: string;
      contact_name: string | null;
      contact_email: string | null;
    };
    type PropertyRow = {
      name: string;
      phone: string | null;
      email: string | null;
      address: string | null;
    };
    const agentRelation = booking.agents as AgentRow | AgentRow[] | null;
    const propertyRelation = booking.properties as
      | PropertyRow
      | PropertyRow[]
      | null;
    const agent = Array.isArray(agentRelation)
      ? agentRelation[0]
      : agentRelation;
    const property = Array.isArray(propertyRelation)
      ? propertyRelation[0]
      : propertyRelation;
    if (!agent) throw new Error("Agent record is unavailable.");
    const recipient = agent?.contact_email?.trim();
    if (!recipient) throw new Error("The selected agent has no email address.");

    const { data: rooms } = await admin
      .from("booking_rooms")
      .select("qty, room_types(name)")
      .eq("booking_id", bookingId);
    const roomSummary = (rooms ?? [])
      .map((room) => {
        const relation = room.room_types as
          | { name: string }
          | { name: string }[]
          | null;
        const roomType = Array.isArray(relation) ? relation[0] : relation;
        return `${Number(room.qty)} × ${roomType?.name ?? "Room"}`;
      })
      .join(", ");

    const text = [
      "AGENT BOOKING VOUCHER",
      "",
      `Property: ${property?.name ?? "Hotel"}`,
      property?.address ? `Address: ${property.address}` : null,
      property?.phone ? `Phone: ${property.phone}` : null,
      "",
      `Reference: ${booking.id as string}`,
      `Agent: ${agent.company_name}`,
      `Guest: ${(booking.contact_name as string | null) ?? "—"}`,
      `Stay: ${booking.check_in as string} to ${booking.check_out as string}`,
      roomSummary ? `Rooms: ${roomSummary}` : null,
      booking.guide_number
        ? `Guide number: ${booking.guide_number as string}`
        : null,
      "",
      "Present this voucher at check-in. Rates and taxes are settled on the folio.",
      "",
      property?.email ?? "Hotel",
    ]
      .filter(Boolean)
      .join("\n");

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL?.trim() ||
        "Pelbu Suites <onboarding@resend.dev>",
      to: [recipient],
      subject: `Booking voucher · ${booking.id.slice(0, 8)} · ${(booking.contact_name as string | null) ?? "Guest"}`,
      text,
    });
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId: booking.property_id as string,
      action: "booking.voucher_email",
      entityType: "bookings",
      entityId: booking.id as string,
      summary: `Voucher emailed to ${agent.company_name}`,
    });
    return { ok: true, message: `Voucher sent to ${recipient}.` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not send voucher.",
    };
  }
}

export type ConfirmationPackState = {
  ok: boolean;
  message?: string;
  error?: string;
};

/**
 * Email confirmation pack: voucher (no rates) + proforma (with rates).
 * Prefers agent contact email; falls back to booking contact_email.
 */
export async function sendConfirmationPack(
  _previous: ConfirmationPackState,
  formData: FormData,
): Promise<ConfirmationPackState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }
    const bookingId = String(formData.get("booking_id") ?? "").trim();
    if (!bookingId) throw new Error("Booking reference is required.");

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) throw new Error("Resend is not configured.");

    const admin = createSupabaseAdminClient();
    const { data: booking } = await admin
      .from("bookings")
      .select(
        "id, property_id, agent_id, contact_name, contact_email, confirmation_code, check_in, check_out, adults, children, rooms, meal_plan_code, guide_number, quoted_total_btn, payment_mode, properties(name, phone, email, address), agents(company_name, contact_name, contact_email)",
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) throw new Error("Booking not found.");

    type AgentRow = {
      company_name: string;
      contact_name: string | null;
      contact_email: string | null;
    };
    type PropertyRow = {
      name: string;
      phone: string | null;
      email: string | null;
      address: string | null;
    };
    const agentRelation = booking.agents as AgentRow | AgentRow[] | null;
    const propertyRelation = booking.properties as
      | PropertyRow
      | PropertyRow[]
      | null;
    const agent = Array.isArray(agentRelation)
      ? agentRelation[0]
      : agentRelation;
    const property = Array.isArray(propertyRelation)
      ? propertyRelation[0]
      : propertyRelation;

    const agentEmail = agent?.contact_email?.trim() || null;
    const guestEmail = (booking.contact_email as string | null)?.trim() || null;
    const recipient = agentEmail || guestEmail;
    if (!recipient) {
      throw new Error(
        "No email on file — add agent contact email or guest email first.",
      );
    }

    const { data: rooms } = await admin
      .from("booking_rooms")
      .select(
        "qty, occupancy, sheet_nightly_rate_btn, agreed_nightly_rate_btn, room_types(name)",
      )
      .eq("booking_id", bookingId);

    const roomLines = (rooms ?? []).map((room) => {
      const relation = room.room_types as
        | { name: string }
        | { name: string }[]
        | null;
      const roomType = Array.isArray(relation) ? relation[0] : relation;
      const nightly =
        room.agreed_nightly_rate_btn != null
          ? Number(room.agreed_nightly_rate_btn)
          : room.sheet_nightly_rate_btn != null
            ? Number(room.sheet_nightly_rate_btn)
            : null;
      return {
        name: roomType?.name ?? "Room",
        qty: Number(room.qty ?? 1),
        occupancy: (room.occupancy as string | null) ?? null,
        nightly,
      };
    });

    const roomSummary = roomLines
      .map((l) => `${l.qty} × ${l.name}`)
      .join(", ");
    const conf =
      (booking.confirmation_code as string | null)?.trim() ||
      (booking.id as string).slice(0, 8).toUpperCase();
    const guest = (booking.contact_name as string | null) ?? "Guest";
    const hotel = property?.name ?? "Hotel";

    const voucherBlock = [
      "—— VOUCHER (no rates — present at check-in) ——",
      `Property: ${hotel}`,
      property?.address ? `Address: ${property.address}` : null,
      property?.phone ? `Phone: ${property.phone}` : null,
      "",
      `Confirmation: ${conf}`,
      agent ? `Agent: ${agent.company_name}` : null,
      `Guest: ${guest}`,
      `Stay: ${booking.check_in as string} to ${booking.check_out as string}`,
      roomSummary ? `Rooms: ${roomSummary}` : null,
      booking.guide_number
        ? `Guide number: ${booking.guide_number as string}`
        : null,
      "",
      "Rates and taxes are on the proforma below / settled on the folio.",
    ]
      .filter(Boolean)
      .join("\n");

    const proformaLines = roomLines.map((l) => {
      const rate =
        l.nightly != null && Number.isFinite(l.nightly)
          ? `Nu ${Math.round(l.nightly).toLocaleString("en-BT")}/night`
          : "rate TBD";
      return `  ${l.qty} × ${l.name}${l.occupancy ? ` (${l.occupancy})` : ""} — ${rate}`;
    });

    const quoted =
      booking.quoted_total_btn != null
        ? Number(booking.quoted_total_btn)
        : null;

    const proformaBlock = [
      "—— PROFORMA (estimate — not a tax invoice) ——",
      `Confirmation: ${conf}`,
      `Guest: ${guest}`,
      `Stay: ${booking.check_in as string} to ${booking.check_out as string}`,
      booking.meal_plan_code
        ? `Meal plan: ${booking.meal_plan_code as string}`
        : null,
      `Adults: ${Number(booking.adults ?? 0)} · Children: ${Number(booking.children ?? 0)}`,
      "",
      "Rooms:",
      ...(proformaLines.length ? proformaLines : ["  (see desk)"]),
      "",
      quoted != null && Number.isFinite(quoted)
        ? `Quoted stay total: Nu ${Math.round(quoted).toLocaleString("en-BT")}`
        : "Quoted stay total: see desk",
      booking.payment_mode
        ? `Payment intent: ${String(booking.payment_mode).replace(/_/g, " ")}`
        : null,
      "",
      "This is a booking confirmation / proforma — tax invoice (INV-) issues from the folio.",
    ]
      .filter(Boolean)
      .join("\n");

    const text = [
      `${hotel.toUpperCase()} · CONFIRMATION PACK`,
      "",
      voucherBlock,
      "",
      proformaBlock,
      "",
      property?.email ?? hotel,
    ].join("\n");

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL?.trim() ||
        "Pelbu Suites <onboarding@resend.dev>",
      to: [recipient],
      subject: `Confirmation pack · ${conf} · ${guest}`,
      text,
    });
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId: booking.property_id as string,
      action: "booking.confirmation_pack_email",
      entityType: "bookings",
      entityId: booking.id as string,
      summary: `Confirmation pack emailed to ${recipient}`,
      meta: {
        include_voucher: true,
        include_proforma: true,
        via_agent: Boolean(agentEmail),
      },
    });

    return {
      ok: true,
      message: `Pack sent to ${recipient} (voucher + proforma).`,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not send confirmation pack.",
    };
  }
}
