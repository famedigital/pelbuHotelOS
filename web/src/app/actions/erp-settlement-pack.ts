"use server";

import { writeAuditEvent } from "@/lib/audit";
import {
  bookingNeedsGuideCheckoutEvidence,
  guideEvidenceAllowsLeave,
  guideEvidenceBlockMessage,
} from "@/lib/agents/guide-checkout";
import { isDeskAuthenticated, requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";

export type GuideSignState = {
  ok: boolean;
  error?: string;
  message?: string;
  guideSignStatus?: string | null;
  guideSignPhotoPublicId?: string | null;
};

export type SealPackState = {
  ok: boolean;
  error?: string;
  message?: string;
  packId?: string;
};

function revalidateStay(bookingId: string) {
  revalidatePath("/erp", "layout");
  revalidatePath(`/erp/bookings/${bookingId}`);
  revalidatePath(`/erp/bookings/${bookingId}/settlement-pack`);
}

async function loadBookingForEvidence(admin: ReturnType<typeof createSupabaseAdminClient>, bookingId: string) {
  const propertyId = await resolveActivePropertyId(admin);
  const { data: booking, error } = await admin
    .from("bookings")
    .select(
      `id, property_id, status, contact_name, contact_email, check_in, check_out,
       rooms, guide_number, agent_id, payment_mode,
       guide_sign_status, guide_sign_photo_public_id, guide_sign_waive_reason,
       confirm_mode, advance_status, advance_due_btn,
       agents(company_name, contact_email, contact_name)`,
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (error || !booking) throw new Error("Booking not found.");
  assertDeskProperty(propertyId, booking.property_id as string, "Booking");
  return { propertyId, booking };
}

/** Attach guide-signed pack image (camera / scanner / file). */
export async function saveGuideSignPhoto(
  _prev: GuideSignState,
  formData: FormData,
): Promise<GuideSignState> {
  try {
    await requireMoneyDesk();
    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const publicId = trimRequired(
      formData.get("guide_sign_photo_public_id"),
      "Evidence file",
    );
    const admin = createSupabaseAdminClient();
    const { propertyId, booking } = await loadBookingForEvidence(admin, bookingId);

    const now = new Date().toISOString();
    const { error } = await admin
      .from("bookings")
      .update({
        guide_sign_status: "photo",
        guide_signed_at: now,
        guide_sign_photo_public_id: publicId,
        guide_sign_waive_reason: null,
      })
      .eq("id", bookingId);
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "booking.guide_sign_photo",
      entityType: "bookings",
      entityId: bookingId,
      summary: `Guide settlement evidence saved · ${(booking.contact_name as string) ?? "guest"}`,
      meta: { publicId },
    });
    revalidateStay(bookingId);
    return {
      ok: true,
      message: "Guide-signed paper on file — guests can leave.",
      guideSignStatus: "photo",
      guideSignPhotoPublicId: publicId,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not save evidence.",
    };
  }
}

/** FO waive when guide already left (logged reason). */
export async function waiveGuideSign(
  _prev: GuideSignState,
  formData: FormData,
): Promise<GuideSignState> {
  try {
    await requireMoneyDesk();
    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const reason = trimRequired(formData.get("waive_reason"), "Reason");
    if (reason.length < 4) throw new Error("Waive reason must be at least 4 characters.");

    const admin = createSupabaseAdminClient();
    const { propertyId, booking } = await loadBookingForEvidence(admin, bookingId);
    if (!bookingNeedsGuideCheckoutEvidence({ agentId: booking.agent_id as string | null })) {
      throw new Error("Guide evidence is not required for this stay.");
    }

    const now = new Date().toISOString();
    const { error } = await admin
      .from("bookings")
      .update({
        guide_sign_status: "waived",
        guide_signed_at: now,
        guide_sign_waive_reason: reason,
      })
      .eq("id", bookingId);
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "booking.guide_sign_waive",
      entityType: "bookings",
      entityId: bookingId,
      summary: `Guide sign waived · ${reason.slice(0, 80)}`,
      meta: { reason },
    });
    revalidateStay(bookingId);
    return {
      ok: true,
      message: "Guide sign waived — guests can leave.",
      guideSignStatus: "waived",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not waive.",
    };
  }
}

