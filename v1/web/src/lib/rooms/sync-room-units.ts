import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export function formatRoomUnitLabel(code: string, n: number): string {
  return `${code.toUpperCase()}-${String(n).padStart(2, "0")}`;
}

/** Grow or trim physical room_units to match unit_count for a room type. */
export async function syncRoomUnits(
  admin: Admin,
  propertyId: string,
  roomTypeId: string,
  code: string,
  unitCount: number,
): Promise<void> {
  const safeCount = Math.max(0, Math.floor(unitCount));
  const { data: units, error } = await admin
    .from("room_units")
    .select("id, label, created_at")
    .eq("property_id", propertyId)
    .eq("room_type_id", roomTypeId)
    .order("created_at", { ascending: true })
    .order("label", { ascending: true });
  if (error) throw new Error(error.message);

  const existing = (units ?? []) as {
    id: string;
    label: string;
    created_at: string;
  }[];
  const existingLabels = new Set(existing.map((unit) => unit.label));

  if (existing.length < safeCount) {
    const inserts: Array<{
      property_id: string;
      room_type_id: string;
      label: string;
      hk_status: string;
      sort_order: number;
    }> = [];
    let next = 1;
    let sortBase = existing.length;
    while (existing.length + inserts.length < safeCount) {
      const label = formatRoomUnitLabel(code, next);
      next += 1;
      if (existingLabels.has(label) || inserts.some((row) => row.label === label)) {
        continue;
      }
      sortBase += 1;
      inserts.push({
        property_id: propertyId,
        room_type_id: roomTypeId,
        label,
        hk_status: "clean",
        sort_order: sortBase,
      });
    }
    if (inserts.length) {
      const { error: insertError } = await admin.from("room_units").insert(inserts);
      if (insertError) throw new Error(insertError.message);
    }
  }

  if (existing.length > safeCount) {
    const surplus = existing.slice(safeCount).map((unit) => unit.id);
    if (surplus.length) {
      const { error: deleteError } = await admin
        .from("room_units")
        .delete()
        .in("id", surplus);
      if (deleteError) throw new Error(deleteError.message);
    }
  }
}
