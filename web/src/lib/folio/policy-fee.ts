import "server-only";

import { ensureOpenFolio } from "@/lib/folio/open-folio";
import { postFolioCharge } from "@/lib/folio/post-charge";
import {
  loadPropertyPolicy,
  type CancelPolicyContext,
} from "@/lib/policies/cancel-policy";
import { roundBtn } from "@/lib/pricing";
import {
  agentRateTier,
  lookupRoomRateBtn,
  nightsBetween,
  resolveSeasonKind,
  type RateTier,
} from "@/lib/rates";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

function rateTierFromRole(
  bookedByRole: string | null | undefined,
  source: string | null | undefined,
  agentRateTierRaw: string | null | undefined,
): RateTier {
  if (bookedByRole === "mou_agent") return "mou_agents";
  if (bookedByRole === "agent" || source === "agent") {
    return agentRateTier(agentRateTierRaw ?? undefined) ?? "agents";
  }
  return "public";
}

async function estimateRoomStayBtn(
  admin: Admin,
  args: {
    propertyId: string;
    bookingId: string;
    checkIn: string;
    checkOut: string;
    bookedByRole?: string | null;
    source?: string | null;
    agentId?: string | null;
    chargeNights: number;
  },
): Promise<number> {
  const { data: lines } = await admin
    .from("booking_rooms")
    .select("room_type_id, qty")
    .eq("booking_id", args.bookingId);
  if (!lines?.length) return 0;

  let agentTier: string | null = null;
  if (args.agentId) {
    const { data: agent } = await admin
      .from("agents")
      .select("rate_tier")
      .eq("id", args.agentId)
      .maybeSingle();
    agentTier = (agent?.rate_tier as string | null) ?? null;
  }

  const tier = rateTierFromRole(args.bookedByRole, args.source, agentTier);
  const season = await resolveSeasonKind(admin, args.propertyId, args.checkIn);
  const nights = Math.max(1, nightsBetween(args.checkIn, args.checkOut));
  const billNights = Math.min(Math.max(1, args.chargeNights), nights);

  let total = 0;
  for (const line of lines) {
    const rate = await lookupRoomRateBtn(admin, {
      propertyId: args.propertyId,
      roomTypeId: line.room_type_id as string,
      seasonKind: season,
      rateTier: tier,
    });
    if (rate == null) continue;
    total += rate * billNights * Number(line.qty ?? 1);
  }
  return roundBtn(total);
}

async function postPolicyFeeLine(
  admin: Admin,
  args: {
    propertyId: string;
    bookingId: string;
    contactName: string;
    sourceType: "cancel_fee" | "no_show_fee";
    description: string;
    amountBtn: number;
    businessDate: string;
  },
): Promise<void> {
  if (args.amountBtn <= 0) return;

  const { data: existing } = await admin
    .from("folio_lines")
    .select("id")
    .eq("booking_id", args.bookingId)
    .eq("source_type", args.sourceType)
    .eq("status", "posted")
    .limit(1)
    .maybeSingle();
  if (existing?.id) return;

  const folioId = await ensureOpenFolio(
    admin,
    args.propertyId,
    args.bookingId,
    `${args.contactName} · policy`,
  );

  await postFolioCharge(admin, args.propertyId, {
    folio_id: folioId,
    booking_id: args.bookingId,
    source_type: args.sourceType,
    description: args.description,
    qty: 1,
    unit_price_btn: args.amountBtn,
    amount_btn: args.amountBtn,
    gst_applicable: false,
    gst_btn: 0,
    total_btn: args.amountBtn,
    business_date: args.businessDate,
  });
}

/** Optional cancel forfeit when outside free-cancel window (non-MoU). */
export async function postCancelPolicyFeeIfDue(
  admin: Admin,
  args: {
    propertyId: string;
    bookingId: string;
    contactName: string;
    checkIn: string;
    tokenReceivedBtn: number;
    cancelCtx: CancelPolicyContext;
  },
): Promise<string | null> {
  if (args.cancelCtx.waiveCancelFee) return null;

  const policy = await loadPropertyPolicy(admin, args.propertyId);
  if (!policy.late_cancel_forfeit_deposit) return null;

  const amountBtn = roundBtn(Math.max(0, args.tokenReceivedBtn));
  if (amountBtn <= 0) return null;

  await postPolicyFeeLine(admin, {
    propertyId: args.propertyId,
    bookingId: args.bookingId,
    contactName: args.contactName,
    sourceType: "cancel_fee",
    description: "Late cancellation · deposit forfeit",
    amountBtn,
    businessDate: args.checkIn,
  });
  return ` · Nu ${amountBtn} forfeit posted`;
}

/** Optional no-show room-night charge (non-MoU). */
export async function postNoShowPolicyFeeIfDue(
  admin: Admin,
  args: {
    propertyId: string;
    bookingId: string;
    contactName: string;
    checkIn: string;
    checkOut: string;
    bookedByRole?: string | null;
    source?: string | null;
    agentId?: string | null;
    cancelCtx: CancelPolicyContext;
  },
): Promise<string | null> {
  if (args.cancelCtx.waiveNoShowFee) return null;

  const policy = await loadPropertyPolicy(admin, args.propertyId);
  const chargeNights = policy.no_show_nights;
  if (chargeNights <= 0) return null;

  const amountBtn = await estimateRoomStayBtn(admin, {
    propertyId: args.propertyId,
    bookingId: args.bookingId,
    checkIn: args.checkIn,
    checkOut: args.checkOut,
    bookedByRole: args.bookedByRole,
    source: args.source,
    agentId: args.agentId,
    chargeNights,
  });
  if (amountBtn <= 0) return null;

  await postPolicyFeeLine(admin, {
    propertyId: args.propertyId,
    bookingId: args.bookingId,
    contactName: args.contactName,
    sourceType: "no_show_fee",
    description: `No-show charge · ${chargeNights} night(s)`,
    amountBtn,
    businessDate: args.checkIn,
  });
  return ` · Nu ${amountBtn} no-show fee posted`;
}
