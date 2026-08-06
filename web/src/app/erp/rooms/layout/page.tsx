import {
  RoomMapShell,
  type RoomMapUnit,
} from "@/components/erp/RoomMapShell";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { thimphuToday } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Floor map | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RoomFloorMapPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();

  const { data: units } = await admin
    .from("room_units")
    .select(
      `id, label, floor_label, view_label, facade_side, has_balcony, hk_status,
       pos_x, pos_y,
       room_types(code, name, inventory_kind)`,
    )
    .eq("property_id", propertyId)
    .order("label")
    .limit(200);

  const unitIds = (units ?? []).map((u) => u.id as string);

  const guestByUnit = new Map<string, string | null>();
  if (unitIds.length > 0) {
    const { data: stays } = await admin
      .from("room_assignments")
      .select(
        `room_unit_id, from_date, to_date,
         bookings!inner(contact_name, status)`,
      )
      .in("room_unit_id", unitIds)
      .lte("from_date", today)
      .gt("to_date", today)
      .limit(300);

    for (const row of stays ?? []) {
      const uid = row.room_unit_id as string;
      const bk = row.bookings as
        | { contact_name?: string | null; status?: string }
        | { contact_name?: string | null; status?: string }[]
        | null;
      const b = Array.isArray(bk) ? bk[0] : bk;
      if (b?.status === "cancelled") continue;
      guestByUnit.set(uid, b?.contact_name ?? null);
    }
  }

  const mapUnits: RoomMapUnit[] = (units ?? [])
    .filter((u) => {
      const rt = u.room_types as { inventory_kind?: string } | null;
      const kind = rt?.inventory_kind ?? "sellable_guest";
      return kind === "sellable_guest" || kind === "guide_comp" || kind === "driver_comp";
    })
    .map((u) => {
      const rt = u.room_types as {
        code?: string;
        name?: string;
        inventory_kind?: string;
      } | null;
      const kind = rt?.inventory_kind ?? "";
      const occupied = guestByUnit.has(u.id as string);
      return {
        id: u.id as string,
        label: u.label as string,
        floor_label: (u.floor_label as string | null) ?? null,
        view_label: (u.view_label as string | null) ?? null,
        facade_side: (u.facade_side as string | null) ?? null,
        has_balcony: Boolean(u.has_balcony),
        hk_status: occupied
          ? "occupied"
          : ((u.hk_status as string) ?? "clean"),
        pos_x: u.pos_x == null ? null : Number(u.pos_x),
        pos_y: u.pos_y == null ? null : Number(u.pos_y),
        room_type_code: rt?.code ?? "",
        room_type_name: rt?.name ?? rt?.code ?? "Room",
        is_comp: kind === "guide_comp" || kind === "driver_comp",
        occupied_tonight: occupied,
        guest_name: guestByUnit.get(u.id as string) ?? null,
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
            Building (3D) or Plan (2D) — same room data. Click any room for stay,
            guests, photos, amenities, and flags. Drag rooms only in Plan mode.
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
          No room units on this property yet.
        </p>
      ) : (
        <RoomMapShell units={mapUnits} />
      )}
    </div>
  );
}
