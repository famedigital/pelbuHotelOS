import {
  loadBuildingLayout,
  loadBuildingSpaces,
} from "@/app/actions/erp-building-layout";
import type { RoomMapUnit } from "@/components/erp/room-map-shared";
import type {
  BuildingSpace,
  PropertyBuildingLayout,
} from "@/lib/building/types";
import { publicRoomSlug } from "@/lib/public-content";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";

export type PublicBuildingMap = {
  layout: PropertyBuildingLayout;
  spaces: Array<BuildingSpace & { id: string }>;
  units: RoomMapUnit[];
  /** room_type code → public room detail path */
  typeHrefByCode: Record<string, string>;
};

/**
 * Sanitized building massing for marketing — layout geometry only.
 * No guest names, pax, HK, or maintenance.
 */
export async function loadPublicBuildingMap(): Promise<PublicBuildingMap | null> {
  const propertyId = await resolvePublicPropertyId();
  if (!propertyId) return null;

  const admin = createSupabaseAdminClient();
  const [layout, spaces, { data: units }] = await Promise.all([
    loadBuildingLayout(propertyId),
    loadBuildingSpaces(propertyId),
    admin
      .from("room_units")
      .select(
        `id, label, floor_label, view_label, facade_side, has_balcony,
         pos_x, pos_y,
         room_types(code, name, inventory_kind)`,
      )
      .eq("property_id", propertyId)
      .order("label")
      .limit(200),
  ]);

  if (!layout?.setup_completed_at) return null;

  const typeHrefByCode: Record<string, string> = {};

  const mapUnits: RoomMapUnit[] = (units ?? [])
    .filter((u) => {
      const rt = u.room_types as { inventory_kind?: string } | null;
      const kind = rt?.inventory_kind ?? "sellable_guest";
      return kind === "sellable_guest";
    })
    .map((u) => {
      const rt = u.room_types as {
        code?: string;
        name?: string;
        inventory_kind?: string;
      } | null;
      const code = rt?.code ?? "";
      if (code) {
        typeHrefByCode[code] = `/rooms/${publicRoomSlug(code)}`;
      }
      return {
        id: u.id as string,
        label: u.label as string,
        floor_label: (u.floor_label as string | null) ?? null,
        view_label: (u.view_label as string | null) ?? null,
        facade_side: (u.facade_side as string | null) ?? null,
        has_balcony: Boolean(u.has_balcony),
        hk_status: "clean",
        pos_x: u.pos_x == null ? null : Number(u.pos_x),
        pos_y: u.pos_y == null ? null : Number(u.pos_y),
        room_type_code: code,
        room_type_name: rt?.name ?? (code || "Room"),
        is_comp: false,
        stay_state: "vacant" as const,
        person_count: null,
        has_open_maintenance: false,
        photos_missing: null,
        occupied_tonight: false,
        guest_name: null,
      };
    });

  if (mapUnits.length === 0) return null;

  return {
    layout,
    spaces,
    units: mapUnits,
    typeHrefByCode,
  };
}