async function snapshotTotals(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  bookingId: string,
): Promise<Record<string, unknown>> {
  const snap = await loadFolioSettlementSnapshot(admin, bookingId);
  return {
    folioId: snap.folioId,
    folioLabel: snap.folioLabel,
    folioStatus: snap.folioStatus,
    chargesBtn: snap.chargesBtn,
    paymentsBtn: snap.paymentsBtn,
    balanceBtn: snap.balanceBtn,
    guestBalanceBtn: snap.guestBalanceBtn,
    agentChargesBtn: snap.agentChargesBtn,
    lineCount: snap.lines.length,
  };
}

export type SettlementPrintLine = {
  description: string;
  amountBtn: number;
  billTo: "guest" | "agent" | string;
  sourceType: string;
};

export type SettlementPrintProperty = {
  name: string;
  legalName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  logoPublicId: string | null;
};

/** Full A4 guide-sign pack payload (brand + stay + amounts). */
export type SettlementPrintPack = {
  bookingId: string;
  property: SettlementPrintProperty;
  guestName: string;
  guestPhone: string | null;
  confirmationCode: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  roomsBooked: number;
  roomLabels: string[];
  mealPlanCode: string | null;
  agentName: string | null;
  agentEmail: string | null;
  guideNumber: string | null;
  paymentMode: string | null;
  chargesBtn: number;
  paymentsBtn: number;
  balanceBtn: number;
  guestBalanceBtn: number;
  agentChargesBtn: number;
  lines: SettlementPrintLine[];
  asOfIso: string;
};

type FolioSettlementSnapshot = {
  folioId: string | null;
  folioLabel: string | null;
  folioStatus: string | null;
  chargesBtn: number;
  paymentsBtn: number;
  balanceBtn: number;
  guestBalanceBtn: number;
  agentChargesBtn: number;
  lines: SettlementPrintLine[];
};

