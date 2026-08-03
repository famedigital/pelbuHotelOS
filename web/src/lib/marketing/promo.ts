import "server-only";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
export { applyPromoBenefit } from "@/lib/marketing/promo-math";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type PromoChannel =
  | "public_book"
  | "public_order"
  | "desk_pos"
  | "desk_folio"
  | "agent_portal";

export type PromoDomain =
  | "rooms"
  | "pos"
  | "spa"
  | "laundry"
  | "guest_service"
  | "packages"
  | "meal_plan";

export type PromoPreviewResult = {
  ok: boolean;
  error?: string;
  promo_code_id?: string;
  code?: string;
  discount_btn?: number;
  post_discount_btn?: number;
  benefit_type?: "pct" | "fixed_btn";
  benefit_value?: number;
  redeemed_count?: number;
  max_redemptions?: number | null;
  stackable_with_partner?: boolean;
  campaign_id?: string | null;
};

export type PromoRedeemResult = PromoPreviewResult & {
  redemption_id?: string;
};

function asResult(raw: unknown): PromoPreviewResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Promo service returned an empty response." };
  }
  const r = raw as Record<string, unknown>;
  return {
    ok: Boolean(r.ok),
    error: typeof r.error === "string" ? r.error : undefined,
    promo_code_id:
      typeof r.promo_code_id === "string" ? r.promo_code_id : undefined,
    code: typeof r.code === "string" ? r.code : undefined,
    discount_btn:
      r.discount_btn != null ? Number(r.discount_btn) : undefined,
    post_discount_btn:
      r.post_discount_btn != null ? Number(r.post_discount_btn) : undefined,
    benefit_type:
      r.benefit_type === "pct" || r.benefit_type === "fixed_btn"
        ? r.benefit_type
        : undefined,
    benefit_value:
      r.benefit_value != null ? Number(r.benefit_value) : undefined,
    redeemed_count:
      r.redeemed_count != null ? Number(r.redeemed_count) : undefined,
    max_redemptions:
      r.max_redemptions == null ? null : Number(r.max_redemptions),
    stackable_with_partner: Boolean(r.stackable_with_partner),
    campaign_id:
      r.campaign_id == null ? null : String(r.campaign_id),
    redemption_id:
      typeof (r as { redemption_id?: string }).redemption_id === "string"
        ? (r as { redemption_id: string }).redemption_id
        : undefined,
  } as PromoRedeemResult;
}

export async function previewPromoCode(
  admin: Admin,
  args: {
    propertyId: string;
    code: string;
    channel: PromoChannel;
    domain: PromoDomain;
    preDiscountBtn: number;
    guestKey?: string | null;
    minNights?: number;
    stackPartner?: boolean;
  },
): Promise<PromoPreviewResult> {
  const { data, error } = await admin.rpc("preview_promo_code", {
    p_property_id: args.propertyId,
    p_code: args.code,
    p_channel: args.channel,
    p_domain: args.domain,
    p_pre_discount_btn: args.preDiscountBtn,
    p_guest_key: args.guestKey ?? null,
    p_min_nights: args.minNights ?? 0,
    p_stack_partner: args.stackPartner ?? false,
  });
  if (error) return { ok: false, error: error.message };
  return asResult(data);
}

export async function redeemPromoCode(
  admin: Admin,
  args: {
    propertyId: string;
    code: string;
    channel: PromoChannel;
    domain: PromoDomain;
    preDiscountBtn: number;
    guestKey?: string | null;
    bookingId?: string | null;
    orderId?: string | null;
    folioId?: string | null;
    minNights?: number;
    createdBy?: string;
    stackPartner?: boolean;
  },
): Promise<PromoRedeemResult> {
  const { data, error } = await admin.rpc("redeem_promo_code", {
    p_property_id: args.propertyId,
    p_code: args.code,
    p_channel: args.channel,
    p_domain: args.domain,
    p_pre_discount_btn: args.preDiscountBtn,
    p_guest_key: args.guestKey ?? null,
    p_booking_id: args.bookingId ?? null,
    p_order_id: args.orderId ?? null,
    p_folio_id: args.folioId ?? null,
    p_min_nights: args.minNights ?? 0,
    p_created_by: args.createdBy ?? "desk",
    p_stack_partner: args.stackPartner ?? false,
  });
  if (error) return { ok: false, error: error.message };
  return asResult(data) as PromoRedeemResult;
}
