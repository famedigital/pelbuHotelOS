"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { recordNcEvent } from "@/lib/marketing/nc";
import {
  previewPromoCode,
  redeemPromoCode,
  type PromoChannel,
  type PromoDomain,
} from "@/lib/marketing/promo";
import { verifyManagerPinForProperty } from "@/lib/manager-pin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type MarketingState = {
  ok: boolean;
  error?: string;
  id?: string;
  message?: string;
};

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
    if (benefitType !== "pct" && benefitType !== "fixed_btn") {
      throw new Error("Benefit type must be pct or fixed_btn.");
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
    const active = formData.get("active") !== "off";
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
    const active = formData.get("active") !== "off";
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
      await recordNcEvent(admin, {
        propertyId,
        domain: "room",
        reasonCode,
        listValueBtn: 0,
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

/** Apply promo at folio charge time for spa/laundry/guest_service domains. */
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
