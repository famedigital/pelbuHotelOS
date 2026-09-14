"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { netFolioBalance } from "@/lib/folio/balance";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type PartyMasterRoomRow = {
  bookingId: string;
  folioId: string;
  roomLabel: string | null;
  contactName: string | null;
  status: string;
  balanceBtn: number;
  paidBtn: number;
  chargesBtn: number;
  posChargesBtn: number;
};

export type PartyMasterBill = {
  groupId: string;
  groupName: string | null;
  masterFolioId: string | null;
  rooms: PartyMasterRoomRow[];
  totalDueBtn: number;
  totalPaidBtn: number;
  totalChargesBtn: number;
  totalPosBtn: number;
};

type Line = {
  id: string;
  total_btn?: number | null;
  status?: string | null;
  reverses_line_id?: string | null;
  source_type?: string | null;
};

function lineTotals(lines: Line[]) {
  const balance = netFolioBalance(
    lines.map((l) => ({
      id: l.id,
      status: l.status ?? "posted",
      total_btn: Number(l.total_btn ?? 0),
      reverses_line_id: l.reverses_line_id ?? null,
    })),
  );
  let charges = 0;
  let paid = 0;
  let pos = 0;
  for (const l of lines) {
    if (l.status === "voided" || l.reverses_line_id) continue;
    const amt = Number(l.total_btn ?? 0);
    const src = (l.source_type ?? "").toLowerCase();
    if (src === "payment" || amt < 0) {
      paid += Math.abs(amt);
    } else {
      charges += amt;
      if (src.includes("pos") || src.includes("order") || src.includes("fnb")) {
        pos += amt;
      }
    }
  }
  return { balance, charges, paid, pos };
}

/**
 * Promote/attach open guest folios for a formal party under one master.
 * No-op when no member has an open folio yet (pre-arrival).
 */
export async function ensurePartyMasterFolio(
  groupId: string,
): Promise<{ ok: true; masterFolioId: string | null } | { ok: false; error: string }> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Not signed in" };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const gid = groupId.trim();
    if (!gid) return { ok: false, error: "Group required." };

    const { data: group } = await admin
      .from("booking_groups")
      .select("id, name")
      .eq("id", gid)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!group) return { ok: false, error: "Group not found." };

    const { data: members } = await admin
      .from("booking_group_members")
      .select("booking_id")
      .eq("group_id", gid);
    const bookingIds = (members ?? [])
      .map((m) => m.booking_id as string)
      .filter(Boolean);
    if (bookingIds.length === 0) {
      return { ok: true, masterFolioId: null };
    }

    const { data: folios } = await admin
      .from("folios")
      .select("id, booking_id, folio_type, master_folio_id, status, label")
      .eq("property_id", propertyId)
      .eq("status", "open")
      .in("booking_id", bookingIds);

    const open = folios ?? [];
    if (open.length === 0) {
      return { ok: true, masterFolioId: null };
    }

    let masterId =
      open.find((f) => (f.folio_type as string) === "master")?.id ??
      open.find((f) => f.master_folio_id)?.master_folio_id ??
      null;

    if (!masterId) {
      const head = open[0]!;
      masterId = head.id as string;
      await admin
        .from("folios")
        .update({
          folio_type: "master",
          master_folio_id: null,
          label:
            (group.name as string | null)?.trim() ||
            (head.label as string) ||
            "Party master",
        })
        .eq("id", masterId);
    } else {
      await admin
        .from("folios")
        .update({ folio_type: "master", master_folio_id: null })
        .eq("id", masterId);
    }

    for (const f of open) {
      if (f.id === masterId) continue;
      if (f.master_folio_id === masterId) continue;
      await admin
        .from("folios")
        .update({
          master_folio_id: masterId,
          folio_type: "guest",
        })
        .eq("id", f.id as string);
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "folio.party_master",
      entityType: "booking_groups",
      entityId: gid,
      summary: `Party master folio ${String(masterId).slice(0, 8)}`,
      meta: { master_folio_id: masterId, booking_ids: bookingIds },
    });

    revalidatePath("/erp/folios");
    revalidatePath("/erp/calendar");
    return { ok: true, masterFolioId: masterId as string };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not ensure master folio.",
    };
  }
}

/** Live party money rollup — room rows with POS + due (Master Bill). */
export async function fetchPartyMasterBill(
  bookingId: string,
): Promise<
  { ok: true; data: PartyMasterBill } | { ok: false; error: string }
> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Not signed in" };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const id = bookingId.trim();
    if (!id) return { ok: false, error: "Booking required." };

    const { data: membership } = await admin
      .from("booking_group_members")
      .select("group_id, booking_groups(id, name)")
      .eq("booking_id", id)
      .maybeSingle();
    if (!membership?.group_id) {
      return { ok: false, error: "Not in a formal party yet — Link as group first." };
    }
    const groupId = membership.group_id as string;
    const gRaw = membership.booking_groups as
      | { id?: string; name?: string }
      | { id?: string; name?: string }[]
      | null;
    const g = Array.isArray(gRaw) ? gRaw[0] : gRaw;

    const ensured = await ensurePartyMasterFolio(groupId);
    if (!ensured.ok) return { ok: false, error: ensured.error };

    const { data: members } = await admin
      .from("booking_group_members")
      .select("booking_id")
      .eq("group_id", groupId);
    const bookingIds = (members ?? []).map((m) => m.booking_id as string);

    const { data: bookings } = await admin
      .from("bookings")
      .select(
        `id, contact_name, status,
         room_assignments(room_units(label))`,
      )
      .eq("property_id", propertyId)
      .in("id", bookingIds);

    const { data: folios } = await admin
      .from("folios")
      .select(
        "id, booking_id, folio_lines(id, total_btn, status, reverses_line_id, source_type)",
      )
      .eq("property_id", propertyId)
      .eq("status", "open")
      .in("booking_id", bookingIds);

    const folioByBooking = new Map(
      (folios ?? []).map((f) => [f.booking_id as string, f]),
    );

    const rooms: PartyMasterRoomRow[] = [];
    for (const b of bookings ?? []) {
      const bid = b.id as string;
      const folio = folioByBooking.get(bid);
      if (!folio) continue;

      const assigns =
        (b.room_assignments as
          | Array<{
              room_units?:
                | { label?: string }
                | { label?: string }[]
                | null;
            }>
          | null) ?? [];
      const ru = assigns[0]?.room_units;
      const unit = Array.isArray(ru) ? ru[0] : ru;
      const lines = (folio.folio_lines as Line[] | null) ?? [];
      const t = lineTotals(lines);
      rooms.push({
        bookingId: bid,
        folioId: folio.id as string,
        roomLabel: unit?.label?.trim() || null,
        contactName: (b.contact_name as string | null) ?? null,
        status: (b.status as string) ?? "pending",
        balanceBtn: t.balance,
        paidBtn: t.paid,
        chargesBtn: t.charges,
        posChargesBtn: t.pos,
      });
    }

    rooms.sort((a, b) =>
      (a.roomLabel ?? a.bookingId).localeCompare(
        b.roomLabel ?? b.bookingId,
        undefined,
        { numeric: true },
      ),
    );

    const totalDueBtn = rooms.reduce((n, r) => n + r.balanceBtn, 0);
    const totalPaidBtn = rooms.reduce((n, r) => n + r.paidBtn, 0);
    const totalChargesBtn = rooms.reduce((n, r) => n + r.chargesBtn, 0);
    const totalPosBtn = rooms.reduce((n, r) => n + r.posChargesBtn, 0);

    return {
      ok: true,
      data: {
        groupId,
        groupName: g?.name ?? null,
        masterFolioId: ensured.masterFolioId,
        rooms,
        totalDueBtn,
        totalPaidBtn,
        totalChargesBtn,
        totalPosBtn,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load master bill.",
    };
  }
}

/**
 * Charge agent AR for every party room with open due (Master collect shortcut).
 */
export async function settlePartyAgentAr(
  bookingId: string,
): Promise<
  | {
      ok: true;
      message: string;
      settled: number;
      totalBtn: number;
      failed: Array<{ folioId: string; error: string }>;
    }
  | { ok: false; error: string }
> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Not signed in" };
    }
    const bill = await fetchPartyMasterBill(bookingId);
    if (!bill.ok) return { ok: false, error: bill.error };

    const dueRooms = bill.data.rooms.filter((r) => r.balanceBtn > 0.5);
    if (dueRooms.length === 0) {
      return { ok: false, error: "No open party balances to charge." };
    }

    const { postFolioPayment } = await import("@/app/actions/erp-pos");
    let settled = 0;
    let totalBtn = 0;
    const failed: Array<{ folioId: string; error: string }> = [];

    for (const room of dueRooms) {
      const fd = new FormData();
      fd.set("folio_id", room.folioId);
      fd.set("method", "agent_credit");
      fd.set("amount_btn", String(Math.round(room.balanceBtn * 100) / 100));
      fd.set("notes", `Party master AR · ${bill.data.groupName ?? "group"}`);
      fd.set(
        "idempotency_key",
        `party_ar:${bill.data.groupId}:${room.folioId}:${room.balanceBtn}`,
      );
      const result = await postFolioPayment({ ok: false }, fd);
      if (result.ok) {
        settled += 1;
        totalBtn += room.balanceBtn;
      } else {
        failed.push({
          folioId: room.folioId,
          error: result.error ?? "Payment failed",
        });
      }
    }

    if (settled === 0) {
      return {
        ok: false,
        error: failed[0]?.error ?? "Could not charge agent AR.",
      };
    }

    revalidatePath("/erp/folios");
    revalidatePath("/erp/calendar");
    return {
      ok: true,
      settled,
      totalBtn,
      failed,
      message: `Charged agent AR on ${settled} room(s) · Nu ${Math.round(totalBtn)}${
        failed.length ? ` · ${failed.length} failed` : ""
      }`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Party AR settle failed.",
    };
  }
}
