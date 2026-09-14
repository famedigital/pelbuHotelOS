"use server";

import { writeAuditEvent } from "@/lib/audit";
import {
  enqueueAfterBookingChange,
  enqueueFullAriWindow,
  ensureChannexConnection,
} from "@/lib/channel/ari-queue";
import {
  ackBookingRevision,
  getChannexConfig,
  pullBookingRevisionFeed,
  pushAvailabilityBatch,
  pushRestrictionsBatch,
} from "@/lib/channel/channex-client";
import { isDeskAuthenticated, requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import {
  postCancelPolicyFeeIfDue,
  postNoShowPolicyFeeIfDue,
} from "@/lib/folio/policy-fee";
import { resolveCancelPolicyContext } from "@/lib/policies/cancel-policy";
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
  revalidatePath("/erp/folios/[id]", "page");
}

export async function saveChannelRoomMap(
  _prev: ErpChannelState,
  formData: FormData,
): Promise<ErpChannelState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);

    const conn = await ensureChannexConnection(admin, pid);
    if (!conn) throw new Error("Could not create Channex connection.");

    const roomTypeId = trimRequired(formData.get("room_type_id"), "Room type");
    const externalRoom = trimRequired(
      formData.get("external_room_type_id"),
      "Channex room type id",
    );
    const externalRate = optionalTrim(formData.get("external_rate_plan_id"));

    const { data: roomType } = await admin
      .from("room_types")
      .select("id, property_id")
      .eq("id", roomTypeId)
      .single();
    if (!roomType) throw new Error("Room type not found.");
    assertDeskProperty(pid, roomType.property_id as string, "Room type");

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

    const conn = await ensureChannexConnection(admin, pid);
    if (!conn) throw new Error("Could not create Channex connection.");

    const { error } = await admin
      .from("channel_connections")
      .update({
        status,
        ...(externalPropertyId !== undefined
          ? { external_property_id: externalPropertyId }
          : {}),
      })
      .eq("id", conn.id);
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

    const batches = await enqueueFullAriWindow(
      admin,
      pid,
      from,
      to,
      "desk.full_sync_90d",
    );
    const total =
      batches.availability + batches.rates + batches.restrictions;
    revalidateChannel();
    return {
      ok: true,
      message:
        total === 0
          ? "Nothing queued (paused connection, missing maps, or no public rates)."
          : `Queued ${batches.availability} availability, ${batches.rates} rate, ${batches.restrictions} restriction batch(es) for 90 days.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

type AriQueueRow = {
  id: string;
  kind: string;
  payload: unknown;
  attempts: number;
};

async function flushOneAriRow(
  admin: Admin,
  externalPropertyId: string,
  row: AriQueueRow,
): Promise<"sent" | "failed" | "skipped"> {
  await admin
    .from("ari_queue")
    .update({ status: "sending", attempts: Number(row.attempts) + 1 })
    .eq("id", row.id);

  const payload = row.payload as { values?: Record<string, unknown>[] };
  const rawValues = payload.values ?? [];

  if (row.kind === "full_sync") {
    await admin
      .from("ari_queue")
      .update({
        status: "cancelled",
        last_error: "Placeholder only — map rooms then queue again.",
      })
      .eq("id", row.id);
    return "skipped";
  }

  let result: { ok: boolean; body: unknown };

  if (row.kind === "availability") {
    const values = rawValues.map((v) => ({
      property_id: externalPropertyId,
      room_type_id: String(v.room_type_id ?? ""),
      date: String(v.date ?? ""),
      availability: Number(v.availability ?? 0),
    }));
    result = await pushAvailabilityBatch(values);
  } else if (row.kind === "rates" || row.kind === "restrictions") {
    const values = rawValues.map((v) => {
      const base: {
        property_id: string;
        rate_plan_id: string;
        date: string;
        rate?: number;
        min_stay?: number;
        stop_sell?: boolean;
      } = {
        property_id: externalPropertyId,
        rate_plan_id: String(v.rate_plan_id ?? ""),
        date: String(v.date ?? ""),
      };
      if (v.rate != null) base.rate = Number(v.rate);
      if (v.min_stay != null) base.min_stay = Number(v.min_stay);
      if (v.stop_sell != null) base.stop_sell = Boolean(v.stop_sell);
      return base;
    });
    result = await pushRestrictionsBatch(values);
  } else {
    await admin
      .from("ari_queue")
      .update({
        status: "failed",
        last_error: `Unknown ARI kind: ${row.kind}`,
      })
      .eq("id", row.id);
    return "failed";
  }

  if (result.ok) {
    await admin
      .from("ari_queue")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", row.id);
    return "sent";
  }

  await admin
    .from("ari_queue")
    .update({
      status: "failed",
      last_error: JSON.stringify(result.body).slice(0, 500),
    })
    .eq("id", row.id);
  return "failed";
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
      .in("kind", ["availability", "rates", "restrictions", "full_sync"])
      .order("created_at")
      .limit(40);

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const row of pending ?? []) {
      const outcome = await flushOneAriRow(
        admin,
        conn.external_property_id as string,
        {
          id: row.id as string,
          kind: row.kind as string,
          payload: row.payload,
          attempts: Number(row.attempts),
        },
      );
      if (outcome === "sent") sent += 1;
      else if (outcome === "failed") failed += 1;
      else skipped += 1;
    }

    await admin
      .from("channel_connections")
      .update({ last_ari_push_at: new Date().toISOString() })
      .eq("id", conn.id);

    revalidateChannel();
    return {
      ok: true,
      message: `ARI flush: ${sent} sent, ${failed} failed${skipped ? `, ${skipped} skipped` : ""}.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Re-queue failed ARI jobs as pending so Flush can retry them. */
export async function retryFailedAriJobs(
  _prev: ErpChannelState,
  _formData: FormData,
): Promise<ErpChannelState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);

    const { data: failed, error } = await admin
      .from("ari_queue")
      .update({ status: "pending", last_error: null })
      .eq("property_id", pid)
      .eq("status", "failed")
      .select("id");
    if (error) throw new Error("Could not retry failed ARI jobs.");

    revalidateChannel();
    const n = failed?.length ?? 0;
    return {
      ok: true,
      message:
        n === 0
          ? "No failed ARI jobs to retry."
          : `Re-queued ${n} failed job(s). Flush when ready.`,
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

    const conn = await ensureChannexConnection(admin, pid);

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
      .select("id, external_revision_id, status, property_id")
      .eq("id", id)
      .single();
    if (!row) throw new Error("Revision not found.");
    assertDeskProperty(pid, row.property_id as string, "Channel revision");
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
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const reason = optionalTrim(formData.get("cancel_reason")) ?? "desk_cancel";

    const { data: booking, error } = await admin
      .from("bookings")
      .select(
        "id, status, check_in, check_out, property_id, agent_id, booked_by_role, contact_name, token_received_btn",
      )
      .eq("id", bookingId)
      .single();
    if (error || !booking) throw new Error("Booking not found.");
    assertDeskProperty(pid, booking.property_id as string, "Booking");
    if (["cancelled", "checked_out", "no_show", "expired"].includes(booking.status as string)) {
      throw new Error(`Cannot cancel from status ${booking.status}.`);
    }

    const cancelCtx = await resolveCancelPolicyContext(admin, {
      propertyId: pid,
      checkIn: booking.check_in as string,
      bookedByRole: booking.booked_by_role as string | null,
      agentId: booking.agent_id as string | null,
    });

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

    let feeNote = "";
    try {
      const posted = await postCancelPolicyFeeIfDue(admin, {
        propertyId: pid,
        bookingId,
        contactName: (booking.contact_name as string) ?? "Guest",
        checkIn: booking.check_in as string,
        tokenReceivedBtn: Number(booking.token_received_btn ?? 0),
        cancelCtx,
      });
      if (posted) feeNote = posted;
    } catch (feeErr) {
      console.error("cancel policy fee failed", feeErr);
      feeNote = " · fee not posted — review folio";
    }

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
    const windowNote = cancelCtx.waiveCancelFee
      ? cancelCtx.isMouAgent
        ? " · MoU — no cancel fee"
        : " · Within free-cancel window"
      : feeNote || " · Late cancel — review deposit forfeit";
    return { ok: true, message: `Booking cancelled · ARI queued${windowNote}.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function markBookingNoShow(
  _prev: ErpChannelState,
  formData: FormData,
): Promise<ErpChannelState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const pid = await propertyId(admin);
    const bookingId = trimRequired(formData.get("booking_id"), "Booking");

    const { data: booking } = await admin
      .from("bookings")
      .select(
        "id, status, check_in, check_out, property_id, agent_id, booked_by_role, source, contact_name",
      )
      .eq("id", bookingId)
      .single();
    if (!booking) throw new Error("Booking not found.");
    assertDeskProperty(pid, booking.property_id as string, "Booking");
    if (!["pending", "held", "confirmed"].includes(booking.status as string)) {
      throw new Error("No-show only from pending/held/confirmed.");
    }

    const cancelCtx = await resolveCancelPolicyContext(admin, {
      propertyId: pid,
      checkIn: booking.check_in as string,
      bookedByRole: booking.booked_by_role as string | null,
      agentId: booking.agent_id as string | null,
    });
    if (cancelCtx.waiveNoShowFee) {
      // MoU agents: mark no-show without implying a penalty path.
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

    let noShowFeeNote = "";
    if (!cancelCtx.waiveNoShowFee) {
      try {
        const posted = await postNoShowPolicyFeeIfDue(admin, {
          propertyId: pid,
          bookingId,
          contactName: (booking.contact_name as string) ?? "Guest",
          checkIn: booking.check_in as string,
          checkOut: booking.check_out as string,
          bookedByRole: booking.booked_by_role as string | null,
          source: booking.source as string | null,
          agentId: booking.agent_id as string | null,
          cancelCtx,
        });
        if (posted) noShowFeeNote = posted;
      } catch (feeErr) {
        console.error("no-show policy fee failed", feeErr);
        noShowFeeNote = " · fee not posted — review folio";
      }
    }

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
    const feeNote = cancelCtx.waiveNoShowFee
      ? " · MoU — no no-show fee"
      : noShowFeeNote || " · no-show fee due — review folio";
    return { ok: true, message: `Marked no-show · ARI queued${feeNote}.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
