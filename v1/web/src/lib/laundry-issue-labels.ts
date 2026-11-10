import { laundryBagScanPath } from "@/lib/laundry";
import {
  createLaundryToken,
  hashLaundryToken,
} from "@/lib/laundry-session";
import {
  sealLaundryBagToken,
  unsealLaundryBagToken,
} from "@/lib/laundry-token-seal";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type IssuedBagLabel = {
  id: string;
  bagSeq: number;
  publicCode: string;
  rawToken: string;
  scanPath: string;
};

/**
 * Issue (or re-print) bag label tokens.
 * - rotate=false: reuse sealed token when present so existing stickers still work
 * - rotate=true: mint new tokens and invalidate previous QR stickers
 */
export async function issueOrderBagLabelTokens(
  admin: Admin,
  opts: {
    propertyId: string;
    orderId: string;
    staffId: string;
    actorKind: "staff" | "front_desk";
    /** When false (default), reuse sealed codes when available. */
    rotate?: boolean;
  },
): Promise<{
  bags: IssuedBagLabel[];
  rotated: boolean;
  message: string;
}> {
  const rotate = opts.rotate === true;
  const { data: bags } = await admin
    .from("laundry_order_bags")
    .select(
      "id, bag_seq, public_code, status, scan_token_hash, scan_token_sealed",
    )
    .eq("order_id", opts.orderId)
    .eq("property_id", opts.propertyId)
    .neq("status", "voided")
    .order("bag_seq");
  if (!bags?.length) throw new Error("No active bags to print.");

  const issued: IssuedBagLabel[] = [];
  let anyRotated = false;
  const now = new Date().toISOString();

  for (const bag of bags) {
    const existingHash = bag.scan_token_hash as string;
    let rawToken: string | null = null;
    let rotatedThis = false;

    if (!rotate) {
      const unsealed = unsealLaundryBagToken(
        bag.scan_token_sealed as string | null,
      );
      if (unsealed && hashLaundryToken(unsealed) === existingHash) {
        rawToken = unsealed;
      }
    }

    if (!rawToken) {
      rawToken = createLaundryToken();
      rotatedThis = true;
      anyRotated = true;
      const { error } = await admin
        .from("laundry_order_bags")
        .update({
          scan_token_hash: hashLaundryToken(rawToken),
          scan_token_sealed: sealLaundryBagToken(rawToken),
          label_printed_at: now,
          updated_at: now,
        })
        .eq("id", bag.id)
        .eq("property_id", opts.propertyId);
      if (error) throw new Error("Could not issue bag scan token.");
    } else {
      const { error } = await admin
        .from("laundry_order_bags")
        .update({
          scan_token_sealed: sealLaundryBagToken(rawToken),
          label_printed_at: now,
          updated_at: now,
        })
        .eq("id", bag.id)
        .eq("property_id", opts.propertyId);
      if (error) throw new Error("Could not update bag label print time.");
    }

    await admin.from("laundry_bag_events").insert({
      property_id: opts.propertyId,
      bag_id: bag.id,
      order_id: opts.orderId,
      event_type: "label_printed",
      notes: rotatedThis
        ? "New scan codes printed (previous stickers invalidated)"
        : "Labels reprinted with existing scan codes",
      actor_kind: opts.actorKind,
      actor_staff_id: opts.staffId,
    });

    issued.push({
      id: bag.id as string,
      bagSeq: Number(bag.bag_seq),
      publicCode: bag.public_code as string,
      rawToken,
      scanPath: laundryBagScanPath(bag.id as string, rawToken),
    });
  }

  return {
    bags: issued,
    rotated: anyRotated,
    message: anyRotated
      ? `Print codes ready for ${issued.length} bag(s). Previous stickers are invalidated.`
      : `Reprinted ${issued.length} bag label(s) with the same scan codes — existing stickers still work.`,
  };
}

/** Persist seal after bag prepare RPC (RPC only stores hash). */
export async function sealPreparedBagTokens(
  admin: Admin,
  propertyId: string,
  bags: { id: string; rawToken: string }[],
): Promise<void> {
  for (const bag of bags) {
    await admin
      .from("laundry_order_bags")
      .update({
        scan_token_sealed: sealLaundryBagToken(bag.rawToken),
        updated_at: new Date().toISOString(),
      })
      .eq("id", bag.id)
      .eq("property_id", propertyId);
  }
}
