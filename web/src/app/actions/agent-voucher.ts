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
      `Property: ${property?.name ?? "Pelbu Suites"}`,
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
      property?.email ?? "Pelbu Suites",
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
