"use server";

import { requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { loadPropertyPolicy } from "@/lib/policies/cancel-policy";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { trimRequired } from "@/lib/validation";
import { Resend } from "resend";

export type GuestPackEmailState = {
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

export async function sendGuestPackEmail(
  _prev: GuestPackEmailState,
  formData: FormData,
): Promise<GuestPackEmailState> {
  try {
    await requireMoneyDesk();
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) throw new Error("Email is not configured (RESEND_API_KEY).");

    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const admin = createSupabaseAdminClient();
    const pid = await resolveActivePropertyId(admin);

    const { data: booking } = await admin
      .from("bookings")
      .select(
        `id, property_id, contact_name, contact_email, check_in, check_out, meal_plan_code,
         room_assignments(room_units(label))`,
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) throw new Error("Booking not found.");
    assertDeskProperty(pid, booking.property_id as string, "Booking");

    const to = (booking.contact_email as string | null)?.trim();
    if (!to) throw new Error("No guest email on this booking.");

    const { data: property } = await admin
      .from("properties")
      .select("name, phone, email")
      .eq("id", pid)
      .maybeSingle();

    const policy = await loadPropertyPolicy(admin, pid);
    const { data: policyFull } = await admin
      .from("property_policies")
      .select("house_rules, dos, donts, wifi_name, wifi_password, check_in_time, check_out_time")
      .eq("property_id", pid)
      .maybeSingle();

    const { data: damageRows } = await admin
      .from("property_damage_items")
      .select("label, amount_btn")
      .eq("property_id", pid)
      .eq("is_active", true)
      .order("sort_order")
      .limit(20);

    const rooms = ((booking.room_assignments ?? []) as { room_units: { label: string } | { label: string }[] | null }[])
      .map((ra) => {
        const u = ra.room_units;
        if (Array.isArray(u)) return u[0]?.label;
        return u?.label;
      })
      .filter(Boolean) as string[];

    const lines: string[] = [
      `${property?.name ?? "Pelbu Suites"}`,
      `Welcome, ${booking.contact_name as string}`,
      "",
      `Stay: ${booking.check_in as string} → ${booking.check_out as string}`,
      rooms.length ? `Room(s): ${rooms.join(", ")}` : "",
      booking.meal_plan_code ? `Meal plan: ${booking.meal_plan_code as string}` : "",
      "",
      policy.guest_summary ? `Policy: ${policy.guest_summary}` : "",
      policyFull?.house_rules ? `\nHouse rules:\n${policyFull.house_rules as string}` : "",
      policyFull?.dos ? `\nPlease do:\n${policyFull.dos as string}` : "",
      policyFull?.donts ? `\nPlease don't:\n${policyFull.donts as string}` : "",
      policyFull?.wifi_name
        ? `\nWi-Fi: ${policyFull.wifi_name as string}${policyFull.wifi_password ? ` / ${policyFull.wifi_password as string}` : ""}`
        : "",
      "",
      "Damage charges (indicative):",
      ...(damageRows ?? []).map((d) =>
        `- ${d.label as string}: ${d.amount_btn != null ? `Nu ${d.amount_btn}` : "on assessment"}`,
      ),
      "",
      `Desk: ${[property?.phone, property?.email].filter(Boolean).join(" · ")}`,
    ].filter(Boolean);

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: resendFrom(),
      to: [to],
      subject: `Your stay at ${property?.name ?? "Pelbu Suites"} — guest information`,
      text: lines.join("\n"),
    });
    if (error) throw new Error("Could not send email.");

    return { ok: true, message: `Guest pack sent to ${to}.` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not email guest pack.",
    };
  }
}
