import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  computeCancelWaivers,
  daysUntilCheckIn,
  isMouAgentFromBooking,
} from "@/lib/policies/cancel-policy-logic";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type PropertyPolicyRow = {
  free_cancel_days: number;
  late_cancel_forfeit_deposit: boolean;
  no_show_nights: number;
  mou_free_cancel: boolean;
  mou_waive_no_show: boolean;
  guest_summary: string | null;
};

export type CancelPolicyContext = {
  isMouAgent: boolean;
  freeCancelDays: number;
  daysUntilCheckIn: number;
  waiveCancelFee: boolean;
  waiveNoShowFee: boolean;
  summary: string;
};

const DEFAULT_POLICY: PropertyPolicyRow = {
  free_cancel_days: 3,
  late_cancel_forfeit_deposit: true,
  no_show_nights: 1,
  mou_free_cancel: true,
  mou_waive_no_show: true,
  guest_summary: null,
};

export async function loadPropertyPolicy(
  admin: Admin,
  propertyId: string,
): Promise<PropertyPolicyRow> {
  const { data } = await admin
    .from("property_policies")
    .select(
      "free_cancel_days, late_cancel_forfeit_deposit, no_show_nights, mou_free_cancel, mou_waive_no_show, guest_summary",
    )
    .eq("property_id", propertyId)
    .maybeSingle();

  if (!data) return DEFAULT_POLICY;

  return {
    free_cancel_days: Number(data.free_cancel_days ?? 3),
    late_cancel_forfeit_deposit: Boolean(data.late_cancel_forfeit_deposit),
    no_show_nights: Number(data.no_show_nights ?? 1),
    mou_free_cancel: Boolean(data.mou_free_cancel),
    mou_waive_no_show: Boolean(data.mou_waive_no_show),
    guest_summary: (data.guest_summary as string | null) ?? null,
  };
}

function daysUntil(checkInIso: string, fromDate = new Date()): number {
  return daysUntilCheckIn(checkInIso, fromDate);
}

export async function resolveCancelPolicyContext(
  admin: Admin,
  args: {
    propertyId: string;
    checkIn: string;
    bookedByRole?: string | null;
    agentId?: string | null;
  },
): Promise<CancelPolicyContext> {
  const policy = await loadPropertyPolicy(admin, args.propertyId);

  let wantsMou = false;
  if (args.agentId) {
    const { data: agent } = await admin
      .from("agents")
      .select("wants_mou")
      .eq("id", args.agentId)
      .maybeSingle();
    wantsMou = Boolean(agent?.wants_mou);
  }

  const isMouAgent = isMouAgentFromBooking(args.bookedByRole, wantsMou);

  const daysLeft = daysUntil(args.checkIn);

  const { waiveCancelFee, waiveNoShowFee } = computeCancelWaivers({
    isMouAgent,
    freeCancelDays: policy.free_cancel_days,
    daysUntilCheckIn: daysLeft,
    mouFreeCancel: policy.mou_free_cancel,
    mouWaiveNoShow: policy.mou_waive_no_show,
  });

  const summary =
    isMouAgent && policy.mou_free_cancel
      ? "MoU agent — free cancellation anytime."
      : policy.guest_summary ??
        `Free cancel up to ${policy.free_cancel_days} days before arrival.`;

  return {
    isMouAgent,
    freeCancelDays: policy.free_cancel_days,
    daysUntilCheckIn: daysLeft,
    waiveCancelFee,
    waiveNoShowFee,
    summary,
  };
}
