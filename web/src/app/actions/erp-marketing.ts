"use server";

import { writeAuditEvent } from "@/lib/audit";
import {
  isDeskAuthenticated,
  requireDeskRole,
  type DeskRole,
} from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import {
  MARKETING_EMAIL_BATCH_MAX,
  sendMarketingBroadcast,
} from "@/lib/marketing/email-broadcast";
import { getMetaTokenConfig, postFacebookPageFeed } from "@/lib/marketing/meta-share";
import { recordNcEvent } from "@/lib/marketing/nc";
import {
  previewPromoCode,
  redeemPromoCode,
  type PromoChannel,
  type PromoDomain,
} from "@/lib/marketing/promo";
import { verifyManagerPinForProperty } from "@/lib/manager-pin";
import {
  agentRateTier,
  lookupRoomRateBtn,
  nightsBetween,
  resolveSeasonKind,
  type RateTier,
} from "@/lib/rates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type MarketingState = {
  ok: boolean;
  error?: string;
  id?: string;
  message?: string;
};

const OWNER_GM: DeskRole[] = ["owner", "gm"];

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function parseCsvList(raw: FormDataEntryValue | null, fallback: string[]): string[] {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  return raw
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseTags(raw: FormDataEntryValue | null): string[] {
  return parseCsvList(raw, []).map((t) => t.toLowerCase().replace(/\s+/g, "_"));
}

function revalidateMarketing() {
  revalidatePath("/erp/marketing");
  revalidatePath("/erp/marketing/coupons");
  revalidatePath("/erp/marketing/campaigns");
  revalidatePath("/erp/marketing/nc");
  revalidatePath("/erp/pos");
}

export async function upsertCampaign(
  _prev: MarketingState,
  formData: FormData,
): Promise<MarketingState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const id = optionalTrim(formData.get("campaign_id"));
    const name = trimRequired(formData.get("name"), "Name");
    const objective = optionalTrim(formData.get("objective")) ?? "other";
    const status = optionalTrim(formData.get("status")) ?? "active";
    const startsAt = optionalTrim(formData.get("starts_at"));
    const endsAt = optionalTrim(formData.get("ends_at"));
    const notes = optionalTrim(formData.get("notes"));
    const influencerLabel = optionalTrim(formData.get("influencer_label"));
    const budgetRaw = optionalTrim(formData.get("budget_btn"));
    const budget =
      budgetRaw == null || budgetRaw === "" ? null : Number(budgetRaw);
    if (budget != null && (!Number.isFinite(budget) || budget < 0)) {
      throw new Error("Budget must be a non-negative number.");
    }
    const metaPostUrl = optionalTrim(formData.get("meta_post_url"));
    const igHandle = optionalTrim(formData.get("ig_handle"));
    const metaPostedAt = optionalTrim(formData.get("meta_posted_at"));
    const metaPostNotes = optionalTrim(formData.get("meta_post_notes"));

    const payload = {
      property_id: propertyId,
      name,
      objective,
      status,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      notes,
      influencer_label: influencerLabel,
      budget_btn: budget,
      meta_post_url: metaPostUrl,
      ig_handle: igHandle,
      meta_posted_at: metaPostedAt ? new Date(metaPostedAt).toISOString() : null,
      meta_post_notes: metaPostNotes,
      updated_at: new Date().toISOString(),
    };

    let campaignId = id;
    if (id) {
      const { error } = await admin
        .from("marketing_campaigns")
        .update(payload)
        .eq("id", id)
        .eq("property_id", propertyId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await admin
        .from("marketing_campaigns")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Insert failed.");
      campaignId = data.id as string;
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: id ? "marketing.campaign.update" : "marketing.campaign.create",
      entityType: "marketing_campaigns",
      entityId: campaignId!,
      summary: `${id ? "Updated" : "Created"} campaign ${name}`,
    });

    revalidateMarketing();
    return { ok: true, id: campaignId ?? undefined, message: "Campaign saved." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function upsertPromoCode(
  _prev: MarketingState,
  formData: FormData,
): Promise<MarketingState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const id = optionalTrim(formData.get("promo_id"));
    const code = trimRequired(formData.get("code"), "Code").toUpperCase();
    const name = trimRequired(formData.get("name"), "Name");
    const benefitType = trimRequired(formData.get("benefit_type"), "Benefit type");
    if (
      benefitType !== "pct" &&
      benefitType !== "fixed_btn" &&
      benefitType !== "nightly_rate_btn"
    ) {
      throw new Error(
        "Benefit type must be pct, fixed_btn, or nightly_rate_btn (guest rate).",
      );
    }
    const benefitValue = Number(
      trimRequired(formData.get("benefit_value"), "Benefit value"),
    );
    if (!Number.isFinite(benefitValue) || benefitValue < 0) {
      throw new Error("Benefit value must be non-negative.");
    }
    if (benefitType === "pct" && benefitValue > 100) {
      throw new Error("Percent benefit cannot exceed 100.");
    }
    if (benefitType === "nightly_rate_btn" && benefitValue > 500_000) {
      throw new Error("Nightly rate looks too high — check the figure.");
    }
    const campaignId = optionalTrim(formData.get("campaign_id"));
    const maxRedemptionsRaw = optionalTrim(formData.get("max_redemptions"));
    const maxRedemptions =
      maxRedemptionsRaw == null || maxRedemptionsRaw === ""
        ? null
        : Number(maxRedemptionsRaw);
    if (
      maxRedemptions != null &&
      (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)
    ) {
      throw new Error("Max redemptions must be a positive integer.");
    }
    const maxPerGuestRaw = optionalTrim(formData.get("max_per_guest"));
    const maxPerGuest =
      maxPerGuestRaw == null || maxPerGuestRaw === ""
        ? null
        : Number(maxPerGuestRaw);
    const maxDiscountRaw = optionalTrim(formData.get("max_discount_btn"));
    const maxDiscount =
      maxDiscountRaw == null || maxDiscountRaw === ""
        ? null
        : Number(maxDiscountRaw);
    const minSpend = Number(optionalTrim(formData.get("min_spend_btn")) ?? "0");
    const minNights = Number(optionalTrim(formData.get("min_nights")) ?? "0");
    const startsAt = optionalTrim(formData.get("starts_at"));
    const endsAt = optionalTrim(formData.get("ends_at"));
    const appliesTo = parseCsvList(formData.get("applies_to"), [
      "rooms",
      "pos",
    ]);
    const channels = parseCsvList(formData.get("channels"), [
      "public_book",
      "desk_pos",
    ]);
    const stackable = formData.get("stackable_with_partner") === "1";
    const activeRaw = formData.get("active");
    const active =
      activeRaw == null || activeRaw === ""
        ? true
        : activeRaw !== "0" && activeRaw !== "off";
    const notes = optionalTrim(formData.get("notes"));

    const payload = {
      property_id: propertyId,
      campaign_id: campaignId,
      code,
      name,
      benefit_type: benefitType,
      benefit_value: benefitValue,
      max_redemptions: maxRedemptions,
      max_per_guest: maxPerGuest,
      max_discount_btn: maxDiscount,
      min_spend_btn: Number.isFinite(minSpend) ? Math.max(0, minSpend) : 0,
      min_nights: Number.isFinite(minNights)
        ? Math.max(0, Math.floor(minNights))
        : 0,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      applies_to: appliesTo,
      channels,
      stackable_with_partner: stackable,
      active,
      notes,
      updated_at: new Date().toISOString(),
    };

    let promoId = id;
    if (id) {
      const { error } = await admin
        .from("promo_codes")
        .update(payload)
        .eq("id", id)
        .eq("property_id", propertyId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await admin
        .from("promo_codes")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Insert failed.");
      promoId = data.id as string;
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: id ? "marketing.promo.update" : "marketing.promo.create",
      entityType: "promo_codes",
      entityId: promoId!,
      summary: `${id ? "Updated" : "Created"} promo ${code}`,
    });

    revalidateMarketing();
    return { ok: true, id: promoId ?? undefined, message: `Promo ${code} saved.` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function upsertNcReason(
  _prev: MarketingState,
  formData: FormData,
): Promise<MarketingState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const id = optionalTrim(formData.get("reason_id"));
    const code = trimRequired(formData.get("code"), "Code")
      .toLowerCase()
      .replace(/\s+/g, "_");
    const label = trimRequired(formData.get("label"), "Label");
    const domains = parseCsvList(formData.get("domains"), ["pos", "room"]);
    const requiresRole =
      optionalTrim(formData.get("requires_role")) ?? "manager";
    const activeRaw = formData.get("active");
    const active =
      activeRaw == null || activeRaw === ""
        ? true
        : activeRaw !== "0" && activeRaw !== "off";
    const sortOrder = Number(optionalTrim(formData.get("sort_order")) ?? "100");
    const notes = optionalTrim(formData.get("notes"));

    const payload = {
      property_id: propertyId,
      code,
      label,
      domains,
      requires_role: requiresRole,
      active,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 100,
      notes,
    };

    let reasonId = id;
    if (id) {
      const { error } = await admin
        .from("nc_reason_codes")
        .update(payload)
        .eq("id", id)
        .eq("property_id", propertyId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await admin
        .from("nc_reason_codes")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Insert failed.");
      reasonId = data.id as string;
    }

    revalidateMarketing();
    return { ok: true, id: reasonId ?? undefined, message: "NC reason saved." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function setRoomAssignmentNc(
  _prev: MarketingState,
  formData: FormData,
): Promise<MarketingState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const assignmentId = trimRequired(
      formData.get("assignment_id"),
      "Assignment",
    );
    const chargeable = formData.get("chargeable") !== "0";
    const reasonCode = optionalTrim(formData.get("nc_reason_code"));
    const pin = optionalTrim(formData.get("manager_pin"));

    if (!chargeable) {
      if (!reasonCode) throw new Error("NC reason required to uncharge room.");
      if (!pin) throw new Error("Manager PIN required for room NC.");
      const verified = await verifyManagerPinForProperty(
        admin,
        propertyId,
        pin,
      );
      if (!verified.ok) throw new Error(verified.error);
      await admin
        .from("nc_reason_codes")
        .select("id")
        .eq("property_id", propertyId)
        .eq("code", reasonCode)
        .eq("active", true)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) throw new Error("Invalid NC reason.");
        });
    }

    const { data: before, error: loadErr } = await admin
      .from("room_assignments")
      .select(
        `
        id, booking_id, room_unit_id, from_date, to_date, chargeable,
        room_units(room_type_id),
        bookings(check_in, check_out, agent_id, agents(rate_tier))
      `,
      )
      .eq("id", assignmentId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (loadErr || !before) {
      throw new Error(loadErr?.message ?? "Assignment not found.");
    }

    const { data: assignment, error } = await admin
      .from("room_assignments")
      .update({
        chargeable,
        nc_reason_code: chargeable ? null : reasonCode,
        nc_authorized_by: chargeable ? null : "desk",
      })
      .eq("id", assignmentId)
      .eq("property_id", propertyId)
      .select("id, booking_id, room_unit_id")
      .maybeSingle();
    if (error || !assignment) {
      throw new Error(error?.message ?? "Assignment not found.");
    }

    if (!chargeable && reasonCode) {
      const listValueBtn = await resolveRoomNcListValueBtn(admin, {
        propertyId,
        fromDate: (before.from_date as string) ?? null,
        toDate: (before.to_date as string) ?? null,
        roomTypeId: (() => {
          const unit = before.room_units as
            | { room_type_id?: string }
            | { room_type_id?: string }[]
            | null;
          const u = Array.isArray(unit) ? unit[0] : unit;
          return (u?.room_type_id as string | undefined) ?? null;
        })(),
        booking: before.bookings as
          | {
              check_in?: string;
              check_out?: string;
              agent_id?: string | null;
              agents?:
                | { rate_tier?: string | null }
                | { rate_tier?: string | null }[]
                | null;
            }
          | {
              check_in?: string;
              check_out?: string;
              agent_id?: string | null;
              agents?:
                | { rate_tier?: string | null }
                | { rate_tier?: string | null }[]
                | null;
            }[]
          | null,
      });

      await recordNcEvent(admin, {
        propertyId,
        domain: "room",
        reasonCode,
        listValueBtn,
        bookingId: assignment.booking_id as string,
        roomAssignmentId: assignmentId,
        description: "Room assignment marked non-chargeable",
        approvedBy: "desk",
      });
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: chargeable ? "room.nc.clear" : "room.nc.set",
      entityType: "room_assignments",
      entityId: assignmentId,
      summary: chargeable
        ? "Room assignment chargeable again"
        : `Room NC · ${reasonCode}`,
    });

    revalidatePath("/erp/calendar");
    revalidatePath("/erp/folios");
    revalidatePath("/erp");
    revalidateMarketing();
    return {
      ok: true,
      message: chargeable
        ? "Room is chargeable again."
        : "Room marked non-chargeable (NC).",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

async function resolveRoomNcListValueBtn(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  args: {
    propertyId: string;
    fromDate: string | null;
    toDate: string | null;
    roomTypeId: string | null;
    booking:
      | {
          check_in?: string;
          check_out?: string;
          agent_id?: string | null;
          agents?:
            | { rate_tier?: string | null }
            | { rate_tier?: string | null }[]
            | null;
        }
      | {
          check_in?: string;
          check_out?: string;
          agent_id?: string | null;
          agents?:
            | { rate_tier?: string | null }
            | { rate_tier?: string | null }[]
            | null;
        }[]
      | null;
  },
): Promise<number> {
  const booking = Array.isArray(args.booking)
    ? args.booking[0]
    : args.booking;
  const from =
    args.fromDate ??
    (booking?.check_in as string | undefined) ??
    new Date().toISOString().slice(0, 10);
  const to =
    args.toDate ??
    (booking?.check_out as string | undefined) ??
    from;
  const nights = nightsBetween(from.slice(0, 10), to.slice(0, 10));
  if (!args.roomTypeId) return 0;

  let tier: RateTier = "public";
  const agentRaw = booking?.agents;
  const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;
  if (booking?.agent_id) {
    tier = agentRateTier(agent?.rate_tier ?? null);
  }

  const season = await resolveSeasonKind(
    admin,
    args.propertyId,
    from.slice(0, 10),
  );
  const nightRate = await lookupRoomRateBtn(admin, {
    propertyId: args.propertyId,
    roomTypeId: args.roomTypeId,
    seasonKind: season,
    rateTier: tier,
  });
  if (nightRate == null || !Number.isFinite(nightRate)) return 0;
  return Math.max(0, nightRate * nights);
}

export type PreviewPromoState = {
  ok: boolean;
  error?: string;
  discountBtn?: number;
  postDiscountBtn?: number;
  code?: string;
};

export async function previewPromoAction(
  formData: FormData,
): Promise<PreviewPromoState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const code = trimRequired(formData.get("promo_code"), "Promo code");
    const amount = Number(trimRequired(formData.get("amount_btn"), "Amount"));
    const channel = (optionalTrim(formData.get("channel")) ??
      "desk_pos") as PromoChannel;
    const domain = (optionalTrim(formData.get("domain")) ?? "pos") as PromoDomain;
    const result = await previewPromoCode(admin, {
      propertyId,
      code,
      channel,
      domain,
      preDiscountBtn: amount,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return {
      ok: true,
      discountBtn: result.discount_btn,
      postDiscountBtn: result.post_discount_btn,
      code: result.code,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function applyPromoToAmount(
  args: {
    propertyId: string;
    code: string;
    channel: PromoChannel;
    domain: PromoDomain;
    amountBtn: number;
    bookingId?: string | null;
    folioId?: string | null;
    guestKey?: string | null;
    redeem?: boolean;
  },
): Promise<{
  amountBtn: number;
  discountBtn: number;
  promoCodeId: string | null;
  error?: string;
}> {
  const admin = createSupabaseAdminClient();
  if (args.redeem) {
    const r = await redeemPromoCode(admin, {
      propertyId: args.propertyId,
      code: args.code,
      channel: args.channel,
      domain: args.domain,
      preDiscountBtn: args.amountBtn,
      bookingId: args.bookingId,
      folioId: args.folioId,
      guestKey: args.guestKey,
    });
    if (!r.ok) {
      return {
        amountBtn: args.amountBtn,
        discountBtn: 0,
        promoCodeId: null,
        error: r.error,
      };
    }
    return {
      amountBtn: Number(r.post_discount_btn ?? args.amountBtn),
      discountBtn: Number(r.discount_btn ?? 0),
      promoCodeId: r.promo_code_id ?? null,
    };
  }
  const p = await previewPromoCode(admin, {
    propertyId: args.propertyId,
    code: args.code,
    channel: args.channel,
    domain: args.domain,
    preDiscountBtn: args.amountBtn,
    guestKey: args.guestKey,
  });
  if (!p.ok) {
    return {
      amountBtn: args.amountBtn,
      discountBtn: 0,
      promoCodeId: null,
      error: p.error,
    };
  }
  return {
    amountBtn: Number(p.post_discount_btn ?? args.amountBtn),
    discountBtn: Number(p.discount_btn ?? 0),
    promoCodeId: p.promo_code_id ?? null,
  };
}

const CONTACT_TYPES = new Set([
  "guest",
  "agent",
  "influencer",
  "media",
  "other",
]);

export async function upsertMarketingContact(
  _prev: MarketingState,
  formData: FormData,
): Promise<MarketingState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const id = optionalTrim(formData.get("contact_id"));
    const fullName = trimRequired(formData.get("full_name"), "Name");
    const email = optionalTrim(formData.get("email"));
    const phone = optionalTrim(formData.get("phone"));
    const whatsapp = optionalTrim(formData.get("whatsapp"));
    const contactType = optionalTrim(formData.get("contact_type")) ?? "other";
    if (!CONTACT_TYPES.has(contactType)) {
      throw new Error("Invalid contact type.");
    }
    const tags = parseTags(formData.get("tags"));
    const notes = optionalTrim(formData.get("notes"));
    const source = optionalTrim(formData.get("source"));
    const campaignId = optionalTrim(formData.get("campaign_id"));
    const agentId = optionalTrim(formData.get("agent_id"));

    if (email && !email.includes("@")) {
      throw new Error("Email looks invalid.");
    }

    const payload = {
      property_id: propertyId,
      full_name: fullName,
      email: email ?? null,
      phone: phone ?? null,
      whatsapp: whatsapp ?? null,
      contact_type: contactType,
      tags,
      notes: notes ?? null,
      source: source ?? null,
      campaign_id: campaignId,
      agent_id: agentId,
      last_touched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let contactId = id;
    if (id) {
      const { error } = await admin
        .from("marketing_contacts")
        .update(payload)
        .eq("id", id)
        .eq("property_id", propertyId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await admin
        .from("marketing_contacts")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Insert failed.");
      contactId = data.id as string;
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: id ? "marketing.contact.update" : "marketing.contact.create",
      entityType: "marketing_contacts",
      entityId: contactId!,
      summary: `${id ? "Updated" : "Created"} contact ${fullName}`,
    });

    revalidateMarketing();
    return {
      ok: true,
      id: contactId ?? undefined,
      message: "Contact saved.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function sendMarketingEmailCampaign(
  _prev: MarketingState,
  formData: FormData,
): Promise<MarketingState> {
  try {
    await requireDeskRole(OWNER_GM);
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const subject = trimRequired(formData.get("subject"), "Subject");
    const bodyText = trimRequired(formData.get("body_text"), "Body");
    const bodyHtml = optionalTrim(formData.get("body_html"));
    const campaignId = optionalTrim(formData.get("campaign_id"));
    const tagFilter = optionalTrim(formData.get("tag_filter"));
    const contactIdsRaw = optionalTrim(formData.get("contact_ids"));
    const selectedIds = contactIdsRaw
      ? contactIdsRaw
          .split(/[,|\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    let query = admin
      .from("marketing_contacts")
      .select("id, full_name, email, tags")
      .eq("property_id", propertyId)
      .not("email", "is", null)
      .limit(MARKETING_EMAIL_BATCH_MAX + 1);

    if (selectedIds.length > 0) {
      query = query.in("id", selectedIds);
    } else if (tagFilter) {
      query = query.contains("tags", [tagFilter.toLowerCase()]);
    } else {
      throw new Error(
        "Select contacts (checkboxes) or enter a tag filter to build a list.",
      );
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    if (!rows?.length) {
      throw new Error("No contacts matched with a usable email.");
    }
    if (rows.length > MARKETING_EMAIL_BATCH_MAX) {
      throw new Error(
        `Batch limit is ${MARKETING_EMAIL_BATCH_MAX}. Narrow the selection or tag.`,
      );
    }

    const { data: property } = await admin
      .from("properties")
      .select("name")
      .eq("id", propertyId)
      .maybeSingle();

    const result = await sendMarketingBroadcast(admin, {
      propertyId,
      propertyName: (property?.name as string) ?? "Hotel",
      subject,
      bodyText,
      bodyHtml,
      campaignId,
      recipients: rows.map((r) => ({
        contactId: r.id as string,
        email: String(r.email ?? ""),
        fullName: String(r.full_name ?? "there"),
      })),
      createdBy: "desk_marketing",
    });

    await writeAuditEvent(admin, {
      propertyId,
      action: "marketing.email.broadcast",
      entityType: "marketing_email_sends",
      summary: `Broadcast “${subject}” · sent ${result.sent} · failed ${result.failed}`,
      meta: {
        campaign_id: campaignId,
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
      },
    });

    revalidateMarketing();
    const errNote =
      result.errors.length > 0
        ? ` First error: ${result.errors[0]}`
        : "";
    if (result.sent === 0 && result.failed > 0) {
      return {
        ok: false,
        error: result.errors[0] ?? "All sends failed.",
        message: `Sent 0, failed ${result.failed}.${errNote}`,
      };
    }
    return {
      ok: true,
      message: `Sent ${result.sent}, failed ${result.failed}, skipped ${result.skipped}.${errNote}`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function tryMetaGraphPost(
  _prev: MarketingState,
  formData: FormData,
): Promise<MarketingState> {
  try {
    await requireDeskRole(OWNER_GM);
    const cfg = getMetaTokenConfig();
    if (!cfg.graphEnabled) {
      return {
        ok: false,
        error:
          "Page Graph post needs FACEBOOK_PAGE_ACCESS_TOKEN + FACEBOOK_PAGE_ID. Use Share hub (Facebook sharer + copy IG caption) without App Review.",
      };
    }
    const message = trimRequired(formData.get("caption"), "Caption");
    const link = optionalTrim(formData.get("link"));
    const campaignId = optionalTrim(formData.get("campaign_id"));
    const result = await postFacebookPageFeed({ message, link });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    if (campaignId) {
      await admin
        .from("marketing_campaigns")
        .update({
          meta_post_url: `https://www.facebook.com/${result.postId}`,
          meta_posted_at: new Date().toISOString(),
          meta_post_notes: `Graph post ${result.postId}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId)
        .eq("property_id", propertyId);
    }
    await writeAuditEvent(admin, {
      propertyId,
      action: "marketing.meta.graph_post",
      entityType: "marketing_campaigns",
      entityId: campaignId,
      summary: `Facebook Graph post ${result.postId}`,
    });
    revalidateMarketing();
    return {
      ok: true,
      message: `Posted to Page (id ${result.postId}).`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}
