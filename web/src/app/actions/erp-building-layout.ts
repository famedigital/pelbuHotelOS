"use server";

import { writeAuditEvent } from "@/lib/audit";
import {
  buildAmenitySpaces,
  type AmenityProgramChoice,
} from "@/lib/building/amenity-defaults";
import {
  packDualCorridor,
} from "@/lib/building/pack-dual-corridor";
import type {
  BuildingFloor,
  BuildingLayoutParams,
  BuildingSpace,
  CorridorAxis,
  FloorWingSummary,
  PropertyBuildingLayout,
} from "@/lib/building/types";
import {
  DEFAULT_BUILDING_PARAMS,
  inferFloorKey,
  normalizeFloors,
  normalizeParams,
} from "@/lib/building/types";
import { isDeskAuthenticated, requireDeskRole } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type BuildingActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  summaries?: FloorWingSummary[];
};

async function requireMapEditor() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
  await requireDeskRole(["owner", "gm", "front_desk"]);
}

function revalidateMap() {
  revalidatePath("/erp/rooms/layout");
  revalidatePath("/erp/rooms");
}

function parseFloorsJson(raw: FormDataEntryValue | null): BuildingFloor[] {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Floors payload missing.");
  }
  return normalizeFloors(JSON.parse(raw));
}

function parseAxis(raw: FormDataEntryValue | null): CorridorAxis {
  return raw === "ns" ? "ns" : "ew";
}

function parseProgram(raw: FormDataEntryValue | null): AmenityProgramChoice[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const data = JSON.parse(raw) as AmenityProgramChoice[];
  if (!Array.isArray(data)) return [];
  return data.map((p) => ({
    floor_key: String(p.floor_key),
    kinds: Array.isArray(p.kinds)
      ? (p.kinds as string[]).map((k) => k as AmenityProgramChoice["kinds"][number])
      : [],
  }));
}

export async function loadBuildingLayout(
  propertyId: string,
): Promise<PropertyBuildingLayout | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("property_building_layouts")
    .select(
      "property_id, template, floors, params, corridor_axis, setup_completed_at",
    )
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    property_id: data.property_id as string,
    template: "dual_corridor",
    floors: normalizeFloors(data.floors),
    params: normalizeParams(data.params),
    corridor_axis: data.corridor_axis === "ns" ? "ns" : "ew",
    setup_completed_at: (data.setup_completed_at as string | null) ?? null,
  };
}

export async function loadBuildingSpaces(
  propertyId: string,
): Promise<
  Array<
    BuildingSpace & {
      id: string;
    }
  >
> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("building_spaces")
    .select(
      "id, floor_key, kind, label, pos_x, pos_y, width_pct, depth_pct, facade_side, sort_order",
    )
    .eq("property_id", propertyId)
    .order("sort_order")
    .limit(200);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    floor_key: r.floor_key as string,
    kind: r.kind as BuildingSpace["kind"],
    label: r.label as string,
    pos_x: Number(r.pos_x),
    pos_y: Number(r.pos_y),
    width_pct: Number(r.width_pct),
    depth_pct: Number(r.depth_pct),
    facade_side: (r.facade_side as string | null) ?? null,
    sort_order: Number(r.sort_order ?? 0),
  }));
}

/** Upsert layout profile (floors / template / axis). Does not place rooms. */
export async function saveBuildingLayoutDraft(
  _prev: BuildingActionState,
  formData: FormData,
): Promise<BuildingActionState> {
  try {
    await requireMapEditor();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const floors = parseFloorsJson(formData.get("floors"));
    if (floors.length === 0) throw new Error("Add at least one floor.");
    const corridor_axis = parseAxis(formData.get("corridor_axis"));
    const paramsRaw = formData.get("params");
    const params: BuildingLayoutParams =
      typeof paramsRaw === "string" && paramsRaw.trim()
        ? normalizeParams(JSON.parse(paramsRaw))
        : DEFAULT_BUILDING_PARAMS;

    const now = new Date().toISOString();
    const { error } = await admin.from("property_building_layouts").upsert(
      {
        property_id: propertyId,
        template: "dual_corridor",
        floors,
        params,
        corridor_axis,
        updated_at: now,
      },
      { onConflict: "property_id" },
    );
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "building_layout.draft",
      entityType: "property_building_layouts",
      entityId: propertyId,
      summary: `Saved building floor stack (${floors.length} floors, axis ${corridor_axis})`,
    });

    revalidateMap();
    return { ok: true, message: "Building floors saved" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save building layout.",
    };
  }
}