async function loadFolioSettlementSnapshot(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  bookingId: string,
): Promise<FolioSettlementSnapshot> {
  const { data: folio } = await admin
    .from("folios")
    .select(
      "id, label, status, folio_lines(total_btn, status, source_type, description, bill_to)",
    )
    .eq("booking_id", bookingId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const raw =
    (folio?.folio_lines as
      | {
          total_btn: number;
          status: string;
          source_type?: string;
          description?: string;
          bill_to?: string;
        }[]
      | null) ?? [];
  const posted = raw.filter((l) => l.status === "posted");
  let charges = 0;
  let payments = 0;
  let guestBalance = 0;
  let agentCharges = 0;
  const lines: SettlementPrintLine[] = [];
  for (const l of posted) {
    const t = Number(l.total_btn);
    const st = (l.source_type ?? "").toLowerCase();
    const billTo = (l.bill_to ?? "guest").toLowerCase();
    if (st === "payment" || st === "deposit") {
      payments += t;
      if (billTo !== "agent") guestBalance += t;
    } else {
      charges += t;
      if (billTo === "agent") agentCharges += t;
      else guestBalance += t;
    }
    lines.push({
      description: (l.description || st || "Charge").toString(),
      amountBtn: t,
      billTo,
      sourceType: st || "charge",
    });
  }
  return {
    folioId: (folio?.id as string | null) ?? null,
    folioLabel: (folio?.label as string | null) ?? null,
    folioStatus: (folio?.status as string | null) ?? null,
    chargesBtn: charges,
    paymentsBtn: payments,
    balanceBtn: charges + payments,
    guestBalanceBtn: guestBalance,
    agentChargesBtn: agentCharges,
    lines,
  };
}

function nightsBetweenIso(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const t0 = new Date(`${checkIn}T00:00:00`).getTime();
  const t1 = new Date(`${checkOut}T00:00:00`).getTime();
  if (Number.isNaN(t0) || Number.isNaN(t1) || t1 <= t0) return 0;
  return Math.round((t1 - t0) / 86_400_000);
}

/** Brand + stay + live folio for FO guide-sign print. */
export async function loadSettlementPrintPack(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  bookingId: string,
  propertyId: string,
): Promise<SettlementPrintPack> {
  const [{ data: booking }, { data: property }, folio, { data: assigns }] =
    await Promise.all([
      admin
        .from("bookings")
        .select(
          `id, confirmation_code, contact_name, contact_phone, check_in, check_out,
           adults, children, rooms, meal_plan_code, guide_number, payment_mode,
           agents(company_name, contact_email)`,
        )
        .eq("id", bookingId)
        .maybeSingle(),
      admin
        .from("properties")
        .select(
          "name, legal_name, address, phone, email, tax_id, logo_public_id",
        )
        .eq("id", propertyId)
        .maybeSingle(),
      loadFolioSettlementSnapshot(admin, bookingId),
      admin
        .from("room_assignments")
        .select("room_units(label)")
        .eq("booking_id", bookingId),
    ]);

  if (!booking) throw new Error("Booking not found.");

  const agentRaw = booking.agents as
    | { company_name?: string; contact_email?: string }
    | { company_name?: string; contact_email?: string }[]
    | null;
  const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;

  const roomLabels = (
    (assigns ?? []) as Array<{
      room_units: { label?: string } | { label?: string }[] | null;
    }>
  )
    .map((a) => {
      const u = Array.isArray(a.room_units) ? a.room_units[0] : a.room_units;
      return u?.label;
    })
    .filter(Boolean) as string[];

  const checkIn = (booking.check_in as string) ?? "";
  const checkOut = (booking.check_out as string) ?? "";

  return {
    bookingId,
    property: {
      name: (property?.name as string) || "Pelbu Suites",
      legalName: (property?.legal_name as string | null) ?? null,
      address: (property?.address as string | null) ?? null,
      phone: (property?.phone as string | null) ?? null,
      email: (property?.email as string | null) ?? null,
      taxId: (property?.tax_id as string | null) ?? null,
      logoPublicId: (property?.logo_public_id as string | null) ?? null,
    },
    guestName: (booking.contact_name as string) || "Guest",
    guestPhone: (booking.contact_phone as string | null) ?? null,
    confirmationCode: (booking.confirmation_code as string | null) ?? null,
    checkIn,
    checkOut,
    nights: nightsBetweenIso(checkIn, checkOut),
    adults: Number(booking.adults ?? 0) || 0,
    children: Number(booking.children ?? 0) || 0,
    roomsBooked: Number(booking.rooms ?? roomLabels.length) || 0,
    roomLabels,
    mealPlanCode: (booking.meal_plan_code as string | null) ?? null,
    agentName: (agent?.company_name as string | undefined) ?? null,
    agentEmail: (agent?.contact_email as string | undefined) ?? null,
    guideNumber: (booking.guide_number as string | null) ?? null,
    paymentMode: (booking.payment_mode as string | null) ?? null,
    chargesBtn: folio.chargesBtn,
    paymentsBtn: folio.paymentsBtn,
    balanceBtn: folio.balanceBtn,
    guestBalanceBtn: folio.guestBalanceBtn,
    agentChargesBtn: folio.agentChargesBtn,
    lines: folio.lines.slice(0, 24),
    asOfIso: new Date().toISOString(),
  };
}
export async function sealBookingSettlementPack(
  _prev: SealPackState,
  formData: FormData,
): Promise<SealPackState> {
  try {
    await requireMoneyDesk();
    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const admin = createSupabaseAdminClient();
    const { propertyId, booking } = await loadBookingForEvidence(admin, bookingId);

    if (
      !guideEvidenceAllowsLeave({
        agentId: booking.agent_id as string | null,
        guideSignStatus: booking.guide_sign_status as string | null,
      })
    ) {
      throw new Error(guideEvidenceBlockMessage());
    }

    const totals = await snapshotTotals(admin, bookingId);
    const { data: pack, error } = await admin
      .from("booking_settlement_packs")
      .insert({
        property_id: propertyId,
        booking_id: bookingId,
        agent_id: (booking.agent_id as string | null) ?? null,
        totals_json: totals,
        guide_photo_public_id:
          (booking.guide_sign_photo_public_id as string | null) ?? null,
        guide_sign_status: (booking.guide_sign_status as string | null) ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "booking.settlement_pack_seal",
      entityType: "booking_settlement_packs",
      entityId: pack.id as string,
      summary: `Settlement pack sealed · ${(booking.contact_name as string) ?? bookingId}`,
      meta: totals,
    });
    revalidateStay(bookingId);
    return {
      ok: true,
      message: "Settlement pack sealed — download or email agent.",
      packId: pack.id as string,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not seal pack.",
    };
  }
}

export type EmailPackState = {
  ok: boolean;
  error?: string;
  message?: string;
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function resendFrom(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Pelbu Suites <onboarding@resend.dev>"
  );
}

/**
 * Email sealed pack summary + guide evidence link to agent.
 * Call after guest leave (or once evidence exists); not a leave gate.
 */
export async function emailBookingSettlementPack(
  _prev: EmailPackState,
  formData: FormData,
): Promise<EmailPackState> {
  try {
    if (!(await isDeskAuthenticated())) {
      throw new Error("Desk session expired. Sign in again.");
    }
    await requireMoneyDesk();
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) throw new Error("Email is not configured (RESEND_API_KEY).");

    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    let packId = optionalTrim(formData.get("pack_id"));
    let to = optionalTrim(formData.get("to"));

    const admin = createSupabaseAdminClient();
    const { propertyId, booking } = await loadBookingForEvidence(admin, bookingId);

    if (
      !guideEvidenceAllowsLeave({
        agentId: booking.agent_id as string | null,
        guideSignStatus: booking.guide_sign_status as string | null,
      })
    ) {
      throw new Error(guideEvidenceBlockMessage());
    }

    // Auto-seal latest if no pack id
    if (!packId) {
      const seal = await sealBookingSettlementPack(
        { ok: false },
        formData,
      );
      if (!seal.ok || !seal.packId) {
        throw new Error(seal.error ?? "Could not seal pack before email.");
      }
      packId = seal.packId;
    }

    const agentRaw = booking.agents as
      | { company_name?: string; contact_email?: string; contact_name?: string }
      | { company_name?: string; contact_email?: string; contact_name?: string }[]
      | null;
    const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;
    if (!to) {
      to =
        (agent?.contact_email as string | undefined)?.trim() ||
        (booking.contact_email as string | null)?.trim() ||
        null;
    }
    if (!to || !isEmail(to)) {
      throw new Error("Agent email missing — enter a valid address.");
    }

    const { data: pack } = await admin
      .from("booking_settlement_packs")
      .select("*")
      .eq("id", packId)
      .maybeSingle();
    if (!pack) throw new Error("Settlement pack not found.");

    const totals = (pack.totals_json ?? {}) as Record<string, number | string | null>;
    const photoId =
      (pack.guide_photo_public_id as string | null) ||
      (booking.guide_sign_photo_public_id as string | null);
    const photoUrl = photoId
      ? cloudinaryUrl(photoId, { width: 1200, crop: "limit" })
      : null;
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "https://www.pelbusuites.com";
    const packUrl = `${baseUrl}/erp/bookings/${bookingId}/settlement-pack`;

    const guest = (booking.contact_name as string) || "Guest";
    const company = agent?.company_name ?? "Agent";
    const subject = `Settlement pack · ${guest} · ${booking.check_in} → ${booking.check_out}`;

    const html = `
      <p>Dear ${company},</p>
      <p>Please find the settlement summary for <strong>${guest}</strong>
      (${booking.check_in} → ${booking.check_out}, ${booking.rooms ?? 1} room(s)).</p>
      <ul>
        <li>Charges: ${formatBtn(Number(totals.chargesBtn ?? 0))}</li>
        <li>Payments: ${formatBtn(Number(totals.paymentsBtn ?? 0))}</li>
        <li>Balance snapshot: ${formatBtn(Number(totals.balanceBtn ?? 0))}</li>
        <li>Guide evidence: ${pack.guide_sign_status ?? "—"}</li>
      </ul>
      ${photoUrl ? `<p><a href="${photoUrl}">Open guide-signed paper photo</a></p>` : ""}
      <p>Desk pack: <a href="${packUrl}">${packUrl}</a> (staff sign-in required).</p>
      <p>Thank you — Pelbu Suites Olakha</p>
    `;

    const resend = new Resend(apiKey);
    const { error: sendErr } = await resend.emails.send({
      from: resendFrom(),
      to: [to],
      subject,
      html,
    });
    if (sendErr) throw new Error(sendErr.message);

    await admin
      .from("booking_settlement_packs")
      .update({
        email_sent_at: new Date().toISOString(),
        email_to: to,
        email_error: null,
      })
      .eq("id", packId);

    await writeAuditEvent(admin, {
      propertyId,
      action: "booking.settlement_pack_email",
      entityType: "booking_settlement_packs",
      entityId: packId,
      summary: `Settlement pack emailed to ${to}`,
      meta: { to, packId },
    });
    revalidateStay(bookingId);
    return { ok: true, message: `Emailed settlement pack to ${to}.` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not email pack.",
    };
  }
}

