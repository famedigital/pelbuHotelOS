"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { verifyManagerPinForProperty } from "@/lib/manager-pin";
import { emailGuestRatePromo } from "@/lib/notify";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type GuestRatePromoState = {
  ok: boolean;
  error?: string;
  message?: string;
  code?: string;
};

function slugCodeFromName(name: string): string {
  const base =
    name
      .normalize("NFKD")
      .replace(/[^\w\s]/g, "")
      .trim()
      .split(/\s+/)[0]
      ?.replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 6) || "GUEST";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${suffix}`.slice(0, 16);
}

/**
 * Create a personal promo (nightly_rate_btn) from an in-house agreed rate
 * and email the guest so they can self-book on /book next time.
 */
export async function issueGuestRatePromo(
  _prev: GuestRatePromoState,
  formData: FormData,
): Promise<GuestRatePromoState> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired." };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const pin = trimRequired(formData.get("manager_pin"), "Manager PIN");
    const email = trimRequired(formData.get("email"), "Guest email");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "Enter a valid email address." };
    }

    const rateRaw = trimRequired(
      formData.get("nightly_rate_btn"),
      "Nightly rate",
    );
    const nightly = Number(rateRaw);
    if (!Number.isFinite(nightly) || nightly < 0 || nightly > 500_000) {
      return { ok: false, error: "Enter a valid nightly rate (BTN)." };
    }
    const agreed = Math.round(nightly * 100) / 100;

    const maxStaysRaw = optionalTrim(formData.get("max_stays"));
    let maxRedemptions: number | null = 5;
    if (maxStaysRaw != null && maxStaysRaw !== "") {
      const n = Number(maxStaysRaw);
      if (!Number.isInteger(n) || n < 1 || n > 100) {
        return { ok: false, error: "Max stays must be 1–100." };
      }
      maxRedemptions = n;
    }

    const monthsRaw = optionalTrim(formData.get("valid_months"));
    let endsAt: string | null = null;
    let expiresLabel: string | null = null;
    if (monthsRaw != null && monthsRaw !== "") {
      const months = Number(monthsRaw);
      if (!Number.isFinite(months) || months < 1 || months > 36) {
        return { ok: false, error: "Valid months must be 1–36." };
      }
      const d = new Date();
      d.setMonth(d.getMonth() + Math.floor(months));
      endsAt = d.toISOString();
      expiresLabel = d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }

    const customCode = optionalTrim(formData.get("code"));
    const sendEmail = formData.get("send_email") !== "0";
    const alsoSetOnBooking = formData.get("set_on_booking") !== "0";

    const verified = await verifyManagerPinForProperty(admin, propertyId, pin);
    if (!verified.ok) {
      return { ok: false, error: verified.error };
    }

    const { data: booking, error: loadErr } = await admin
      .from("bookings")
      .select("id, contact_name, contact_email, status, agreed_nightly_rate_btn")
      .eq("id", bookingId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (loadErr || !booking) {
      return { ok: false, error: loadErr?.message ?? "Booking not found." };
    }

    const guestName = (booking.contact_name as string | null)?.trim() || "Guest";
    let code =
      (customCode?.toUpperCase().replace(/[^A-Z0-9_-]/g, "") ||
        slugCodeFromName(guestName)) || "GUEST";
    if (code.length < 3) code = slugCodeFromName(guestName);

    // Ensure unique code on property
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const tryCode = attempt === 0 ? code : slugCodeFromName(guestName);
      const { data: existing } = await admin
        .from("promo_codes")
        .select("id")
        .eq("property_id", propertyId)
        .eq("code", tryCode)
        .maybeSingle();
      if (!existing) {
        code = tryCode;
        break;
      }
      if (attempt === 5) {
        return {
          ok: false,
          error: "Could not generate a unique code — try a custom one.",
        };
      }
    }

    const approvedBy =
      verified.source === "staff"
        ? `staff:${verified.staffId}:${verified.fullName}`
        : "env_manager_pin";

    const notes = `Guest rate for ${guestName} (booking ${bookingId.slice(0, 8)}) · Nu ${agreed}/night · issued by ${approvedBy}`;

    const { data: promo, error: insErr } = await admin
      .from("promo_codes")
      .insert({
        property_id: propertyId,
        code,
        name: `Guest rate · ${guestName}`,
        benefit_type: "nightly_rate_btn",
        benefit_value: agreed,
        max_redemptions: maxRedemptions,
        max_per_guest: null,
        min_nights: 0,
        min_spend_btn: 0,
        starts_at: new Date().toISOString(),
        ends_at: endsAt,
        applies_to: ["rooms"],
        channels: ["public_book"],
        stackable_with_partner: false,
        active: true,
        notes,
      })
      .select("id, code")
      .single();
    if (insErr || !promo) {
      return { ok: false, error: insErr?.message ?? "Could not create promo." };
    }

    if (alsoSetOnBooking) {
      await admin
        .from("bookings")
        .update({
          agreed_nightly_rate_btn: agreed,
          agreed_rate_reason: `Guest rate code ${code}`,
          agreed_rate_set_at: new Date().toISOString(),
          agreed_rate_set_by: approvedBy,
          contact_email: email,
        })
        .eq("id", bookingId)
        .eq("property_id", propertyId);
    } else {
      await admin
        .from("bookings")
        .update({ contact_email: email })
        .eq("id", bookingId)
        .eq("property_id", propertyId)
        .is("contact_email", null);
    }

    let emailNote = "Email was not requested.";
    if (sendEmail) {
      try {
        await emailGuestRatePromo({
          to: email,
          guestName,
          code: promo.code as string,
          nightlyRateBtn: agreed,
          maxStays: maxRedemptions,
          expiresLabel,
        });
        emailNote = `Emailed to ${email}.`;
      } catch (mailErr) {
        emailNote = `Code saved but email failed: ${
          mailErr instanceof Error ? mailErr.message : "send error"
        }. Share the code manually.`;
      }
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "marketing.guest_rate_promo.issue",
      entityType: "promo_codes",
      entityId: promo.id as string,
      summary: `Guest rate code ${promo.code} · Nu ${agreed}/night · ${guestName}${sendEmail ? ` · ${emailNote}` : ""}`,
      meta: {
        booking_id: bookingId,
        code: promo.code,
        nightly_rate_btn: agreed,
        emailed: sendEmail,
        email,
      },
    });

    revalidatePath("/erp/marketing");
    revalidatePath(`/erp/bookings/${bookingId}`);

    return {
      ok: true,
      code: promo.code as string,
      message: `Code ${promo.code} · Nu ${agreed}/night. ${emailNote} Guest enters it on /book → contact step.`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not issue guest rate code.",
    };
  }
}
