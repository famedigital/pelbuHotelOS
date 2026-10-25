import type { BookingRow } from "@/components/erp/BookingsTable";
import { NewReservationLauncher } from "@/components/erp/NewReservationLauncher";
import { ReservationsListCacheBridge } from "@/components/erp/ReservationsListCacheBridge";
import { OccupancyRange } from "@/components/erp/OccupancyRange";
import {
  ReservationsDeskTable,
  type ReservationDeskRow,
  type ReservationDoor,
} from "@/components/erp/ReservationsDeskTable";
import { BOOKABLE_AGENT_STATUSES } from "@/lib/agents/status";
import { isDeskAuthenticated, getDeskRole } from "@/lib/desk-auth";
import { isManagerDeskRole } from "@/lib/manager-pin-core";
import {
  bookingRoomFit,
  compareReservations,
  matchesRoomFilter,
  parseReservationSort,
  roomsNeeded,
  roomFitBadgeLabel,
} from "@/lib/erp/booking-room-fit";
import {
  checkInWithinRange,
  normalizeArrivalRange,
} from "@/lib/erp/reservation-date-range";
import {
  parseReservationStatusBucket,
  statusesForBucket,
} from "@/lib/erp/reservation-status-buckets";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { loadOccupancyNights } from "@/lib/erp/load-occupancy";
import { addIsoDays } from "@/lib/erp/occupancy-nights";
import { matchesQuery, thimphuToday } from "@/lib/erp-lists";
import {
  applyReservationView,
  parseReservationView,
} from "@/lib/erp/reservation-views";
import { loadProperty } from "@/lib/property-context";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata = {
  title: "Reservations",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

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
    bucket?: string;
    worklist?: string;
    view?: string;
    occ_from?: string;
    occ_to?: string;
  }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const sp = await searchParams;
  const { q, status, source } = sp;
  const query = (q ?? "").trim();
  const roomFilter = (sp.room ?? "all").toLowerCase();
  const { from: checkInFrom, to: checkInTo } = normalizeArrivalRange(
    sp.check_in_from,
    sp.check_in_to,
  );
  const hasDateFilter = Boolean(checkInFrom || checkInTo);
  const listLimit = hasDateFilter ? 1000 : 250;
  const sort = parseReservationSort(sp.sort);
  const bucket = parseReservationStatusBucket(sp.bucket);
  const worklist = (sp.worklist ?? "").trim();
  const view = parseReservationView(sp.view);
  const today = thimphuToday();

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
    { data: cleanUnits },
  ] = await Promise.all([
    (() => {
      let req = admin
        .from("bookings")
        .select(
          `id, confirmation_code, contact_name, contact_phone, check_in, check_out, status, source,
           guest_origin, agent_id, adults, rooms, meal_plan_code, quoted_total_btn, guide_number,
           hold_expires_at, created_at, folios(id),
           token_required_btn, token_received_btn, deposit_due_on,
           agents(company_name), guides(full_name, phone),
           booking_rooms(room_type_id, inventory_kind),
           room_assignments(id, room_unit_id, room_units(label, sort_order, room_type_id))`,
        )
        .eq("property_id", propertyId);
      if (view === "all") {
        req = req
          .order("check_in", { ascending: sort === "check_in_asc" })
          .limit(listLimit);
        if (status) {
          req = req.eq("status", status);
        } else {
          const statuses = statusesForBucket(bucket);
          if (statuses) req = req.in("status", statuses);
        }
        if (source) req = req.eq("source", source);
        if (checkInFrom) req = req.gte("check_in", checkInFrom);
        if (checkInTo) req = req.lte("check_in", checkInTo);
      } else {
        req = applyReservationView(
          req.order("contact_name", { ascending: true }).limit(400),
          view,
          today,
        );
      }
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
      .select(
        "id, company_name, market, status, rate_tier, open_room_cap, commission_pct, credit_used, credit_limit",
      )
      .in("status", [...BOOKABLE_AGENT_STATUSES])
      .order("company_name"),
    sp.room_unit_id && property
      ? admin
          .from("room_units")
          .select("id, label, room_type_id, room_types(code)")
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
    property
      ? admin
          .from("room_units")
          .select("id, label, room_type_id, hk_status")
          .eq("property_id", property.id)
          .in("hk_status", ["clean", "inspect", "dirty", "occupied"])
          .order("label")
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

    const assignments =
      (r.room_assignments as
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

    const badges: NonNullable<BookingRow["badges"]> =
      fit === "n_a"
        ? roomLabels
          ? [{ key: "rooms", label: roomLabels, tone: "info" }]
          : []
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

    const tokenReq = Number(r.token_required_btn ?? 0);
    const tokenGot = Number(r.token_received_btn ?? 0);
    if (
      tokenReq > 0 &&
      tokenGot + 0.009 < tokenReq &&
      ["held", "pending", "confirmed"].includes(statusVal ?? "")
    ) {
      badges.push({
        key: "deposit",
        label: "Deposit due",
        tone: "danger",
      });
    }

    return {
      id: r.id as string,
      confirmation_code: (r.confirmation_code as string | null) ?? null,
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
      badges: badges.length ? badges : undefined,
    };
  });

  let afterSearch = enriched;
  if (view === "all") {
    afterSearch = enriched.filter((r) =>
      matchesQuery(
        [
          r.contact_name,
          r.contact_phone,
          r.id,
          r.confirmation_code,
          r.source,
          r.agent_name,
          r.room_labels,
        ],
        query,
      ),
    );
    if (hasDateFilter) {
      afterSearch = afterSearch.filter((r) =>
        checkInWithinRange(r.check_in, checkInFrom, checkInTo),
      );
    }
    if (worklist === "deposit_due") {
      afterSearch = afterSearch.filter((r) =>
        (r.badges ?? []).some((b) => b.key === "deposit"),
      );
    }
  }

  const filtered = afterSearch
    .filter((r) => matchesRoomFilter(r.room_fit ?? "n_a", roomFilter))
    .sort((a, b) => compareReservations(a, b, sort));

  const visibleOrder = new Map(filtered.map((row, index) => [row.id, index]));
  const deskRows: ReservationDeskRow[] = (rows ?? [])
    .filter((row) => visibleOrder.has(row.id as string))
    .map((row) => {
      const agent = row.agents as
        | { company_name?: string }
        | { company_name?: string }[]
        | null;
      const agentName = Array.isArray(agent)
        ? (agent[0]?.company_name ?? null)
        : (agent?.company_name ?? null);
      const assignments =
        (row.room_assignments as
          | Array<{
              id?: string;
              room_unit_id?: string;
              room_units?:
                | { label?: string; sort_order?: number; room_type_id?: string }
                | { label?: string; sort_order?: number; room_type_id?: string }[]
                | null;
            }>
          | null) ?? [];
      const doorOpen = ["checked_in", "checked_out"].includes(
        String(row.status ?? ""),
      );
      const doorsOnStay = assignments
        .map((assignment) => {
          const unit = Array.isArray(assignment.room_units)
            ? assignment.room_units[0]
            : assignment.room_units;
          const serial =
            unit?.sort_order != null && Number(unit.sort_order) > 0
              ? String(unit.sort_order)
              : "";
          return {
            assignmentId: assignment.id ?? null,
            roomUnitId: assignment.room_unit_id ?? null,
            label: doorOpen
              ? unit?.label?.trim() || ""
              : serial || unit?.label?.trim() || "",
            roomTypeId: unit?.room_type_id ?? null,
          };
        })
        .filter((door) => door.label);
      doorsOnStay.sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true }),
      );
      const sold = (
        (row.booking_rooms as
          | Array<{ room_type_id?: string; inventory_kind?: string }>
          | null) ?? []
      ).find((line) => (line.inventory_kind ?? "sellable_guest") === "sellable_guest");
      const first = doorsOnStay[0];
      const folios = row.folios as
        | { id?: string }
        | { id?: string }[]
        | null;
      const folio = Array.isArray(folios) ? folios[0] : folios;
      return {
        id: row.id as string,
        confirmationCode: (row.confirmation_code as string | null) ?? null,
        guest: (row.contact_name as string | null) ?? null,
        phone: (row.contact_phone as string | null) ?? null,
        agentId: (row.agent_id as string | null) ?? null,
        agentName,
        checkIn: (row.check_in as string | null) ?? null,
        checkOut: (row.check_out as string | null) ?? null,
        status: (row.status as string | null) ?? null,
        rooms: Number(row.rooms ?? doorsOnStay.length ?? 1),
        roomLabels: doorsOnStay.map((door) => door.label).join(", ") || null,
        assignmentId: doorsOnStay.length === 1 ? first?.assignmentId ?? null : null,
        roomUnitId: doorsOnStay.length === 1 ? first?.roomUnitId ?? null : null,
        roomTypeId:
          (doorsOnStay.length === 1 ? first?.roomTypeId : null) ??
          (sold?.room_type_id as string | undefined) ??
          null,
        assignmentCount: doorsOnStay.length,
        folioId: (folio?.id as string | undefined) ?? null,
        guide: (() => {
          const guide = row.guides as
            | { full_name?: string; phone?: string }
            | { full_name?: string; phone?: string }[]
            | null;
          const person = Array.isArray(guide) ? guide[0] : guide;
          return person?.phone || person?.full_name || (row.guide_number as string | null) || null;
        })(),
        meal: (row.meal_plan_code as string | null) ?? null,
        quotedTotal:
          row.quoted_total_btn == null ? null : Number(row.quoted_total_btn),
        hasInvoice: false,
      };
    })
    .sort(
      (a, b) =>
        (visibleOrder.get(a.id) ?? 0) - (visibleOrder.get(b.id) ?? 0),
    );
  const doors: ReservationDoor[] = (cleanUnits ?? []).map((unit) => ({
    id: unit.id as string,
    label: (unit.label as string) || "—",
    roomTypeId: unit.room_type_id as string,
  }));

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
      rate_tier: (a.rate_tier as string | null) ?? null,
      open_room_cap: a.open_room_cap == null ? 15 : Number(a.open_room_cap),
      commission_pct:
        a.commission_pct == null ? null : Number(a.commission_pct),
      credit_used: Number(a.credit_used ?? 0),
      credit_limit: Number(a.credit_limit ?? 0),
    })),
    staff: (staffRows ?? []).map((s) => ({
      id: s.id as string,
      full_name: (s.full_name as string) || "Staff",
      employee_code: (s.employee_code as string | null) ?? null,
      role_label: (s.role_label as string | null) ?? null,
    })),
    cleanUnits: (cleanUnits ?? []).map((u) => ({
      id: u.id as string,
      label: (u.label as string) || "—",
      roomTypeId: u.room_type_id as string,
      hkStatus: (u.hk_status as string) || "clean",
    })),
    defaultSoldByStaffId:
      staffSession && staffSession.propertyId === propertyId
        ? staffSession.staffId
        : "",
    property: property
      ? {
          id: property.id,
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
    registrationDesign: property?.doc_registration,
    defaults: {
      checkIn: sp.check_in,
      checkOut: sp.check_out,
      roomUnitId: unit?.id as string | undefined,
      roomUnitLabel: (unit?.label as string | undefined) ?? undefined,
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
    canInstantApproveRates: isManagerDeskRole(await getDeskRole()),
  };

  const filterBase = {
    q: query || undefined,
    status: status || undefined,
    source: source || undefined,
    check_in_from: checkInFrom || undefined,
    check_in_to: checkInTo || undefined,
    sort: sort !== "check_in_desc" ? sort : undefined,
    bucket: bucket !== "all" ? bucket : undefined,
    worklist: worklist || undefined,
    view: view !== "in_house" ? view : undefined,
  };

  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries(filterBase)) {
    if (v) exportParams.set(k, v);
  }
  const exportHref = `/erp/reservations/export?${exportParams.toString()}`;
  const printHref = `/erp/reservations/print?${exportParams.toString()}`;

  const occFrom =
    sp.occ_from && /^\d{4}-\d{2}-\d{2}$/.test(sp.occ_from) ? sp.occ_from : today;
  const occTo =
    sp.occ_to && /^\d{4}-\d{2}-\d{2}$/.test(sp.occ_to)
      ? sp.occ_to
      : addIsoDays(today, 6);
  const nights = await loadOccupancyNights(
    admin,
    propertyId,
    occFrom,
    occTo < occFrom ? occFrom : occTo,
  );
  const folioIds = deskRows.map((row) => row.folioId).filter(Boolean) as string[];
  if (folioIds.length) {
    const { data: docs } = await admin
      .from("fiscal_documents")
      .select("folio_id, status")
      .in("folio_id", folioIds)
      .in("status", ["issued", "sent"]);
    const issued = new Set((docs ?? []).map((doc) => doc.folio_id as string));
    for (const row of deskRows) {
      if (row.folioId && issued.has(row.folioId)) row.hasInvoice = true;
    }
  }

  const views = [
    ["arrivals", "Arrivals", "/erp/reservations?view=arrivals"],
    ["departures", "Departures", "/erp/reservations?view=departures"],
    ["in_house", "In house", "/erp/reservations"],
    ["upcoming", "Upcoming", "/erp/reservations?view=upcoming"],
    ["all", "All", "/erp/reservations?view=all"],
  ] as const;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-1.5">
        <h1 className="text-sm font-semibold">Reservations</h1>
        {views.map(([id, label, href]) => (
          <a
            key={id}
            href={href}
            className={
              view === id
                ? "inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-sm text-primary-foreground"
                : "inline-flex h-8 items-center rounded-md px-2.5 text-sm text-muted-foreground hover:bg-muted"
            }
          >
            {label}
          </a>
        ))}
        <a href="/erp/day#bills" className="inline-flex h-8 items-center rounded-md border px-2.5 text-sm font-medium">
          Bills to print
        </a>
        <a href={exportHref} className="inline-flex h-8 items-center rounded-md border px-2.5 text-sm">
          Export
        </a>
        <a href={printHref} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-md border px-2.5 text-sm">
          Print
        </a>
        <Suspense fallback={null}>
          <NewReservationLauncher form={fastBookForm} />
        </Suspense>
      </div>
      <div className="border-b px-3 py-1">
        <OccupancyRange
          from={occFrom}
          to={occTo < occFrom ? occFrom : occTo}
          nights={nights}
          hidden={view === "in_house" ? undefined : { view }}
        />
      </div>
      <ReservationsListCacheBridge
        propertyId={propertyId}
        bucket={view}
        rowCount={deskRows.length}
      />
      <ReservationsDeskTable
        rows={deskRows}
        doors={doors}
        view={view}
        allowRoomEdit={view === "in_house" || view === "arrivals"}
      />
    </div>
  );
}
