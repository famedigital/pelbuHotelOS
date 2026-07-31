"use server";

import { writeAuditEvent } from "@/lib/audit";
import { enqueueAfterBookingChange, enqueueAvailabilityWindow } from "@/lib/channel/ari-queue";
import {
  ackBookingRevision,
  getChannexConfig,
  pullBookingRevisionFeed,
  pushAvailabilityBatch,
} from "@/lib/channel/channex-client";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type ErpChannelState = {
  ok: boolean;
  error?: string;
  message?: string;
};

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

async function propertyId(admin: Admin) {
  return resolveActivePropertyId(admin);
}

function revalidateChannel() {
  revalidatePath("/erp/channel");
  revalidatePath("/erp");
  revalidatePath("/erp/reports");
  revalidatePath("/erp/check-in");
  revalidatePath("/erp/fast-book");
  revalidatePath("/erp/reservations");
  revalidatePath("/erp/bookings/[id]", "page");
}

export async function saveChannelRoomMap(
  _prev: ErpChannelState,
  formData: FormData,
): Promise<ErpChannelState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);

    const { data: conn } = await admin
      .from("channel_connections")
      .select("id")
      .eq("property_id", pid)
      .eq("provider", "channex")
      .single();
    if (!conn) throw new Error("Channex connection missing — apply P6 migration.");

    const roomTypeId = trimRequired(formData.get("room_type_id"), "Room type");
    const externalRoom = trimRequired(
      formData.get("external_room_type_id"),
      "Channex room type id",
    );
    const externalRate = optionalTrim(formData.get("external_rate_plan_id"));

    const { error } = await admin.from("channel_room_maps").upsert(
      {
        connection_id: conn.id,
        property_id: pid,
        room_type_id: roomTypeId,
        external_room_type_id: externalRoom,
        external_rate_plan_id: externalRate,
        is_active: true,
      },
      { onConflict: "connection_id,room_type_id" },
    );
    if (error) {
      console.error("channel_room_maps upsert failed", error);
      throw new Error("Could not save room map.");
    }

    await admin
      .from("channel_connections")
      .update({ status: "mapping" })
      .eq("id", conn.id);

    revalidateChannel();
    return { ok: true, message: "Room map saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function setChannelStatus(
  _prev: ErpChannelState,
  formData: FormData,
): Promise<ErpChannelState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const status = trimRequired(formData.get("status"), "Status").toLowerCase();
    const allowed = new Set(["draft", "mapping", "staging", "live", "paused"]);
    if (!allowed.has(status)) throw new Error("Invalid status.");

    const externalPropertyId = optionalTrim(formData.get("external_property_id"));

    const { error } = await admin
      .from("channel_connections")
      .update({
        status,
        ...(externalPropertyId !== undefined
          ? { external_property_id: externalPropertyId }
          : {}),
      })
      .eq("property_id", pid)
      .eq("provider", "channex");
    if (error) throw new Error("Could not update connection status.");

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "channel.status",
      entityType: "channel_connections",
      summary: `Channex status → ${status}`,
    });

    revalidateChannel();
    return { ok: true, message: `Connection set to ${status}.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function enqueueFullAriSync(
  _prev: ErpChannelState,
  _formData: FormData,
): Promise<ErpChannelState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const from = new Date().toISOString().slice(0, 10);
    const toDate = new Date();
    toDate.setUTCDate(toDate.getUTCDate() + 90);
    const to = toDate.toISOString().slice(0, 10);

    const batches = await enqueueAvailabilityWindow(
      admin,
      pid,
      from,
      to,
      "desk.full_sync_90d",
    );
    revalidateChannel();
    return {
      ok: true,
      message:
        batches === 0
          ? "Nothing queued (paused connection or missing maps)."
          : `Queued ${batches} ARI batch(es) for 90 days.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function flushAriQueue(
  _prev: ErpChannelState,
  _formData: FormData,
): Promise<ErpChannelState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);

    if (!getChannexConfig()) {
      throw new Error(
        "Set CHANNEX_API_KEY in env before flushing the ARI queue.",
      );
    }

    const { data: conn } = await admin
      .from("channel_connections")
      .select("id, external_property_id, status")
      .eq("property_id", pid)
      .eq("provider", "channex")
      .single();
    if (!conn?.external_property_id) {
      throw new Error("Set Channex property id on the connection first.");
    }
    if (!["staging", "live"].includes(conn.status as string)) {
      throw new Error("Connection must be staging or live to push ARI.");
    }

    const { data: pending } = await admin
      .from("ari_queue")
      .select("id, kind, payload, attempts")
      .eq("property_id", pid)
      .eq("status", "pending")
      .eq("kind", "availability")
      .order("created_at")
      .limit(20);

    let sent = 0;
    let failed = 0;
    for (const row of pending ?? []) {
      await admin
        .from("ari_queue")
        .update({ status: "sending", attempts: Number(row.attempts) + 1 })
        .eq("id", row.id);

      const payload = row.payload as {
        values?: {
          date: string;
          room_type_id: string;
          availability: number;
        }[];
      };
      const values = (payload.values ?? []).map((v) => ({
        property_id: conn.external_property_id as string,
        room_type_id: v.room_type_id,
        date: v.date,
        availability: v.availability,
      }));

      const result = await pushAvailabilityBatch(values);
      if (result.ok) {
        await admin
          .from("ari_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", row.id);
        sent += 1;
      } else {
        await admin
          .from("ari_queue")
          .update({
            status: "failed",
            last_error: JSON.stringify(result.body).slice(0, 500),
          })
          .eq("id", row.id);
        failed += 1;
      }
    }

    await admin
      .from("channel_connections")
      .update({ last_ari_push_at: new Date().toISOString() })
      .eq("id", conn.id);

    revalidateChannel();
    return {
      ok: true,
      message: `ARI flush: ${sent} sent, ${failed} failed.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function pullChannelBookings(
  _prev: ErpChannelState,
  _formData: FormData,
): Promise<ErpChannelState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);

    if (!getChannexConfig()) {
      throw new Error("Set CHANNEX_API_KEY before pulling booking revisions.");
    }

    const { data: conn } = await admin
      .from("channel_connections")
      .select("id")
      .eq("property_id", pid)
      .eq("provider", "channex")
      .single();

    const feed = await pullBookingRevisionFeed();
    if (!feed.ok) {
      throw new Error(
        `Feed error (${feed.status}): ${JSON.stringify(feed.body).slice(0, 200)}`,
      );
    }

    const body = feed.body as {
      data?: { id?: string; attributes?: Record<string, unknown> }[];
    };
    const revisions = body.data ?? [];
    let stored = 0;

    for (const rev of revisions) {
      const revId = String(rev.id ?? "");
      if (!revId) continue;
      const attrs = rev.attributes ?? {};
      const { error } = await admin.from("channel_booking_revisions").upsert(
        {
          property_id: pid,
          connection_id: conn?.id ?? null,
          external_revision_id: revId,
          external_booking_id: attrs.booking_id
            ? String(attrs.booking_id)
            : null,
          revision_type: String(attrs.status ?? "new")
            .toLowerCase()
            .includes("cancel")
            ? "cancel"
            : "new",
          payload: rev,
          status: "received",
        },
        { onConflict: "property_id,external_revision_id" },
      );
      if (!error) stored += 1;
    }

    if (conn) {
      await admin
        .from("channel_connections")
        .update({ last_booking_pull_at: new Date().toISOString() })
        .eq("id", conn.id);
    }

    revalidateChannel();
    return {
      ok: true,
      message: `Pulled feed · stored/updated ${stored} revision(s). Import/ack next.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function ackChannelRevision(
  _prev: ErpChannelState,
  formData: FormData,
): Promise<ErpChannelState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const id = trimRequired(formData.get("revision_id"), "Revision");

    const { data: row } = await admin
      .from("channel_booking_revisions")
      .select("id, external_revision_id, status")
      .eq("id", id)
      .eq("property_id", pid)
      .single();
    if (!row) throw new Error("Revision not found.");
    if ((row.status as string) !== "imported") {
      throw new Error(
        "Import this revision into a local booking before acknowledging it at Channex.",
      );
    }

    if (!getChannexConfig()) {
      throw new Error(
        "Set CHANNEX_API_KEY before acknowledging revisions. Local-only ack is disabled.",
      );
    }

    const ack = await ackBookingRevision(row.external_revision_id as string);
    if (!ack.ok) {
      throw new Error(`Ack failed: ${JSON.stringify(ack.body).slice(0, 200)}`);
    }

    await admin
      .from("channel_booking_revisions")
      .update({
        status: "acked",
        acked_at: new Date().toISOString(),
      })
      .eq("id", id);

    revalidateChannel();
    return {
      ok: true,
      message: "Revision acknowledged at Channex.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function cancelBooking(
  _prev: ErpChannelState,
  formData: FormData,
): Promise<ErpChannelState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const reason = optionalTrim(formData.get("cancel_reason")) ?? "desk_cancel";

    const { data: booking, error } = await admin
      .from("bookings")
      .select("id, status, check_in, check_out")
      .eq("id", bookingId)
      .eq("property_id", pid)
      .single();
    if (error || !booking) throw new Error("Booking not found.");
    if (["cancelled", "checked_out", "no_show", "expired"].includes(booking.status as string)) {
      throw new Error(`Cannot cancel from status ${booking.status}.`);
    }

    const { error: upd } = await admin
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason,
      })
      .eq("id", bookingId);
    if (upd) throw new Error("Could not cancel booking.");

    // Free physical inventory immediately so the rack and ARI stay aligned.
    await admin.from("room_assignments").delete().eq("booking_id", bookingId);

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "booking.cancel",
      entityType: "bookings",
      entityId: bookingId,
      summary: `Cancelled booking · ${reason}`,
    });

    await enqueueAfterBookingChange(
      admin,
      pid,
      booking.check_in as string,
      booking.check_out as string,
      "booking.cancelled",
    );

    revalidateChannel();
    return { ok: true, message: "Booking cancelled · ARI queued." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function markBookingNoShow(
  _prev: ErpChannelState,
  formData: FormData,
): Promise<ErpChannelState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const bookingId = trimRequired(formData.get("booking_id"), "Booking");

    const { data: booking } = await admin
      .from("bookings")
      .select("id, status, check_in, check_out")
      .eq("id", bookingId)
      .eq("property_id", pid)
      .single();
    if (!booking) throw new Error("Booking not found.");
    if (!["pending", "held", "confirmed"].includes(booking.status as string)) {
      throw new Error("No-show only from pending/held/confirmed.");
    }

    const { error } = await admin
      .from("bookings")
      .update({
        status: "no_show",
        cancelled_at: new Date().toISOString(),
        cancel_reason: "no_show",
      })
      .eq("id", bookingId);
    if (error) throw new Error("Could not mark no-show.");

    await admin.from("room_assignments").delete().eq("booking_id", bookingId);

    await writeAuditEvent(admin, {
      propertyId: pid,
      action: "booking.no_show",
      entityType: "bookings",
      entityId: bookingId,
      summary: "Marked no-show",
    });

    await enqueueAfterBookingChange(
      admin,
      pid,
      booking.check_in as string,
      booking.check_out as string,
      "booking.no_show",
    );

    revalidateChannel();
    return { ok: true, message: "Marked no-show · ARI queued." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
