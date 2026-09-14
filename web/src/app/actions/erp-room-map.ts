"use server";

import { isDeskAuthenticated, requireDeskRole } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { thimphuToday } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type RoomMapActionState = { ok: boolean; error?: string };

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

/** FO + managers can place rooms; HK can view but not edit layout. */
async function requireMapEditor() {
  await requireDeskRole(["owner", "gm", "front_desk"]);
}

/** Drag-save on the rooms floor map (percent coords, POS-table pattern). */
export async function saveRoomMapPosition(formData: FormData): Promise<void> {
  try {
    await requireMapEditor();
    const unitId = trimRequired(formData.get("unit_id"), "Room");
    const xRaw = Number(formData.get("pos_x"));
    const yRaw = Number(formData.get("pos_y"));
    if (!Number.isFinite(xRaw) || !Number.isFinite(yRaw)) return;
    const pos_x = Math.max(0, Math.min(100, xRaw));
    const pos_y = Math.max(0, Math.min(100, yRaw));
    const facade = optionalTrim(formData.get("facade_side"));
    const allowed = new Set([
      "north",
      "south",
      "east",
      "west",
      "courtyard",
      "internal",
      "",
    ]);

    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();

    const patch: Record<string, unknown> = { pos_x, pos_y };
    if (facade != null && allowed.has(facade) && facade !== "") {
      patch.facade_side = facade;
    }

    await admin
      .from("room_units")
      .update(patch)
      .eq("id", unitId)
      .eq("property_id", propertyId);

    revalidatePath("/erp/rooms/layout");
    revalidatePath("/erp/rooms");
  } catch (err) {
    console.error("saveRoomMapPosition failed", err);
  }
}

export async function updateRoomMapMeta(
  _prev: RoomMapActionState,
  formData: FormData,
): Promise<RoomMapActionState> {
  try {
    await requireMapEditor();
    const unitId = trimRequired(formData.get("unit_id"), "Room");
    const facade = optionalTrim(formData.get("facade_side"));
    const view = optionalTrim(formData.get("view_label"));
    const floor = optionalTrim(formData.get("floor_label"));
    const notes = optionalTrim(formData.get("notes"));
    const hasBalconyRaw = optionalTrim(formData.get("has_balcony"));

    const allowed = new Set([
      "north",
      "south",
      "east",
      "west",
      "courtyard",
      "internal",
      "",
    ]);
    if (facade != null && !allowed.has(facade)) {
      throw new Error("Invalid facade side.");
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();

    const { error } = await admin
      .from("room_units")
      .update({
        facade_side: facade || null,
        view_label: view || null,
        floor_label: floor || null,
        notes: notes || null,
        has_balcony: hasBalconyRaw === "1" || hasBalconyRaw === "true",
      })
      .eq("id", unitId)
      .eq("property_id", propertyId);

    if (error) throw new Error(error.message);

    revalidatePath("/erp/rooms/layout");
    revalidatePath("/erp/rooms");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save room meta.",
    };
  }
}

export type RoomDossier = {
  unit: {
    id: string;
    label: string;
    floor_label: string | null;
    view_label: string | null;
    facade_side: string | null;
    has_balcony: boolean;
    hk_status: string;
    notes: string | null;
    room_type_code: string;
    room_type_name: string;
    room_type_id: string;
  };
  current: null | {
    booking_id: string;
    assignment_id: string;
    contact_name: string | null;
    contact_phone: string | null;
    check_in: string;
    check_out: string;
    status: string;
    agent_id: string | null;
    agent_name: string | null;
    from_date: string;
    to_date: string;
    adults: number;
    children: number;
  };
  occupants: Array<{
    kind: string;
    display_name: string;
  }>;
  upcoming: Array<{
    booking_id: string;
    contact_name: string | null;
    check_in: string;
    check_out: string;
    status: string;
  }>;
  history: Array<{
    booking_id: string;
    contact_name: string | null;
    check_in: string;
    check_out: string;
    status: string;
    guest_names: string[];
  }>;
  amenities: Array<{ name: string; par_qty: number }>;
  /** Room-type fallback gallery. */
  photoPublicIds: string[];
  /** Per physical unit media by facet. */
  unitPhotos: Array<{
    id: string;
    facet: string;
    public_id: string;
  }>;
  openProblems: Array<{ kind: string; summary: string; at: string }>;
};

