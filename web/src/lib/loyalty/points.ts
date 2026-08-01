import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { pointsFromSpendBtn } from "@/lib/loyalty/points-math";

export { pointsFromSpendBtn } from "@/lib/loyalty/points-math";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type LoyaltyTier = "member" | "silver" | "gold";

function tierForBalance(points: number): LoyaltyTier {
  if (points >= 5000) return "gold";
  if (points >= 1500) return "silver";
  return "member";
}

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "").trim();
}

export async function ensureLoyaltyAccount(
  admin: Admin,
  args: {
    propertyId: string;
    contactPhone: string;
    contactEmail?: string | null;
    displayName?: string | null;
  },
): Promise<{ id: string; points_balance: number; tier: LoyaltyTier }> {
  const phone = normalizePhone(args.contactPhone);
  if (!phone) throw new Error("Phone required for loyalty.");

  const { data: existing } = await admin
    .from("guest_loyalty_accounts")
    .select("id, points_balance, tier")
    .eq("property_id", args.propertyId)
    .eq("contact_phone", phone)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id as string,
      points_balance: Number(existing.points_balance),
      tier: existing.tier as LoyaltyTier,
    };
  }

  const { data: created, error } = await admin
    .from("guest_loyalty_accounts")
    .insert({
      property_id: args.propertyId,
      contact_phone: phone,
      contact_email: args.contactEmail ?? null,
      display_name: args.displayName ?? null,
      points_balance: 0,
      tier: "member",
    })
    .select("id, points_balance, tier")
    .single();

  if (error || !created) throw new Error(error?.message ?? "Could not create loyalty account.");
  return {
    id: created.id as string,
    points_balance: Number(created.points_balance),
    tier: created.tier as LoyaltyTier,
  };
}

export async function postLoyaltyPoints(
  admin: Admin,
  args: {
    propertyId: string;
    accountId: string;
    deltaPoints: number;
    reason: string;
    bookingId?: string | null;
    folioId?: string | null;
    createdBy?: string;
  },
): Promise<{ points_balance: number; tier: LoyaltyTier }> {
  if (!Number.isInteger(args.deltaPoints) || args.deltaPoints === 0) {
    throw new Error("deltaPoints must be a non-zero integer.");
  }

  const { data: account } = await admin
    .from("guest_loyalty_accounts")
    .select("id, points_balance")
    .eq("id", args.accountId)
    .eq("property_id", args.propertyId)
    .maybeSingle();
  if (!account) throw new Error("Loyalty account not found.");

  const next = Number(account.points_balance) + args.deltaPoints;
  if (next < 0) throw new Error("Insufficient loyalty points.");

  const tier = tierForBalance(next);
  const { error: ledgerError } = await admin.from("guest_loyalty_ledger").insert({
    property_id: args.propertyId,
    account_id: args.accountId,
    booking_id: args.bookingId ?? null,
    folio_id: args.folioId ?? null,
    delta_points: args.deltaPoints,
    reason: args.reason,
    created_by: args.createdBy ?? "desk",
  });
  if (ledgerError) throw new Error(ledgerError.message);

  const { error: updError } = await admin
    .from("guest_loyalty_accounts")
    .update({
      points_balance: next,
      tier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.accountId);
  if (updError) throw new Error(updError.message);

  return { points_balance: next, tier };
}

export async function earnLoyaltyForCheckout(
  admin: Admin,
  args: {
    propertyId: string;
    contactPhone: string;
    contactEmail?: string | null;
    displayName?: string | null;
    spendBtn: number;
    bookingId?: string | null;
    folioId?: string | null;
  },
): Promise<{ points: number; balance: number; tier: LoyaltyTier } | null> {
  const points = pointsFromSpendBtn(args.spendBtn);
  if (points <= 0) return null;
  const account = await ensureLoyaltyAccount(admin, args);
  const result = await postLoyaltyPoints(admin, {
    propertyId: args.propertyId,
    accountId: account.id,
    deltaPoints: points,
    reason: "checkout_earn",
    bookingId: args.bookingId,
    folioId: args.folioId,
    createdBy: "checkout",
  });
  return { points, balance: result.points_balance, tier: result.tier };
}
