"use server";

import { confirmCheckIn, type CheckInState } from "@/app/actions/erp-checkin";
import { ensurePartyMasterFolio } from "@/app/actions/erp-party-master-bill";
import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type PartyCheckInResult = {
  ok: boolean;
  error?: string;
  message?: string;
  checkedIn: string[];
  failed: Array<{ bookingId: string; error: string }>;
};

/**
 * Bulk check-in all assigned confirmed/held rooms in a formal party.
 * Sets docs_deferred so SDF can upload after arrival (Pelbu moat vs Absolute).
 */
export async function checkInParty(
  groupIdOrBookingId: string,
): Promise<PartyCheckInResult> {
  const checkedIn: string[] = [];
  const failed: Array<{ bookingId: string; error: string }> = [];

  try {
    if (!(await isDeskAuthenticated())) {
      return {
        ok: false,
        error: "Desk session expired.",
        checkedIn,
        failed,
      };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const raw = groupIdOrBookingId.trim();
    if (!raw) {
      return { ok: false, error: "Party required.", checkedIn, failed };
    }

    let groupId = raw;
    const { data: asGroup } = await admin
      .from("booking_groups")
      .select("id")
      .eq("id", raw)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!asGroup) {
      const { data: mem } = await admin
        .from("booking_group_members")
        .select("group_id")
        .eq("booking_id", raw)
        .maybeSingle();
      if (!mem?.group_id) {
        return {
          ok: false,
          error: "Link as group first, then check-in party.",
          checkedIn,
          failed,
        };
      }
      groupId = mem.group_id as string;
    }

    await admin
      .from("booking_groups")
      .update({ docs_deferred: true, status: "confirmed" })
      .eq("id", groupId)
      .eq("property_id", propertyId);

    const { data: members } = await admin
      .from("booking_group_members")
      .select("booking_id")
      .eq("group_id", groupId);
    const ids = (members ?? []).map((m) => m.booking_id as string);

    const { data: bookings } = await admin
      .from("bookings")
      .select(
        `id, status, contact_name, payment_mode, guide_number, guest_origin,
         room_assignments(id, room_unit_id)`,
      )
      .eq("property_id", propertyId)
      .in("id", ids);

    for (const b of bookings ?? []) {
      const bid = b.id as string;
      const status = b.status as string;
      if (!["pending", "confirmed", "held"].includes(status)) {
        if (status !== "checked_in") {
          failed.push({
            bookingId: bid,
            error: `Status ${status} — skipped`,
          });
        }
        continue;
      }

      const assigns =
        (b.room_assignments as Array<{ room_unit_id?: string }> | null) ?? [];
      const unitIds = assigns
        .map((a) => a.room_unit_id)
        .filter((u): u is string => Boolean(u));
      if (unitIds.length === 0) {
        failed.push({
          bookingId: bid,
          error: "Assign a room number first",
        });
        continue;
      }

      const fd = new FormData();
      fd.set("booking_id", bid);
      fd.set(
        "payment_mode",
        (b.payment_mode as string) || "on_credit",
      );
      fd.set("guide_number", (b.guide_number as string) || "PARTY-DEFERRED");
      fd.set("party_docs_deferred", "on");
      fd.set("guest_name", (b.contact_name as string) || "Party guest");
      fd.set("guest_passport_or_cid", "DEFERRED");
      fd.set("guest_sdf_ref", "");
      fd.set("guest_sdf_doc_url", "");
      fd.set("nationality", "Deferred");
      for (const uid of unitIds) {
        fd.append("room_unit_id", uid);
      }

      const result: CheckInState = await confirmCheckIn(
        { ok: false },
        fd,
      );
      if (result.ok) {
        checkedIn.push(bid);
      } else {
        failed.push({
          bookingId: bid,
          error: result.error ?? "Check-in failed",
        });
      }
    }

    if (checkedIn.length > 0) {
      await ensurePartyMasterFolio(groupId);
      await writeAuditEvent(admin, {
        propertyId,
        action: "reservations.party.bulk_check_in",
        entityType: "booking_groups",
        entityId: groupId,
        summary: `Party check-in · ${checkedIn.length} room(s)`,
        meta: { checkedIn, failed },
      });
    }

    revalidatePath("/erp/calendar");
    revalidatePath("/erp/today");
    revalidatePath("/erp/arrivals");
    revalidatePath("/erp/reservations");
    revalidatePath("/erp/in-house");

    const ok = checkedIn.length > 0;
    return {
      ok,
      checkedIn,
      failed,
      message: ok
        ? `Checked in ${checkedIn.length} room(s)${
            failed.length ? ` · ${failed.length} need attention` : ""
          }. SDF deferred — upload in Group documents.`
        : failed[0]?.error ?? "No rooms checked in.",
      error: ok ? undefined : failed[0]?.error ?? "No rooms checked in.",
    };
  } catch (e) {
    return {
      ok: false,
      checkedIn,
      failed,
      error: e instanceof Error ? e.message : "Party check-in failed.",
    };
  }
}