/** Full dossier for the floor-map room inspector. */
export async function loadRoomDossier(
  unitId: string,
): Promise<{ ok: true; dossier: RoomDossier } | { ok: false; error: string }> {
  try {
    await requireDesk();
    if (!/^[0-9a-f-]{36}$/i.test(unitId)) {
      throw new Error("Invalid room.");
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const today = thimphuToday();

    const { data: unit, error: uErr } = await admin
      .from("room_units")
      .select(
        `id, label, floor_label, view_label, facade_side, has_balcony, hk_status, notes, room_type_id,
         room_types(code, name)`,
      )
      .eq("id", unitId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (uErr || !unit) throw new Error("Room not found.");

    const rt = unit.room_types as { code?: string; name?: string } | null;

    const { data: currentRows } = await admin
      .from("room_assignments")
      .select(
        `id, from_date, to_date,
         bookings!inner(
           id, contact_name, contact_phone, check_in, check_out, status, agent_id,
           adults, children,
           agents(company_name)
         )`,
      )
      .eq("room_unit_id", unitId)
      .lte("from_date", today)
      .gt("to_date", today)
      .limit(1);

    const cur = currentRows?.[0];
    const assignmentId = (cur?.id as string | undefined) ?? null;
    const curBook = cur?.bookings as
      | {
          id: string;
          contact_name: string | null;
          contact_phone: string | null;
          check_in: string;
          check_out: string;
          status: string;
          agent_id?: string | null;
          adults?: number | null;
          children?: number | null;
          agents?: { company_name?: string } | { company_name?: string }[] | null;
        }
      | {
          id: string;
          contact_name: string | null;
          contact_phone: string | null;
          check_in: string;
          check_out: string;
          status: string;
          agent_id?: string | null;
          adults?: number | null;
          children?: number | null;
          agents?: { company_name?: string } | { company_name?: string }[] | null;
        }[]
      | null;
    const b = Array.isArray(curBook) ? curBook[0] : curBook;
    const agentRaw = b?.agents;
    const agent = Array.isArray(agentRaw) ? agentRaw[0] : agentRaw;

    const occupants: RoomDossier["occupants"] = [];
    if (assignmentId) {
      const { data: occRows } = await admin
        .from("room_assignment_occupants")
        .select("occupant_kind, display_name")
        .eq("assignment_id", assignmentId)
        .limit(40);
      for (const o of occRows ?? []) {
        occupants.push({
          kind: (o.occupant_kind as string) ?? "guest",
          display_name: (o.display_name as string) || "—",
        });
      }
    }

    const { data: upcomingRows } = await admin
      .from("room_assignments")
      .select(
        `from_date, to_date,
         bookings!inner(id, contact_name, check_in, check_out, status)`,
      )
      .eq("room_unit_id", unitId)
      .gt("from_date", today)
      .order("from_date", { ascending: true })
      .limit(12);

    const upcoming = (upcomingRows ?? []).map((row) => {
      const bk = row.bookings as
        | {
            id: string;
            contact_name: string | null;
            check_in: string;
            check_out: string;
            status: string;
          }
        | {
            id: string;
            contact_name: string | null;
            check_in: string;
            check_out: string;
            status: string;
          }[]
        | null;
      const x = Array.isArray(bk) ? bk[0] : bk;
      return {
        booking_id: x?.id ?? "",
        contact_name: x?.contact_name ?? null,
        check_in: x?.check_in ?? (row.from_date as string),
        check_out: x?.check_out ?? (row.to_date as string),
        status: x?.status ?? "confirmed",
      };
    });

    const { data: historyRows } = await admin
      .from("room_assignments")
      .select(
        `from_date, to_date,
         bookings!inner(
           id, contact_name, check_in, check_out, status,
           booking_guests(full_name)
         )`,
      )
      .eq("room_unit_id", unitId)
      .lte("to_date", today)
      .order("to_date", { ascending: false })
      .limit(25);

    const history = (historyRows ?? []).map((row) => {
      const bk = row.bookings as
        | {
            id: string;
            contact_name: string | null;
            check_in: string;
            check_out: string;
            status: string;
            booking_guests?: { full_name?: string }[] | null;
          }
        | {
            id: string;
            contact_name: string | null;
            check_in: string;
            check_out: string;
            status: string;
            booking_guests?: { full_name?: string }[] | null;
          }[]
        | null;
      const x = Array.isArray(bk) ? bk[0] : bk;
      const guests = (x?.booking_guests ?? [])
        .map((g) => g.full_name)
        .filter((n): n is string => Boolean(n));
      return {
        booking_id: x?.id ?? "",
        contact_name: x?.contact_name ?? null,
        check_in: x?.check_in ?? (row.from_date as string),
        check_out: x?.check_out ?? (row.to_date as string),
        status: x?.status ?? "",
        guest_names: guests,
      };
    });

    // Amenity PARs are property-level catalog — show active names as stock expectations.
    const { data: pars } = await admin
      .from("room_amenity_pars")
      .select("par_qty, inventory_items(name)")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("sort_order")
      .limit(40);

    const amenities = (pars ?? []).map((p) => {
      const item = p.inventory_items as
        | { name?: string }
        | { name?: string }[]
        | null;
      const name = Array.isArray(item) ? item[0]?.name : item?.name;
      return {
        name: name ?? "Item",
        par_qty: Number(p.par_qty ?? 0),
      };
    });

    let photoPublicIds: string[] = [];
    if (unit.room_type_id) {
      const { data: typeMedia } = await admin
        .from("property_media")
        .select("public_id")
        .eq("property_id", propertyId)
        .eq("scope", "room_type")
        .eq("scope_id", unit.room_type_id as string)
        .order("sort_order")
        .limit(12);
      photoPublicIds = (typeMedia ?? [])
        .map((m) => m.public_id as string)
        .filter(Boolean);
    }

    const { data: unitMedia } = await admin
      .from("property_media")
      .select("id, facet, public_id")
      .eq("property_id", propertyId)
      .eq("scope", "room_unit")
      .eq("scope_id", unitId)
      .order("sort_order")
      .limit(40);

    const unitPhotos = (unitMedia ?? []).map((m) => ({
      id: m.id as string,
      facet: m.facet as string,
      public_id: m.public_id as string,
    }));

    // Soft problems: HK dirty/ooo + service request + free-text notes
    const openProblems: RoomDossier["openProblems"] = [];
    if (unit.hk_status === "ooo") {
      openProblems.push({
        kind: "ooo",
        summary: "Out of order",
        at: today,
      });
    }
    if (unit.hk_status === "dirty") {
      openProblems.push({
        kind: "hk",
        summary: "Housekeeping — dirty",
        at: today,
      });
    }
    if (unit.hk_status === "inspect") {
      openProblems.push({
        kind: "hk",
        summary: "Housekeeping — inspect",
        at: today,
      });
    }

    const { data: openMaint } = await admin
      .from("maintenance_orders")
      .select("title, status")
      .eq("property_id", propertyId)
      .eq("room_unit_id", unitId)
      .in("status", ["open", "in_progress"])
      .limit(8);
    for (const m of openMaint ?? []) {
      openProblems.push({
        kind: "maintenance",
        summary: `Maintenance (${m.status}): ${m.title as string}`,
        at: today,
      });
    }

    if (unit.notes?.trim()) {
      openProblems.push({
        kind: "note",
        summary: unit.notes.trim().slice(0, 160),
        at: today,
      });
    }

    const dossier: RoomDossier = {
      unit: {
        id: unit.id as string,
        label: unit.label as string,
        floor_label: (unit.floor_label as string | null) ?? null,
        view_label: (unit.view_label as string | null) ?? null,
        facade_side: (unit.facade_side as string | null) ?? null,
        has_balcony: Boolean(unit.has_balcony),
        hk_status: unit.hk_status as string,
        notes: (unit.notes as string | null) ?? null,
        room_type_code: rt?.code ?? "",
        room_type_name: rt?.name ?? rt?.code ?? "Room",
        room_type_id: unit.room_type_id as string,
      },
      current:
        b && cur
          ? {
              booking_id: b.id,
              assignment_id: assignmentId ?? "",
              contact_name: b.contact_name,
              contact_phone: b.contact_phone,
              check_in: b.check_in,
              check_out: b.check_out,
              status: b.status,
              agent_id: b.agent_id ?? null,
              agent_name: agent?.company_name ?? null,
              from_date: cur.from_date as string,
              to_date: cur.to_date as string,
              adults: Number(b.adults ?? 1),
              children: Number(b.children ?? 0),
            }
          : null,
      occupants,
      upcoming,
      history,
      amenities,
      photoPublicIds,
      unitPhotos,
      openProblems,
    };

    return { ok: true, dossier };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load room dossier.",
    };
  }
}
