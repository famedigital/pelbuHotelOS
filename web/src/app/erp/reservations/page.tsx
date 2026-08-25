import type { BookingRow } from "@/components/erp/BookingsTable";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { DeskMetricRow } from "@/components/erp/DeskMetricRow";
import { NewReservationLauncher } from "@/components/erp/NewReservationLauncher";
import { ReservationsListCacheBridge } from "@/components/erp/ReservationsListCacheBridge";
import { ReservationsFilterForm } from "@/components/erp/ReservationsFilterForm";
import { ReservationsPartyBoard } from "@/components/erp/ReservationsPartyBoard";
import { ReservationsStatusChrome } from "@/components/erp/ReservationsStatusChrome";
import { Button } from "@/components/ui/button";
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
import {
  buildReservationParties,
  type BookingGroupMembership,
} from "@/lib/erp/reservation-party";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { fmtDate, matchesQuery } from "@/lib/erp-lists";
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

function buildReservationsQs(opts: {
  q?: string;
  status?: string;
  source?: string;
  room?: string;
  check_in_from?: string;
  check_in_to?: string;
  sort?: string;
  bucket?: string;
  worklist?: string;
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
    bucket: opts.bucket && opts.bucket !== "all" ? opts.bucket : undefined,
    worklist: opts.worklist || undefined,
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
    bucket?: string;
    worklist?: string;
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

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const property = await loadProperty(admin, propertyId);

  const [
    { data: rows },
    { data: countRows },
    { data: roomTypes },
    { data: agents },
    preferredUnit,
    { data: mealPlans },
    { data: propertyDefaults },
    { data: staffRows },
    { data: groupMemberRows },
    { data: cleanUnits },
  ] = await Promise.all([
    (() => {
      let req = admin
        .from("bookings")
        .select(
          `id, confirmation_code, contact_name, contact_phone, check_in, check_out, status, source,
           guest_origin, agent_id, adults, rooms, hold_expires_at, created_at,
           token_required_btn, token_received_btn, deposit_due_on,
           agents(company_name),
           room_assignments( room_units(label) )`,
        )
        .eq("property_id", propertyId)
        .order("check_in", { ascending: sort === "check_in_asc" })
        .limit(listLimit);
      if (status) {
        req = req.eq("status", status);
      } else {
        const statuses = statusesForBucket(bucket);
        if (statuses) req = req.in("status", statuses);
      }
      if (source) req = req.eq("source", source);
      // Inclusive arrival window on date column (YYYY-MM-DD)
      if (checkInFrom) req = req.gte("check_in", checkInFrom);
      if (checkInTo) req = req.lte("check_in", checkInTo);
      return req;
    })(),
    admin
      .from("bookings")
      .select("status, token_required_btn, token_received_btn")
      .eq("property_id", propertyId)
      .limit(2000),
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
    admin
      .from("booking_group_members")
      .select(
        "booking_id, group_id, booking_groups(id, name, status, property_id)",
      )
      .limit(2000),
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

  const bucketCounts = {
    active: 0,
    cancelled: 0,
    no_show: 0,
    checked_out: 0,
    all: 0,
    deposit_due: 0,
  };
  for (const r of countRows ?? []) {
    const st = (r.status as string) ?? "";
    bucketCounts.all += 1;
    if (["held", "pending", "confirmed", "checked_in"].includes(st)) {
      bucketCounts.active += 1;
    } else if (st === "cancelled") bucketCounts.cancelled += 1;
    else if (st === "no_show") bucketCounts.no_show += 1;
    else if (st === "checked_out") bucketCounts.checked_out += 1;
    if (["held", "pending", "confirmed"].includes(st)) {
      const req = Number(r.token_required_btn ?? 0);
      const got = Number(r.token_received_btn ?? 0);
      if (req > 0 && got + 0.009 < req) bucketCounts.deposit_due += 1;
    }
  }

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

  let afterSearch = enriched.filter((r) =>
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

  // Defense-in-depth: re-apply arrival window in app space (timestamptz-safe).
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

  const needsOnly = afterSearch.filter((r) => r.room_fit === "none").length;
  const partialOnly = afterSearch.filter((r) => r.room_fit === "partial").length;
  const fullOnly = afterSearch.filter((r) => r.room_fit === "full").length;

  const filtered = afterSearch
    .filter((r) => matchesRoomFilter(r.room_fit ?? "n_a", roomFilter))
    .sort((a, b) => compareReservations(a, b, sort));

  const memberships: BookingGroupMembership[] = [];
  for (const row of groupMemberRows ?? []) {
    const gRaw = row.booking_groups as
      | { id?: string; name?: string; status?: string; property_id?: string }
      | {
          id?: string;
          name?: string;
          status?: string;
          property_id?: string;
        }[]
      | null;
    const g = Array.isArray(gRaw) ? gRaw[0] : gRaw;
    if (!g?.id || g.property_id !== propertyId) continue;
    memberships.push({
      bookingId: row.booking_id as string,
      groupId: g.id,
      groupName: (g.name as string) || "Group",
      groupStatus: (g.status as string | null) ?? null,
    });
  }

  const parties = buildReservationParties(filtered, memberships);
  const partyCount = parties.filter((p) => p.kind === "group").length;
  const suggestedCount = parties.filter((p) => p.kind === "suggested").length;

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
  };

  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries(filterBase)) {
    if (v) exportParams.set(k, v);
  }
  const exportHref = `/erp/reservations/export?${exportParams.toString()}`;
  const printHref = `/erp/reservations/print?${exportParams.toString()}`;

  const needsRoomFilter = roomFilter === "needs_room";
  const hasActiveFilters = Boolean(
    needsRoomFilter ||
      query ||
      status ||
      checkInFrom ||
      checkInTo ||
      worklist ||
      bucket !== "all" ||
      (source && source.trim()) ||
      roomFilter !== "all",
  );

  const arrivalWindowLabel =
    checkInFrom && checkInTo
      ? checkInFrom === checkInTo
        ? fmtDate(checkInFrom)
        : `${fmtDate(checkInFrom)} – ${fmtDate(checkInTo)}`
      : checkInFrom
        ? `From ${fmtDate(checkInFrom)}`
        : checkInTo
          ? `Until ${fmtDate(checkInTo)}`
          : null;

  return (
    <DeskListShell
      eyebrow="Front office"
      heading="Reservations"
      subtitle={
        worklist === "deposit_due"
          ? "Deposit due — token required not yet fully received."
          : "Multi-room parties roll up. Filter by arrival window, status, and room fit."
      }
      help={
        worklist === "deposit_due" ? (
          <p>
            Worklist of held / pending / confirmed stays where token received
            is short of token required. Status chips and party board still
            apply within this set.
          </p>
        ) : (
          <div className="space-y-2">
            <p>
              Arrival From / To filters check-in date only (not in-house span).
              Selecting From updates To to the last day of that month when To
              is empty, earlier, or in another month.
            </p>
            <p>
              Status strip uses eZee-style Active / Cancelled / No-show /
              Departed buckets. Export and print respect the current filters.
            </p>
          </div>
        )
      }
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
              hint: "No units yet",
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
              label: "Parties",
              value: String(partyCount),
              href: "/erp/group",
              tone: "accent",
              hint: "Formal groups",
            },
            {
              label: "Suggested",
              value: String(suggestedCount),
              href: buildReservationsQs({ ...filterBase, room: "all" }),
              tone: suggestedCount > 0 ? "destructive" : "default",
              hint: "Same agent + dates",
            },
            {
              label: "In view",
              value: String(parties.length),
              href: buildReservationsQs({ ...filterBase, room: "all" }),
              hint: `${filtered.length} booking${filtered.length === 1 ? "" : "s"}`,
            },
          ]}
        />
      }
      filters={
        <ReservationsFilterForm
          key={[
            query,
            status ?? "",
            source ?? "",
            roomFilter,
            checkInFrom,
            checkInTo,
            sort,
            bucket,
            worklist,
          ].join("|")}
          q={query}
          status={status ?? ""}
          source={source ?? ""}
          roomFilter={roomFilter}
          checkInFrom={checkInFrom}
          checkInTo={checkInTo}
          sort={sort}
          bucket={bucket}
          worklist={worklist}
          hasActiveFilters={hasActiveFilters}
        />
      }
    >
      <ReservationsStatusChrome
        bucket={bucket}
        counts={bucketCounts}
        queryBase={{
          q: query || undefined,
          source: source || undefined,
          room: roomFilter !== "all" ? roomFilter : undefined,
          check_in_from: checkInFrom || undefined,
          check_in_to: checkInTo || undefined,
          sort: sort !== "check_in_desc" ? sort : undefined,
          worklist: worklist || undefined,
        }}
        exportHref={exportHref}
        printHref={printHref}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            {parties.length} part{parties.length === 1 ? "y" : "ies"}
            <span className="font-normal text-muted-foreground">
              {" "}
              · {filtered.length} reservation
              {filtered.length === 1 ? "" : "s"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {arrivalWindowLabel ? (
              <span>
                Arrivals <span className="text-foreground">{arrivalWindowLabel}</span>
              </span>
            ) : (
              <span>All arrival dates</span>
            )}
            {roomFilter !== "all"
              ? ` · ${roomFilter.replace(/_/g, " ")}`
              : ""}
            {suggestedCount > 0
              ? ` · ${suggestedCount} suggested multi-room`
              : ""}
            {worklist === "deposit_due" ? " · deposit due only" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <ReservationsListCacheBridge
            propertyId={propertyId}
            bucket={bucket}
            rowCount={parties.length}
          />
          {needsRoomFilter || needsOnly > 0 ? (
            <Link
              href="/erp/calendar"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              Assign on calendar
            </Link>
          ) : null}
          <Link
            href="/erp/group"
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            Groups desk
          </Link>
          <Link
            href="/erp/arrivals"
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            Today&apos;s arrivals
          </Link>
        </div>
      </div>
      <Suspense
        fallback={
          <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            Loading reservations…
          </p>
        }
      >
        <ReservationsPartyBoard
          parties={parties}
          emptyMessage={
            hasDateFilter
              ? `No reservations with check-in ${arrivalWindowLabel ?? "in this window"}.`
              : "No reservations match these filters."
          }
        />
      </Suspense>
    </DeskListShell>
  );
}
