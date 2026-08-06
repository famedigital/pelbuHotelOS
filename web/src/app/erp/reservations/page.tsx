import type { BookingRow } from "@/components/erp/BookingsTable";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { DeskMetricRow } from "@/components/erp/DeskMetricRow";
import { NewReservationLauncher } from "@/components/erp/NewReservationLauncher";
import { ReservationsAccordionTable } from "@/components/erp/ReservationsAccordionTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BOOKABLE_AGENT_STATUSES } from "@/lib/agents/status";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  bookingRoomFit,
  compareReservations,
  matchesRoomFilter,
  parseReservationSort,
  roomsNeeded,
  roomFitBadgeLabel,
} from "@/lib/erp/booking-room-fit";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { matchesQuery } from "@/lib/erp-lists";
import { loadProperty } from "@/lib/property-context";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata = {
  title: "Reservations | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const STATUSES = [
  "held",
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function buildReservationsQs(opts: {
  q?: string;
  status?: string;
  source?: string;
  room?: string;
  check_in_from?: string;
  check_in_to?: string;
  sort?: string;
  patch?: Record<string, string | undefined>;
}): string {
  const p = new URLSearchParams();
  const base = {
    q: opts.q,
    status: opts.status,
    source: opts.source,
    room: opts.room && opts.room !== "all" ? opts.room : undefined,
    check_in_from: opts.check_in_from,
    check_in_to: opts.check_in_to,
    sort: opts.sort && opts.sort !== "check_in_desc" ? opts.sort : undefined,
    ...opts.patch,
  };
  for (const [k, v] of Object.entries(base)) {
    if (v?.trim()) p.set(k, v.trim());
  }
  const s = p.toString();
  return s ? `/erp/reservations?${s}` : "/erp/reservations";
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    source?: string;
    new?: string;
    check_in?: string;
    check_out?: string;
    room_unit_id?: string;
    room?: string;
    check_in_from?: string;
    check_in_to?: string;
    sort?: string;
  }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const sp = await searchParams;
  const { q, status, source } = sp;
  const query = (q ?? "").trim();
  const roomFilter = (sp.room ?? "all").toLowerCase();
  const checkInFrom =
    sp.check_in_from && ISO.test(sp.check_in_from) ? sp.check_in_from : "";
  const checkInTo =
    sp.check_in_to && ISO.test(sp.check_in_to) ? sp.check_in_to : "";
  const sort = parseReservationSort(sp.sort);

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const property = await loadProperty(admin, propertyId);

  const [
    { data: rows },
    { data: roomTypes },
    { data: agents },
    preferredUnit,
    { data: mealPlans },
    { data: propertyDefaults },
    { data: staffRows },
  ] = await Promise.all([
    (() => {
      let req = admin
        .from("bookings")
        .select(
          `id, contact_name, contact_phone, check_in, check_out, status, source,
           guest_origin, agent_id, adults, rooms, hold_expires_at, created_at,
           agents(company_name),
           room_assignments( room_units(label) )`,
        )
        .eq("property_id", propertyId)
        .order("check_in", { ascending: false })
        .limit(250);
      if (status) req = req.eq("status", status);
      if (source) req = req.eq("source", source);
      if (checkInFrom) req = req.gte("check_in", checkInFrom);
      if (checkInTo) req = req.lte("check_in", checkInTo);
      return req;
    })(),
    property
      ? admin
          .from("room_types")
          .select("id, code, name, inventory_kind, unit_count")
          .eq("property_id", property.id)
          .order("code")
      : Promise.resolve({ data: [] }),
    admin
      .from("agents")
      .select("id, company_name, market, status")
      .in("status", [...BOOKABLE_AGENT_STATUSES])
      .order("company_name"),
    sp.room_unit_id && property
      ? admin
          .from("room_units")
          .select("id, room_type_id, room_types(code)")
          .eq("id", sp.room_unit_id)
          .eq("property_id", property.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    property
      ? admin
          .from("meal_plans")
          .select("code, name, blurb, amount_btn_per_adult_night, is_active")
          .eq("property_id", property.id)
          .eq("is_active", true)
          .order("sort_order")
      : Promise.resolve({ data: [] }),
    property
      ? admin
          .from("properties")
          .select("default_meal_plan_code")
          .eq("id", property.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    property
      ? admin
          .from("staff_members")
          .select("id, full_name, employee_code, role_label")
          .eq("property_id", property.id)
          .in("status", ["active", "on_leave"])
          .order("full_name")
          .limit(300)
      : Promise.resolve({ data: [] }),
  ]);

  const qtyByCode: Record<string, number> = {};
  const unit = preferredUnit.data;
  if (unit) {
    const rt = unit.room_types as
      | { code?: string }
      | { code?: string }[]
      | null;
    const code = Array.isArray(rt) ? rt[0]?.code : rt?.code;
    if (code) qtyByCode[code] = 1;
  }

  const enriched: BookingRow[] = (rows ?? []).map((r) => {
    const agent = r.agents as
      | { company_name?: string }
      | { company_name?: string }[]
      | null;
    const agentName = Array.isArray(agent)
      ? (agent[0]?.company_name ?? null)
      : (agent?.company_name ?? null);

    const assignments = (r.room_assignments as
      | Array<{
          room_units:
            | { label?: string }
            | { label?: string }[]
            | null;
        }>
      | null) ?? [];

    const labels: string[] = [];
    for (const a of assignments) {
      const ru = a.room_units;
      const unitRow = Array.isArray(ru) ? ru[0] : ru;
      const label = unitRow?.label?.trim();
      if (label) labels.push(label);
    }
    labels.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const roomLabels = labels.join(", ");
    const assignedCount = assignments.length;
    const rooms = (r.rooms as number) ?? null;
    const statusVal = (r.status as string) ?? null;
    const fit = bookingRoomFit({
      status: statusVal,
      rooms,
      assignedCount,
    });
    const needed = roomsNeeded(rooms);
    const badge = roomFitBadgeLabel(fit, assignedCount, needed, roomLabels);

    const badges: BookingRow["badges"] =
      fit === "n_a"
        ? roomLabels
          ? [{ key: "rooms", label: roomLabels, tone: "info" }]
          : undefined
        : [
            {
              key: "room_fit",
              label: badge.label,
              tone:
                badge.tone === "muted"
                  ? "info"
                  : badge.tone === "ok"
                    ? "ok"
                    : badge.tone === "warn"
                      ? "warn"
                      : "danger",
            },
          ];

    return {
      id: r.id as string,
      contact_name: (r.contact_name as string) ?? null,
      contact_phone: (r.contact_phone as string) ?? null,
      check_in: (r.check_in as string) ?? null,
      check_out: (r.check_out as string) ?? null,
      source: (r.source as string) ?? null,
      agent_id: (r.agent_id as string | null) ?? null,
      agent_name: agentName,
      adults: (r.adults as number) ?? null,
      rooms,
      status: statusVal,
      created_at: (r.created_at as string | null) ?? null,
      assigned_count: assignedCount,
      room_labels: roomLabels || null,
      room_fit: fit,
      badges,
    };
  });

  const afterSearch = enriched.filter((r) =>
    matchesQuery(
      [r.contact_name, r.contact_phone, r.id, r.source, r.agent_name, r.room_labels],
      query,
    ),
  );

  // Counts for metric chips among search+status+date results (before room filter)
  const needsOnly = afterSearch.filter((r) => r.room_fit === "none").length;
  const partialOnly = afterSearch.filter((r) => r.room_fit === "partial").length;
  const fullOnly = afterSearch.filter((r) => r.room_fit === "full").length;

  const filtered = afterSearch
    .filter((r) => matchesRoomFilter(r.room_fit ?? "n_a", roomFilter))
    .sort((a, b) => compareReservations(a, b, sort));

  const staffSession = await getStaffSession();
  const fastBookForm = {
    roomTypes: (roomTypes ?? []).map((r) => ({
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
      inventory_kind: r.inventory_kind as string,
      unit_count: Number(r.unit_count ?? 0),
    })),
    agents: (agents ?? []).map((a) => ({
      id: a.id as string,
      company_name: a.company_name as string,
      market: a.market as string,
      status: a.status as string,
    })),
    staff: (staffRows ?? []).map((s) => ({
      id: s.id as string,
      full_name: (s.full_name as string) || "Staff",
      employee_code: (s.employee_code as string | null) ?? null,
      role_label: (s.role_label as string | null) ?? null,
    })),
    defaultSoldByStaffId:
      staffSession && staffSession.propertyId === propertyId
        ? staffSession.staffId
        : "",
    property: property
      ? {
          name: property.name,
          legal_name: property.legal_name,
          address: property.address,
          phone: property.phone,
          email: property.email,
          tax_id: property.tax_id,
          logo_public_id: property.logo_public_id,
        }
      : undefined,
    invoiceDesign: property?.doc_invoice,
    voucherDesign: property?.doc_voucher,
    defaults: {
      checkIn: sp.check_in,
      checkOut: sp.check_out,
      roomUnitId: unit?.id as string | undefined,
      qtyByCode,
      mealPlanCode:
        (propertyDefaults?.default_meal_plan_code as string | undefined) ??
        "EP",
      guestOrigin: "regional",
    },
    mealPlans: (mealPlans ?? []).map((m) => ({
      code: m.code as string,
      name: m.name as string,
      blurb: (m.blurb as string | null) ?? null,
      amountPerAdultNight:
        m.amount_btn_per_adult_night == null
          ? null
          : Number(m.amount_btn_per_adult_night),
    })),
  };

  const filterBase = {
    q: query || undefined,
    status: status || undefined,
    source: source || undefined,
    check_in_from: checkInFrom || undefined,
    check_in_to: checkInTo || undefined,
    sort: sort !== "check_in_desc" ? sort : undefined,
  };

  const needsRoomFilter = roomFilter === "needs_room";

  return (
    <DeskListShell
      eyebrow="Bookings"
      heading="All reservations"
      blurb="Every booking at this property. Room column shows assigned units (PMS-style). Filter Needs room / Partial to find stays without room numbers. Assign on the calendar rack or StayHub. Today’s arrivals / in-house / departures have dedicated boards."
      headerAside={
        <Suspense
          fallback={
            <Button variant="citrus" className="h-11" disabled>
              New reservation
            </Button>
          }
        >
          <NewReservationLauncher form={fastBookForm} />
        </Suspense>
      }
      metrics={
        <DeskMetricRow
          metrics={[
            {
              label: "Needs room",
              value: String(needsOnly),
              href: buildReservationsQs({
                ...filterBase,
                room: "needs_room",
              }),
              tone: needsOnly > 0 ? "destructive" : "default",
              hint: "No physical units yet",
            },
            {
              label: "Partial",
              value: String(partialOnly),
              href: buildReservationsQs({
                ...filterBase,
                room: "partial",
              }),
              tone: partialOnly > 0 ? "destructive" : "default",
              hint: "Some rooms assigned",
            },
            {
              label: "Rooms OK",
              value: String(fullOnly),
              href: buildReservationsQs({
                ...filterBase,
                room: "assigned",
              }),
              tone: "accent",
              hint: "Fully assigned",
            },
            {
              label: "Shown",
              value: String(filtered.length),
              href: buildReservationsQs({ ...filterBase, room: "all" }),
            },
          ]}
        />
      }
      filters={
        <form
          className="flex flex-wrap items-end gap-2"
          action="/erp/reservations"
          method="get"
        >
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <label htmlFor="q" className="sr-only">
              Search
            </label>
            <Input
              id="q"
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Guest, phone, agent, room, booking id…"
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-[10px] font-medium text-muted-foreground">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status ?? ""}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="room" className="text-[10px] font-medium text-muted-foreground">
              Rooms
            </label>
            <select
              id="room"
              name="room"
              defaultValue={roomFilter === "all" ? "" : roomFilter}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="">All room fits</option>
              <option value="needs_room">Needs room (none + partial)</option>
              <option value="partial">Partial only</option>
              <option value="assigned">Fully assigned</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="check_in_from"
              className="text-[10px] font-medium text-muted-foreground"
            >
              Arrival from
            </label>
            <Input
              id="check_in_from"
              type="date"
              name="check_in_from"
              defaultValue={checkInFrom}
              className="h-10 w-[10.5rem]"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="check_in_to"
              className="text-[10px] font-medium text-muted-foreground"
            >
              Arrival to
            </label>
            <Input
              id="check_in_to"
              type="date"
              name="check_in_to"
              defaultValue={checkInTo}
              className="h-10 w-[10.5rem]"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sort" className="text-[10px] font-medium text-muted-foreground">
              Sort
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={sort}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="check_in_desc">Arrival · latest first</option>
              <option value="check_in_asc">Arrival · soonest first</option>
              <option value="needs_room_first">Needs room first</option>
              <option value="created_desc">Recently created</option>
              <option value="name_asc">Guest A–Z</option>
            </select>
          </div>
          <div className="w-28 space-y-1.5">
            <label htmlFor="source" className="text-[10px] font-medium text-muted-foreground">
              Source
            </label>
            <Input
              id="source"
              name="source"
              defaultValue={source ?? ""}
              placeholder="Source"
              className="h-10"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10">
            Apply
          </Button>
          {needsRoomFilter || query || status || checkInFrom || checkInTo ? (
            <Button asChild type="button" variant="ghost" className="h-10">
              <Link href="/erp/reservations">Clear</Link>
            </Button>
          ) : null}
        </form>
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>
          {filtered.length} shown
          {roomFilter !== "all" ? ` · room filter: ${roomFilter.replace(/_/g, " ")}` : ""}
        </p>
        {needsRoomFilter || needsOnly > 0 ? (
          <Link
            href="/erp/calendar"
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            Assign on calendar →
          </Link>
        ) : null}
      </div>
      <Suspense
        fallback={
          <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            Loading reservations…
          </p>
        }
      >
        <ReservationsAccordionTable
          data={filtered}
          emptyMessage="No reservations match these filters."
        />
      </Suspense>
    </DeskListShell>
  );
}