/**
 * Replace amenity spaces + pack rooms on guest floors (overwrites positions).
 */
export async function applyBuildingLayout(
  _prev: BuildingActionState,
  formData: FormData,
): Promise<BuildingActionState> {
  try {
    await requireMapEditor();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const floors = parseFloorsJson(formData.get("floors"));
    if (floors.length === 0) throw new Error("Add at least one floor.");
    const corridor_axis = parseAxis(formData.get("corridor_axis"));
    const program = parseProgram(formData.get("program"));
    const includeComp = formData.get("include_comp") === "1";

    const params = DEFAULT_BUILDING_PARAMS;
    const now = new Date().toISOString();

    const { error: layoutErr } = await admin
      .from("property_building_layouts")
      .upsert(
        {
          property_id: propertyId,
          template: "dual_corridor",
          floors,
          params,
          corridor_axis,
          updated_at: now,
        },
        { onConflict: "property_id" },
      );
    if (layoutErr) throw new Error(layoutErr.message);

    // Replace amenity spaces
    await admin.from("building_spaces").delete().eq("property_id", propertyId);
    const spaces = buildAmenitySpaces({ floors, program, corridor_axis });
    if (spaces.length) {
      const { error: spErr } = await admin.from("building_spaces").insert(
        spaces.map((s) => ({
          property_id: propertyId,
          floor_key: s.floor_key,
          kind: s.kind,
          label: s.label,
          pos_x: s.pos_x,
          pos_y: s.pos_y,
          width_pct: s.width_pct,
          depth_pct: s.depth_pct,
          facade_side: s.facade_side,
          sort_order: s.sort_order,
        })),
      );
      if (spErr) throw new Error(spErr.message);
    }

    // Pack rooms
    const { data: units } = await admin
      .from("room_units")
      .select(
        "id, label, floor_label, room_types(inventory_kind)",
      )
      .eq("property_id", propertyId)
      .limit(500);

    const packInputs = (units ?? [])
      .map((u) => {
        const rt = u.room_types as
          | { inventory_kind?: string }
          | { inventory_kind?: string }[]
          | null;
        const kind = (Array.isArray(rt) ? rt[0] : rt)?.inventory_kind ?? "";
        const is_comp =
          kind === "guide_comp" || kind === "driver_comp";
        const sellable = kind === "sellable_guest" || is_comp;
        if (!sellable) return null;
        return {
          id: u.id as string,
          label: u.label as string,
          floor_label: (u.floor_label as string | null) ?? null,
          is_comp,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r != null);

    const { placements, summaries } = packDualCorridor({
      rooms: packInputs,
      floors,
      corridor_axis,
      params,
      includeComp,
    });

    for (const p of placements) {
      const { error } = await admin
        .from("room_units")
        .update({
          pos_x: p.pos_x,
          pos_y: p.pos_y,
          facade_side: p.facade_side,
          floor_label: p.floor_key,
        })
        .eq("id", p.id)
        .eq("property_id", propertyId);
      if (error) throw new Error(error.message);
    }

    // Enrich amenity labels on summaries for cards
    for (const s of summaries) {
      s.amenities = spaces
        .filter((sp) => sp.floor_key === s.floor_key)
        .map((sp) => sp.label);
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "building_layout.apply",
      entityType: "property_building_layouts",
      entityId: propertyId,
      summary: `Applied dual-corridor pack (${placements.length} rooms, ${spaces.length} spaces)`,
      meta: { rooms: placements.length, spaces: spaces.length },
    });

    revalidateMap();
    return {
      ok: true,
      message: `Placed ${placements.length} rooms · ${spaces.length} amenity blocks`,
      summaries,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not apply building layout.",
    };
  }
}

/** Mark wizard complete — desk can open map for day-to-day. */
export async function completeBuildingSetup(
  _prev: BuildingActionState,
  _formData: FormData,
): Promise<BuildingActionState> {
  try {
    await requireMapEditor();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const now = new Date().toISOString();

    const { data: existing } = await admin
      .from("property_building_layouts")
      .select("property_id")
      .eq("property_id", propertyId)
      .maybeSingle();

    if (!existing) {
      throw new Error("Apply room packing first (step 4).");
    }

    const { error } = await admin
      .from("property_building_layouts")
      .update({ setup_completed_at: now, updated_at: now })
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "building_layout.setup",
      entityType: "property_building_layouts",
      entityId: propertyId,
      summary: "Building setup completed",
    });

    revalidateMap();
    return { ok: true, message: "Building setup complete" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not complete setup.",
    };
  }
}

