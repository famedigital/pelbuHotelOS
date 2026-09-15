import {
  loadBuildingLayout,
  loadBuildingSpaces,
} from "@/app/actions/erp-building-layout";
import {
  RoomMapShell,
  type RoomMapUnit,
} from "@/components/erp/RoomMapShell";
import {
  ROOM_MAP_CORE_FACETS,
  deriveStayState,
  type StayState,
} from "@/components/erp/room-map-shared";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { thimphuToday } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Floor map",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type StayInfo = {
  guestName: string | null;
  stayState: StayState;
  personCount: number | null;
  assignmentId: string | null;
  bookingId: string | null;
  adults: number;
  children: number;
};

export default async function RoomFloorMapPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();

  const [{ data: units }, layout, spaces] = await Promise.all([
    admin
      .from("room_units")
      .select(
        `id, label, floor_label, view_label, facade_side, has_balcony, hk_status,
         pos_x, pos_y,
         room_types(code, name, inventory_kind)`,
      )
      .eq("property_id", propertyId)
      .order("label")
      .limit(200),
    loadBuildingLayout(propertyId),
    loadBuildingSpaces(propertyId),
  ]);

  const unitIds = (units ?? []).map((u) => u.id as string);

  const stayByUnit = new Map<string, StayInfo>();
  const maintUnits = new Set<string>();
  const mediaFacetsByUnit = new Map<string, Set<string>>();

  if (unitIds.length > 0) {
    const [{ data: stays }, { data: maint }, { data: unitMedia }] =
      await Promise.all([
        admin
          .from("room_assignments")
          .select(
            `id, room_unit_id, from_date, to_date,
             bookings!inner(
               id, contact_name, status, adults, children, check_out
             )`,
          )
          .in("room_unit_id", unitIds)
          .lte("from_date", today)
          .gt("to_date", today)
          .limit(400),
        admin
          .from("maintenance_orders")
          .select("room_unit_id")
          .eq("property_id", propertyId)
          .in("room_unit_id", unitIds)
          .in("status", ["open", "in_progress"])
          .limit(200),
        admin
          .from("property_media")
          .select("scope_id, facet")
          .eq("property_id", propertyId)
          .eq("scope", "room_unit")
          .in("scope_id", unitIds)
          .limit(2000),
      ]);

    for (const m of maint ?? []) {
      if (m.room_unit_id) maintUnits.add(m.room_unit_id as string);
    }

    for (const med of unitMedia ?? []) {
      const sid = med.scope_id as string | null;
      if (!sid) continue;
      const set = mediaFacetsByUnit.get(sid) ?? new Set();
      set.add(med.facet as string);
      mediaFacetsByUnit.set(sid, set);
    }

    const assignmentIds: string[] = [];
    type StayRow = {
      id: string;
      room_unit_id: string;
      from_date: string;
      to_date: string;
      booking: {
        id: string;
        contact_name: string | null;
        status: string;
        adults: number;
        children: number;
        check_out: string | null;
      };
    };
    const parsed: StayRow[] = [];

    for (const row of stays ?? []) {
      const bk = row.bookings as
        | {
            id?: string;
            contact_name?: string | null;
            status?: string;
            adults?: number | null;
            children?: number | null;
            check_out?: string | null;
          }
        | {
            id?: string;
            contact_name?: string | null;
            status?: string;
            adults?: number | null;
            children?: number | null;
            check_out?: string | null;
          }[]
        | null;
      const b = Array.isArray(bk) ? bk[0] : bk;
      if (!b?.id || b.status === "cancelled") continue;
      const assignmentId = row.id as string;
      assignmentIds.push(assignmentId);
      parsed.push({
        id: assignmentId,
        room_unit_id: row.room_unit_id as string,
        from_date: row.from_date as string,
        to_date: row.to_date as string,
        booking: {
          id: b.id,
          contact_name: b.contact_name ?? null,
          status: b.status ?? "confirmed",
          adults: Number(b.adults ?? 1),
          children: Number(b.children ?? 0),
          check_out: b.check_out ?? null,
        },
      });
    }

    const occupantCountByAssignment = new Map<string, number>();
    if (assignmentIds.length > 0) {
      const { data: occupants } = await admin
        .from("room_assignment_occupants")
        .select("assignment_id")
        .in("assignment_id", assignmentIds)
        .limit(1000);
      for (const o of occupants ?? []) {
        const aid = o.assignment_id as string;
        occupantCountByAssignment.set(
          aid,
          (occupantCountByAssignment.get(aid) ?? 0) + 1,
        );
      }
    }

    for (const row of parsed) {
      const occ = occupantCountByAssignment.get(row.id);
      const fallback =
        Math.max(0, row.booking.adults) + Math.max(0, row.booking.children);
      const personCount =
        occ != null && occ > 0 ? occ : fallback > 0 ? fallback : null;
      stayByUnit.set(row.room_unit_id, {
        guestName: row.booking.contact_name,
        stayState: deriveStayState({
          fromDate: row.from_date,
          toDate: row.to_date,
          today,
          bookingStatus: row.booking.status,
          checkOut: row.booking.check_out,
        }),
        personCount,
        assignmentId: row.id,
        bookingId: row.booking.id,
        adults: row.booking.adults,
        children: row.booking.children,
      });
    }
  }

  const mapUnits: RoomMapUnit[] = (units ?? [])
    .filter((u) => {
      const rt = u.room_types as { inventory_kind?: string } | null;
      const kind = rt?.inventory_kind ?? "sellable_guest";
      return (
        kind === "sellable_guest" ||
        kind === "guide_comp" ||
        kind === "driver_comp"
      );
    })
    .map((u) => {
      const rt = u.room_types as {
        code?: string;
        name?: string;
        inventory_kind?: string;
      } | null;
      const kind = rt?.inventory_kind ?? "";
      const stay = stayByUnit.get(u.id as string);
      const stayState: StayState = stay?.stayState ?? "vacant";
      const facets = mediaFacetsByUnit.get(u.id as string);
      let photosMissing: number = ROOM_MAP_CORE_FACETS.length;
      if (facets) {
        photosMissing = ROOM_MAP_CORE_FACETS.filter(
          (f) => !facets.has(f),
        ).length;
      }
      return {
        id: u.id as string,
        label: u.label as string,
        floor_label: (u.floor_label as string | null) ?? null,
        view_label: (u.view_label as string | null) ?? null,
        facade_side: (u.facade_side as string | null) ?? null,
        has_balcony: Boolean(u.has_balcony),
        hk_status: (u.hk_status as string) ?? "clean",
        pos_x: u.pos_x == null ? null : Number(u.pos_x),
        pos_y: u.pos_y == null ? null : Number(u.pos_y),
        room_type_code: rt?.code ?? "",
        room_type_name: rt?.name ?? rt?.code ?? "Room",
        is_comp: kind === "guide_comp" || kind === "driver_comp",
        stay_state: stayState,
        person_count: stay?.personCount ?? null,
        has_open_maintenance: maintUnits.has(u.id as string),
        photos_missing: photosMissing,
        occupied_tonight: stay != null && stayState !== "vacant",
        guest_name: stay?.guestName ?? null,
      };
    });

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Rooms
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Floor map
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Building setup → 2D plan → 3D massing. Fill colour = housekeeping;
            edge = stay (arriving / in-house / departing). Click for dossier,
            pax, and room photos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/erp/rooms"
            className="rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            HK board
          </Link>
          <FrontDeskLiveRefresh />
        </div>
      </header>

      {mapUnits.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No room units on this property yet. Add rooms under Settings, then run
          Building setup.
        </p>
      ) : (
        <RoomMapShell units={mapUnits} layout={layout} spaces={spaces} />
      )}
    </div>
  );
}
