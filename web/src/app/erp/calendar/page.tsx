import {
  RoomRackGrid,
  type RackAllotment,
  type RackStay,
  type RackUnit,
  type RoomBlock,
  type UnassignedBooking,
} from "@/components/erp/RoomRackGrid";
import { DeskOfflineQueueStrip } from "@/components/erp/DeskOfflineQueueStrip";
import type { CalendarAgent } from "@/components/erp/CalendarReservationDialog";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId, thimphuToday } from "@/lib/erp-lists";
import { netFolioBalance } from "@/lib/folio/balance";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Calendar | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

type Props = {
  searchParams: Promise<{ days?: string; start?: string }>;
};

export default async function CalendarPage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();

  const windowDaysRaw = Number(sp.days ?? 30);
  const windowDays = [30, 60, 90].includes(windowDaysRaw) ? windowDaysRaw : 30;
  const start =
    sp.start && /^\d{4}-\d{2}-\d{2}$/.test(sp.start) ? sp.start : today;
  const days = Array.from({ length: windowDays }, (_, i) => addDays(start, i));
  const endExclusive = addDays(start, windowDays);

  const [
    { data: unitRows },
    { data: assignRows },
    { data: agentRows },
    { data: bookingRows },
    { data: blockRows },
    { data: allotmentRows },
  ] =
    await Promise.all([
      admin
        .from("room_units")
        .select(
          "id, label, floor_label, view_label, has_balcony, sort_order, room_type_id, hk_status, connecting_room_unit_id, room_types!inner(code, name, inventory_kind)",
        )
        .eq("property_id", propertyId)
        .eq("room_types.inventory_kind", "sellable_guest")
        .order("sort_order")
        .order("label")
        .limit(120),
      admin
        .from("room_assignments")
        .select(
          `id, booking_id, room_unit_id, from_date, to_date, is_locked, lock_reason,
           room_units(label, room_type_id, room_types(name)),
           bookings!inner(
             contact_name, contact_phone, contact_email, status,
             check_in, check_out, adults, rooms, guide_number,
             payment_mode, notes, agent_id, source, booked_by_role, guest_origin,
             agents(company_name),
             folios(id, status, folio_lines(id, total_btn, status, reverses_line_id)),
             booking_group_members(booking_groups(name)),
             booking_guests(passport_or_cid, sdf_ref)
           )`,
        )
        .eq("property_id", propertyId)
        .lt("from_date", endExclusive)
        .gt("to_date", start)
        .limit(5000),
      admin
        .from("agents")
        .select("id, company_name, market, status")
        .in("status", ["approved", "demo"])
        .order("company_name"),
      admin
        .from("bookings")
        .select(
          `id, contact_name, contact_phone, status, check_in, check_out,
           agents(company_name),
           booking_rooms(
             room_type_id, qty, inventory_kind,
             room_types(code, name)
           )`,
        )
        .eq("property_id", propertyId)
        .lt("check_in", endExclusive)
        .gt("check_out", start)
        .in("status", ["held", "pending", "confirmed", "checked_in"])
        .limit(500),
      admin
        .from("room_blocks")
        .select("id, room_unit_id, block_kind, from_date, to_date, reason")
        .eq("property_id", propertyId)
        .is("released_at", null)
        .lt("from_date", endExclusive)
        .gt("to_date", start)
        .limit(500),
      admin
        .from("agent_allotments")
        .select(
          "id, room_type_id, rooms_per_week, valid_from, valid_to, agents(company_name)",
        )
        .eq("property_id", propertyId)
        .lte("valid_from", endExclusive)
        .gte("valid_to", start)
        .limit(200),
    ]);

  const units: RackUnit[] = (unitRows ?? [])
    .map((u) => {
    const rt = u.room_types as
      | { code?: string; name?: string }
      | { code?: string; name?: string }[]
      | null;
    const type = Array.isArray(rt) ? rt[0] : rt;
    return {
      id: u.id as string,
      label: u.label as string,
      floor_label: (u.floor_label as string | null) ?? null,
      view_label: (u.view_label as string | null) ?? null,
      has_balcony: Boolean(u.has_balcony),
      sort_order: Number(u.sort_order ?? 0),
      room_type_id: u.room_type_id as string,
      room_type_code: (type?.code as string) ?? "",
      room_type_name: (type?.name as string) ?? "Room",
      hk_status: (u.hk_status as string | null) ?? null,
      connecting_room_unit_id:
        (u.connecting_room_unit_id as string | null) ?? null,
      connecting_room_label: null as string | null,
    };
  })
    .sort((a, b) => {
      const typeCmp = a.room_type_name.localeCompare(b.room_type_name);
      if (typeCmp !== 0) return typeCmp;
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.label.localeCompare(b.label, undefined, { numeric: true });
    });

  const labelById = new Map(units.map((u) => [u.id, u.label]));
  for (const u of units) {
    if (u.connecting_room_unit_id) {
      u.connecting_room_label =
        labelById.get(u.connecting_room_unit_id) ?? null;
    }
  }

  const unitLabelById = new Map(units.map((u) => [u.id, u]));

  const stays = (assignRows ?? [])
    .map((a) => {
      const b = a.bookings as Record<string, unknown> | Record<string, unknown>[] | null;
      const booking = Array.isArray(b) ? b[0] : b;
      if (!booking) return null;
      const status = booking.status as string;
      if (!["held", "pending", "confirmed", "checked_in"].includes(status)) {
        return null;
      }

      const agent = booking.agents as
        | { company_name?: string }
        | { company_name?: string }[]
        | null;
      const agentObj = Array.isArray(agent) ? agent[0] : agent;

      const folios = booking.folios as
        | {
            id: string;
            status: string;
            folio_lines?: {
              id: string;
              total_btn: number;
              status: string;
              reverses_line_id?: string | null;
            }[];
          }[]
        | null;
      const openFolio = (folios ?? []).find((f) => f.status === "open");
      let folioBalance = 0;
      for (const f of folios ?? []) {
        if (f.status === "settled") continue;
        folioBalance += netFolioBalance(f.folio_lines ?? []);
      }

      const members = booking.booking_group_members as
        | { booking_groups?: { name?: string } | { name?: string }[] | null }[]
        | null;
      let groupName: string | null = null;
      const firstMember = members?.[0];
      if (firstMember?.booking_groups) {
        const g = Array.isArray(firstMember.booking_groups)
          ? firstMember.booking_groups[0]
          : firstMember.booking_groups;
        groupName = g?.name ?? null;
      }

      const ru = a.room_units as
        | { label?: string; room_type_id?: string; room_types?: { name?: string } | { name?: string }[] }
        | { label?: string; room_type_id?: string; room_types?: { name?: string } | { name?: string }[] }[]
        | null;
      const roomUnit = Array.isArray(ru) ? ru[0] : ru;
      const rt = roomUnit?.room_types;
      const roomType = Array.isArray(rt) ? rt[0] : rt;
      const fallback = unitLabelById.get(a.room_unit_id as string);

      const guests =
        (booking.booking_guests as
          | { passport_or_cid?: string | null; sdf_ref?: string | null }[]
          | null) ?? [];
      const origin = (booking.guest_origin as string | null) ?? null;
      const needsSdf =
        origin === "international" ||
        origin === "regional" ||
        origin == null;
      const sdfIncomplete =
        needsSdf &&
        (guests.length === 0 ||
          guests.some(
            (g) =>
              !String(g.passport_or_cid ?? "").trim() ||
              !String(g.sdf_ref ?? "").trim(),
          ));

      const stay: RackStay = {
        id: a.id as string,
        booking_id: a.booking_id as string,
        room_unit_id: a.room_unit_id as string,
        from_date: a.from_date as string,
        to_date: a.to_date as string,
        is_locked: Boolean(a.is_locked),
        lock_reason: (a.lock_reason as string | null) ?? null,
        contact_name: (booking.contact_name as string | null) ?? null,
        contact_phone: (booking.contact_phone as string | null) ?? null,
        contact_email: (booking.contact_email as string | null) ?? null,
        status,
        check_in: booking.check_in as string,
        check_out: booking.check_out as string,
        adults: Number(booking.adults ?? 1),
        rooms: Number(booking.rooms ?? 1),
        guide_number: (booking.guide_number as string | null) ?? null,
        agent_id: (booking.agent_id as string | null) ?? null,
        payment_mode: (booking.payment_mode as string | null) ?? null,
        source: (booking.source as string | null) ?? null,
        booked_by_role: (booking.booked_by_role as string | null) ?? null,
        guest_origin: origin,
        notes: (booking.notes as string | null) ?? null,
        agent_name: agentObj?.company_name ?? null,
        group_name: groupName,
        folio_id: openFolio?.id ?? null,
        folio_balance: folioBalance,
        room_label: roomUnit?.label ?? fallback?.label ?? "Room",
        room_type_id:
          roomUnit?.room_type_id ?? fallback?.room_type_id ?? "",
        room_type_name:
          roomType?.name ?? fallback?.room_type_name ?? "Room",
        sdf_incomplete: sdfIncomplete,
      };
      return stay;
    })
    .filter((s): s is RackStay => s != null);

  const assignedByBookingType = new Map<string, number>();
  for (const row of assignRows ?? []) {
    const rawUnit = row.room_units as
      | { room_type_id?: string }
      | { room_type_id?: string }[]
      | null;
    const unit = Array.isArray(rawUnit) ? rawUnit[0] : rawUnit;
    if (!unit?.room_type_id) continue;
    const key = `${row.booking_id as string}:${unit.room_type_id}`;
    assignedByBookingType.set(key, (assignedByBookingType.get(key) ?? 0) + 1);
  }

  const unassigned: UnassignedBooking[] = [];
  for (const row of bookingRows ?? []) {
    const rawAgent = row.agents as
      | { company_name?: string }
      | { company_name?: string }[]
      | null;
    const agent = Array.isArray(rawAgent) ? rawAgent[0] : rawAgent;
    const rawLines = (row.booking_rooms ?? []) as Array<{
      room_type_id: string;
      qty: number;
      inventory_kind: string;
      room_types:
        | { code?: string; name?: string }
        | { code?: string; name?: string }[]
        | null;
    }>;
    const demandByType = new Map<
      string,
      { qty: number; code: string; name: string }
    >();
    for (const line of rawLines) {
      if (line.inventory_kind !== "sellable_guest" || Number(line.qty) < 1) {
        continue;
      }
      const rawType = line.room_types;
      const roomType = Array.isArray(rawType) ? rawType[0] : rawType;
      const demand = demandByType.get(line.room_type_id);
      demandByType.set(line.room_type_id, {
        qty: (demand?.qty ?? 0) + Number(line.qty),
        code: roomType?.code ?? demand?.code ?? "",
        name: roomType?.name ?? demand?.name ?? "Room",
      });
    }
    for (const [roomTypeId, demand] of demandByType) {
      const key = `${row.id as string}:${roomTypeId}`;
      const missing = Math.max(
        0,
        demand.qty - (assignedByBookingType.get(key) ?? 0),
      );
      if (!missing) continue;
      unassigned.push({
        id: key,
        booking_id: row.id as string,
        contact_name: (row.contact_name as string | null) ?? "Guest",
        contact_phone: (row.contact_phone as string | null) ?? null,
        status: row.status as string,
        check_in: row.check_in as string,
        check_out: row.check_out as string,
        room_type_id: roomTypeId,
        room_type_code: demand.code,
        room_type_name: demand.name,
        missing_rooms: missing,
        agent_name: agent?.company_name ?? null,
      });
    }
  }

  const agents: CalendarAgent[] = (agentRows ?? []).map((a) => ({
    id: a.id as string,
    company_name: a.company_name as string,
    market: a.market as string,
    status: (a.status as string) ?? "approved",
  }));

  const blocks: RoomBlock[] = (blockRows ?? []).map((block) => ({
    id: block.id as string,
    room_unit_id: block.room_unit_id as string,
    block_kind: block.block_kind as RoomBlock["block_kind"],
    from_date: block.from_date as string,
    to_date: block.to_date as string,
    reason: block.reason as string,
  }));

  const allotments: RackAllotment[] = (allotmentRows ?? []).map((row) => {
    const agent = row.agents as
      | { company_name?: string }
      | { company_name?: string }[]
      | null;
    const agentObj = Array.isArray(agent) ? agent[0] : agent;
    return {
      id: row.id as string,
      room_type_id: row.room_type_id as string,
      agent_name: agentObj?.company_name ?? "Agent",
      rooms_per_week: Number(row.rooms_per_week ?? 0),
      valid_from: row.valid_from as string,
      valid_to: row.valid_to as string,
    };
  });

  return (
    <div className="space-y-3">
      <DeskOfflineQueueStrip defaultKind="hold_draft" />
      <RoomRackGrid
        units={units}
        stays={stays}
        start={start}
        days={days}
        today={today}
        windowDays={windowDays}
        agents={agents}
        unassigned={unassigned}
        blocks={blocks}
        allotments={allotments}
        propertyId={propertyId}
      />
    </div>
  );
}