/**
 * Reset setup flag (and optionally wipe spaces + room positions).
 * keep_rooms=1 leaves room_units coords.
 */
export async function resetBuildingSetup(
  _prev: BuildingActionState,
  formData: FormData,
): Promise<BuildingActionState> {
  try {
    await requireMapEditor();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const keepRooms = formData.get("keep_rooms") === "1";
    const wipeSpaces = formData.get("wipe_spaces") !== "0";

    if (wipeSpaces) {
      await admin.from("building_spaces").delete().eq("property_id", propertyId);
    }

    if (!keepRooms) {
      await admin
        .from("room_units")
        .update({ pos_x: null, pos_y: null })
        .eq("property_id", propertyId);
    }

    const now = new Date().toISOString();
    await admin.from("property_building_layouts").upsert(
      {
        property_id: propertyId,
        template: "dual_corridor",
        floors: [],
        params: DEFAULT_BUILDING_PARAMS,
        corridor_axis: "ew",
        setup_completed_at: null,
        updated_at: now,
      },
      { onConflict: "property_id" },
    );

    await writeAuditEvent(admin, {
      propertyId,
      action: "building_layout.reset",
      entityType: "property_building_layouts",
      entityId: propertyId,
      summary: keepRooms
        ? "Building setup reset (room positions kept)"
        : "Building setup reset (room positions cleared)",
    });

    revalidateMap();
    return { ok: true, message: "Building setup reset — run the wizard again" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not reset setup.",
    };
  }
}

/** Preview pack without writing — for wizard step cards. */
export async function previewBuildingPack(
  floors: BuildingFloor[],
  corridor_axis: CorridorAxis,
  includeComp = false,
): Promise<{
  summaries: FloorWingSummary[];
  totalRooms: number;
  unmatched: string[];
}> {
  if (!(await isDeskAuthenticated())) {
    return { summaries: [], totalRooms: 0, unmatched: [] };
  }
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const { data: units } = await admin
    .from("room_units")
    .select("id, label, floor_label, room_types(inventory_kind)")
    .eq("property_id", propertyId)
    .limit(500);

  const packInputs = (units ?? [])
    .map((u) => {
      const rt = u.room_types as
        | { inventory_kind?: string }
        | { inventory_kind?: string }[]
        | null;
      const kind = (Array.isArray(rt) ? rt[0] : rt)?.inventory_kind ?? "";
      const is_comp = kind === "guide_comp" || kind === "driver_comp";
      if (kind !== "sellable_guest" && !is_comp) return null;
      return {
        id: u.id as string,
        label: u.label as string,
        floor_label: (u.floor_label as string | null) ?? null,
        is_comp,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  const { summaries, placements, unmatched } = packDualCorridor({
    rooms: packInputs,
    floors,
    corridor_axis,
    includeComp,
  });

  return {
    summaries,
    totalRooms: placements.length,
    unmatched: unmatched.map(
      (r) =>
        `${r.label}${inferFloorKey(r.label, r.floor_label) ? "" : " (no floor)"}`,
    ),
  };
}