export async function fetchBookingSettlementEvidence(bookingId: string): Promise<
  | {
      ok: true;
      data: {
        guideSignStatus: string | null;
        guideSignPhotoPublicId: string | null;
        guideSignWaiveReason: string | null;
        agentId: string | null;
        agentEmail: string | null;
        agentName: string | null;
        needsEvidence: boolean;
        canLeave: boolean;
        packs: Array<{
          id: string;
          sealedAt: string;
          emailSentAt: string | null;
          emailTo: string | null;
        }>;
        confirmMode: string;
        advanceStatus: string;
        advanceDueBtn: number | null;
        print: SettlementPrintPack;
      };
    }
  | { ok: false; error: string }
> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Desk session expired." };
    }
    const admin = createSupabaseAdminClient();
    const { propertyId, booking } = await loadBookingForEvidence(admin, bookingId);
    const agentRaw = booking.agents as
      | { company_name?: string; contact_email?: string }
      | { company_name?: string; contact_email?: string }[]
      | null;
    const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;
    const agentId = (booking.agent_id as string | null) ?? null;
    const guideSignStatus = (booking.guide_sign_status as string | null) ?? null;

    const [{ data: packs }, print] = await Promise.all([
      admin
        .from("booking_settlement_packs")
        .select("id, sealed_at, email_sent_at, email_to")
        .eq("booking_id", bookingId)
        .order("sealed_at", { ascending: false })
        .limit(10),
      loadSettlementPrintPack(admin, bookingId, propertyId),
    ]);

    return {
      ok: true,
      data: {
        guideSignStatus,
        guideSignPhotoPublicId:
          (booking.guide_sign_photo_public_id as string | null) ?? null,
        guideSignWaiveReason:
          (booking.guide_sign_waive_reason as string | null) ?? null,
        agentId,
        agentEmail: (agent?.contact_email as string | undefined) ?? null,
        agentName: (agent?.company_name as string | undefined) ?? null,
        needsEvidence: bookingNeedsGuideCheckoutEvidence({ agentId }),
        canLeave: guideEvidenceAllowsLeave({ agentId, guideSignStatus }),
        packs: (packs ?? []).map((p) => ({
          id: p.id as string,
          sealedAt: p.sealed_at as string,
          emailSentAt: (p.email_sent_at as string | null) ?? null,
          emailTo: (p.email_to as string | null) ?? null,
        })),
        confirmMode: (booking as { confirm_mode?: string }).confirm_mode ?? "soft",
        advanceStatus: (booking as { advance_status?: string }).advance_status ?? "none",
        advanceDueBtn:
          (booking as { advance_due_btn?: number | null }).advance_due_btn != null
            ? Number((booking as { advance_due_btn?: number }).advance_due_btn)
            : null,
        print,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not load evidence.",
    };
  }
}
