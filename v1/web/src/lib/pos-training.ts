import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/** Property flag: practice till — skip stock issue/restore and walk-in GL. */
export async function isPosTrainingMode(
  admin: Admin,
  propertyId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("properties")
    .select("pos_training_mode")
    .eq("id", propertyId)
    .maybeSingle();
  return Boolean(data?.pos_training_mode);
}

/**
 * Fail-closed stock apply. Skips when training mode is on.
 * Surfaces Insufficient stock to the caller; never soft-oks.
 */
export async function applyPosOrderStock(
  admin: Admin,
  opts: {
    propertyId: string;
    orderId: string;
    reverse?: boolean;
    training?: boolean;
  },
): Promise<void> {
  const training =
    opts.training ?? (await isPosTrainingMode(admin, opts.propertyId));
  if (training) return;

  const { error } = await admin.rpc("pos_apply_order_stock", {
    p_order_id: opts.orderId,
    p_reverse: opts.reverse ?? false,
  });
  if (!error) return;

  const msg = error.message ?? "";
  if (msg.includes("Insufficient stock")) {
    throw new Error(msg);
  }
  throw new Error(
    opts.reverse
      ? "Could not restore order stock."
      : "Could not issue menu stock.",
  );
}

export async function applyPosOrderItemStock(
  admin: Admin,
  opts: {
    propertyId: string;
    orderItemId: string;
    reverse?: boolean;
    training?: boolean;
  },
): Promise<void> {
  const training =
    opts.training ?? (await isPosTrainingMode(admin, opts.propertyId));
  if (training) return;

  const { error } = await admin.rpc("pos_apply_order_item_stock", {
    p_order_item_id: opts.orderItemId,
    p_reverse: opts.reverse ?? false,
  });
  if (error) {
    throw new Error(
      opts.reverse
        ? "Could not restore item stock."
        : "Could not issue item stock.",
    );
  }
}

/** Normalize party/bill-to display name — never blank on tickets or slips. */
export function normalizePartyName(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  return t.length > 0 ? t : "Walk-in";
}
