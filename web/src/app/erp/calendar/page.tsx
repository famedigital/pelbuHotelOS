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
import {
  BOOKABLE_AGENT_STATUSES,
} from "@/lib/agents/status";
import { isDeskAuthenticated, getDeskRole } from "@/lib/desk-auth";
import { isManagerDeskRole } from "@/lib/manager-pin-core";
import { thimphuToday } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { netFolioBalance } from "@/lib/folio/balance";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/staff-auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Stay View | Pelbu OS",
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
  /** 30 / 60 / 90 days, or ~6 months (180). */
  const windowDays = [30, 60, 90, 180].includes(windowDaysRaw)
    ? windowDaysRaw
    : 30;
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
    { data: mealPlanRows },
    { data: propertyDefaults },
    { data: staffRows },
  ] = await Promise.all([
    admin
      .from("room_units")
      .select(
        "id, label, floor_label, view_label, has_balcony, sort_order, room_type_id, hk_status, service_requested_at, connecting_room_unit_id, room_types!inner(code, name, inventory_kind)",
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
         room_units(label, room_type_id, room_types(name))`,
      )
      .eq("property_id", propertyId)
      .lt("from_date", endExclusive)
      .gt("to_date", start)
      .limit(Math.min(1500, Math.max(200, windowDays * 40))),
    admin
      .from("agents")
      .select(
        "id, company_name, market, status, rate_tier, open_room_cap, commission_pct, credit_used, credit_limit",
      )
      .in("status", [...BOOKABLE_AGENT_STATUSES])
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
      // Past check-outs stay on the rail (grey OUT) for ops context
      .in("status", [
        "held",
        "pending",
        "confirmed",
        "checked_in",
        "checked_out",
      ])
      .limit(Math.min(800, Math.max(120, windowDays * 25))),
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
    admin
      .from("meal_plans")
      .select("code, name")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("sort_order"),
    admin
      .from("properties")
      .select("default_meal_plan_code")
      .eq("id", propertyId)
      .maybeSingle(),
    admin
      .from("staff_members")
      .select("id, full_name, employee_code, role_label")
      .eq("property_id", propertyId)
      .in("status", ["active", "on_leave"])
      .order("full_name")
      .limit(300),
  ]);

  const assignBookingIds = [
    ...new Set(
      (assignRows ?? [])
        .map((row) => row.booking_id as string)
        .filter(Boolean),
    ),
  ];

  const [{ data: rackBookings }, { data: rackFolios }, { data: rackGuests }] =
    assignBookingIds.length > 0
      ? await Promise.all([
          admin
            .from("bookings")
            .select(
              `id, contact_name, contact_phone, contact_email, status,
               check_in, check_out, adults, rooms, guide_number,
               payment_mode, notes, agent_id, source, booked_by_role, guest_origin,
               sold_by_staff_id, sales_claim_status,
               agents(company_name),
               sold_by_staff:staff_members!sold_by_staff_id(full_name),
               booking_group_members(group_id, booking_groups(name))`,
            )
            .eq("property_id", propertyId)
            .in("id", assignBookingIds),
          admin
            .from("folios")
            .select(
              "id, booking_id, status, folio_lines(id, total_btn, status, source_type, reverses_line_id)",
            )
            .eq("property_id", propertyId)
            .in("booking_id", assignBookingIds),
          admin
            .from("booking_guests")
            .select("booking_id, passport_or_cid, sdf_ref")
            .in("booking_id", assignBookingIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const bookingById = new Map(
    (rackBookings ?? []).map((b) => [b.id as string, b]),
  );

  /** Formal party size: room count shown on each child rack bar. */
  const groupRoomCountById = new Map<string, number>();
  for (const b of rackBookings ?? []) {
    const mems = b.booking_group_members as
      | { group_id?: string }[]
      | null;
    const gid = mems?.[0]?.group_id;
    if (!gid) continue;
    groupRoomCountById.set(gid, (groupRoomCountById.get(gid) ?? 0) + 1);
  }

  const foliosByBooking = new Map<
    string,
    {
      id: string;
      status: string;
      folio_lines?: {
        total_btn: number;
        status: string;
        source_type?: string;
        reverses_line_id?: string | null;
      }[];
    }[]
  >();
  for (const folio of rackFolios ?? []) {
    const bid = folio.booking_id as string;
    const list = foliosByBooking.get(bid) ?? [];
    list.push(folio);
    foliosByBooking.set(bid, list);
  }
  const guestsByBooking = new Map<
    string,
    { booking_id: string; passport_or_cid?: string | null; sdf_ref?: string | null }[]
  >();
  for (const guest of rackGuests ?? []) {
    const bid = guest.booking_id as string;
    const list = guestsByBooking.get(bid) ?? [];
    list.push(guest);
    guestsByBooking.set(bid, list);
  }

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
      service_requested_at: (u.service_requested_at as string | null) ?? null,
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
      const booking = bookingById.get(a.booking_id as string);
      if (!booking) return null;
      const status = booking.status as string;
      if (
        ![
          "held",
          "pending",
          "confirmed",
          "checked_in",
          "checked_out",
        ].includes(status)
      ) {
        return null;
      }

      const agent = booking.agents as
        | { company_name?: string }
        | { company_name?: string }[]
        | null;
      const agentObj = Array.isArray(agent) ? agent[0] : agent;

      const folios = foliosByBooking.get(a.booking_id as string) ?? [];
      const openFolio = folios.find((f) => f.status === "open");
      let folioBalance = 0;
      let folioHasCharges = false;
      for (const f of folios) {
        if (f.status === "settled") continue;
        folioBalance += netFolioBalance(
          (f.folio_lines as {
            id: string;
            total_btn: number;
            status: string;
            source_type?: string;
            reverses_line_id?: string | null;
          }[]) ?? [],
        );
        for (const line of (f.folio_lines as {
          id: string;
          total_btn: number;
          status: string;
          source_type?: string;
        }[]) ?? []) {
          if (
            line.status === "posted" &&
            line.source_type !== "payment" &&
            line.source_type !== "deposit" &&
            line.source_type !== "comp"
          ) {
            folioHasCharges = true;
          }
        }
      }

      const members = booking.booking_group_members as
        | {
            group_id?: string;
            booking_groups?: { name?: string } | { name?: string }[] | null;
          }[]
        | null;
      let groupName: string | null = null;
      let groupId: string | null = null;
      const firstMember = members?.[0];
      if (firstMember?.booking_groups) {
        const g = Array.isArray(firstMember.booking_groups)
          ? firstMember.booking_groups[0]
          : firstMember.booking_groups;
        groupName = g?.name ?? null;
      }
      if (firstMember?.group_id) {
        groupId = firstMember.group_id as string;
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
        guestsByBooking.get(a.booking_id as string) ?? [];
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
        sold_by_staff_id:
          (booking.sold_by_staff_id as string | null | undefined) ?? null,
        sales_claim_status:
          (booking.sales_claim_status as string | null | undefined) ?? null,
        sold_by_name: (() => {
          const raw = booking.sold_by_staff as
            | { full_name?: string }
            | { full_name?: string }[]
            | null
            | undefined;
          const s = Array.isArray(raw) ? raw[0] : raw;
          return s?.full_name ?? null;
        })(),
        group_name: groupName,
        group_room_count: groupId
          ? (groupRoomCountById.get(groupId) ?? null)
          : null,
        folio_id: openFolio?.id ?? null,
        folio_balance: folioBalance,
        folio_has_charges: folioHasCharges,
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
    rate_tier: (a.rate_tier as string | null) ?? null,
    open_room_cap:
      a.open_room_cap == null ? 15 : Number(a.open_room_cap),
    commission_pct:
      a.commission_pct == null ? null : Number(a.commission_pct),
    credit_used: Number(a.credit_used ?? 0),
    credit_limit: Number(a.credit_limit ?? 0),
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

  const staffSession = await getStaffSession();
  const staff = (staffRows ?? []).map((s) => ({
    id: s.id as string,
    full_name: (s.full_name as string) || "Staff",
    employee_code: (s.employee_code as string | null) ?? null,
    role_label: (s.role_label as string | null) ?? null,
  }));
  const defaultSoldByStaffId =
    staffSession && staffSession.propertyId === propertyId
      ? staffSession.staffId
      : "";

  return (
    <div
      data-stay-view
      className="flex min-h-0 flex-col overflow-hidden max-md:h-[calc(100svh-4rem-env(safe-area-inset-bottom,0px))] max-md:landscape:h-[100dvh] md:h-[calc(100svh-3.5rem)]"
    >
      <div className="shrink-0">
        <DeskOfflineQueueStrip defaultKind="hold_draft" />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <RoomRackGrid
          units={units}
          stays={stays}
          start={start}
          days={days}
          today={today}
          windowDays={windowDays}
          agents={agents}
          staff={staff}
          defaultSoldByStaffId={defaultSoldByStaffId}
          unassigned={unassigned}
          blocks={blocks}
          allotments={allotments}
          propertyId={propertyId}
          mealPlans={(mealPlanRows ?? []).map((m) => ({
            code: m.code as string,
            name: m.name as string,
          }))}
          defaultMealPlanCode={
            (propertyDefaults?.default_meal_plan_code as string | undefined) ??
            "EP"
          }
          canInstantApproveRates={isManagerDeskRole(await getDeskRole())}
        />
      </div>
    </div>
  );
}
