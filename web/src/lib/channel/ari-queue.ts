import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { availabilityByRoomType } from "@/lib/inventory-availability";
import { lookupRoomRateBtn, resolveSeasonKind } from "@/lib/rates";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

type RoomMap = {
  room_type_id: string;
  external_room_type_id: string;
  external_rate_plan_id: string | null;
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function loadActiveMaps(
  admin: Admin,
  connectionId: string,
): Promise<RoomMap[]> {
  const { data: maps } = await admin
    .from("channel_room_maps")
    .select("room_type_id, external_room_type_id, external_rate_plan_id")
    .eq("connection_id", connectionId)
    .eq("is_active", true);
  return (maps ?? []).map((m) => ({
    room_type_id: m.room_type_id as string,
    external_room_type_id: m.external_room_type_id as string,
    external_rate_plan_id: (m.external_rate_plan_id as string | null) ?? null,
  }));
}

async function insertBatches(
  admin: Admin,
  propertyId: string,
  connectionId: string,
  kind: "availability" | "rates" | "restrictions",
  reason: string,
  values: Record<string, unknown>[],
  local: unknown[],
): Promise<number> {
  if (values.length === 0) return 0;
  const chunkSize = 200;
  let inserted = 0;
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize);
    const localChunk = local.slice(i, i + chunkSize);
    const { error } = await admin.from("ari_queue").insert({
      property_id: propertyId,
      connection_id: connectionId,
      kind,
      payload: { reason, values: chunk, local: localChunk },
    });
    if (error) {
      console.error(`ari_queue ${kind} batch insert failed`, error);
      continue;
    }
    inserted += 1;
  }
  return inserted;
}

/** Ensure a draft Channex connection exists for the active property. */
export async function ensureChannexConnection(
  admin: Admin,
  propertyId: string,
): Promise<{ id: string; status: string } | null> {
  const { data: existing } = await admin
    .from("channel_connections")
    .select("id, status")
    .eq("property_id", propertyId)
    .eq("provider", "channex")
    .maybeSingle();
  if (existing) {
    return { id: existing.id as string, status: existing.status as string };
  }

  const { data: created, error } = await admin
    .from("channel_connections")
    .insert({
      property_id: propertyId,
      provider: "channex",
      status: "draft",
      notes:
        "Map room types + set CHANNEX_API_KEY before staging certification.",
    })
    .select("id, status")
    .single();
  if (error || !created) {
    console.error("channel_connections insert failed", error);
    return null;
  }
  return { id: created.id as string, status: created.status as string };
}

/** Enqueue availability ARI for each day in [from, to) — flushed when Channex credentials exist. */
export async function enqueueAvailabilityWindow(
  admin: Admin,
  propertyId: string,
  fromDate: string,
  toDateExclusive: string,
  reason: string,
): Promise<number> {
  const conn = await ensureChannexConnection(admin, propertyId);
  if (!conn || conn.status === "paused") {
    return 0;
  }

  const maps = await loadActiveMaps(admin, conn.id);
  if (!maps.length) {
    const { error } = await admin.from("ari_queue").insert({
      property_id: propertyId,
      connection_id: conn.id,
      kind: "full_sync",
      payload: {
        reason,
        from: fromDate,
        to: toDateExclusive,
        note: "No room maps yet — map room types before push.",
      },
    });
    if (error) {
      console.error("ari_queue insert failed", error);
      return 0;
    }
    return 1;
  }

  const values: Record<string, unknown>[] = [];
  const local: unknown[] = [];

  let cursor = fromDate;
  let guard = 0;
  while (cursor < toDateExclusive && guard < 400) {
    const next = addDays(cursor, 1);
    const avail = await availabilityByRoomType(admin, propertyId, cursor, next);
    for (const map of maps) {
      const row = avail.find((a) => a.roomTypeId === map.room_type_id);
      if (!row) continue;
      values.push({
        date: cursor,
        room_type_id: map.external_room_type_id,
        availability: row.remaining,
      });
      local.push({
        date: cursor,
        room_type_id: map.room_type_id,
        external_room_type_id: map.external_room_type_id,
        availability: row.remaining,
      });
    }
    cursor = next;
    guard += 1;
  }

  return insertBatches(
    admin,
    propertyId,
    conn.id,
    "availability",
    reason,
    values,
    local,
  );
}

/**
 * Enqueue public rates + min_stay / stop-sell for mapped rate plans.
 * stop_sell is true when remaining availability is 0; min_stay defaults to 1.
 */
export async function enqueueRatesRestrictionsWindow(
  admin: Admin,
  propertyId: string,
  fromDate: string,
  toDateExclusive: string,
  reason: string,
): Promise<{ rates: number; restrictions: number }> {
  const conn = await ensureChannexConnection(admin, propertyId);
  if (!conn || conn.status === "paused") {
    return { rates: 0, restrictions: 0 };
  }

  const maps = (await loadActiveMaps(admin, conn.id)).filter(
    (m) => m.external_rate_plan_id,
  );
  if (!maps.length) {
    return { rates: 0, restrictions: 0 };
  }

  const rateValues: Record<string, unknown>[] = [];
  const rateLocal: unknown[] = [];
  const restrictionValues: Record<string, unknown>[] = [];
  const restrictionLocal: unknown[] = [];

  let cursor = fromDate;
  let guard = 0;
  while (cursor < toDateExclusive && guard < 400) {
    const next = addDays(cursor, 1);
    const season = await resolveSeasonKind(admin, propertyId, cursor);
    const avail = await availabilityByRoomType(admin, propertyId, cursor, next);

    for (const map of maps) {
      const ratePlanId = map.external_rate_plan_id as string;
      const amount = await lookupRoomRateBtn(admin, {
        propertyId,
        roomTypeId: map.room_type_id,
        seasonKind: season,
        rateTier: "public",
      });
      const remaining =
        avail.find((a) => a.roomTypeId === map.room_type_id)?.remaining ?? 0;
      const stopSell = remaining <= 0;

      if (amount != null && amount > 0) {
        rateValues.push({
          date: cursor,
          rate_plan_id: ratePlanId,
          rate: amount,
        });
        rateLocal.push({
          date: cursor,
          room_type_id: map.room_type_id,
          rate_plan_id: ratePlanId,
          season,
          rate: amount,
        });
      }

      restrictionValues.push({
        date: cursor,
        rate_plan_id: ratePlanId,
        min_stay: 1,
        stop_sell: stopSell,
      });
      restrictionLocal.push({
        date: cursor,
        room_type_id: map.room_type_id,
        rate_plan_id: ratePlanId,
        min_stay: 1,
        stop_sell: stopSell,
        remaining,
      });
    }

    cursor = next;
    guard += 1;
  }

  const rates = await insertBatches(
    admin,
    propertyId,
    conn.id,
    "rates",
    reason,
    rateValues,
    rateLocal,
  );
  const restrictions = await insertBatches(
    admin,
    propertyId,
    conn.id,
    "restrictions",
    reason,
    restrictionValues,
    restrictionLocal,
  );
  return { rates, restrictions };
}

/** Queue availability + rates/restrictions for a window (desk full sync). */
export async function enqueueFullAriWindow(
  admin: Admin,
  propertyId: string,
  fromDate: string,
  toDateExclusive: string,
  reason: string,
): Promise<{ availability: number; rates: number; restrictions: number }> {
  const availability = await enqueueAvailabilityWindow(
    admin,
    propertyId,
    fromDate,
    toDateExclusive,
    reason,
  );
  const { rates, restrictions } = await enqueueRatesRestrictionsWindow(
    admin,
    propertyId,
    fromDate,
    toDateExclusive,
    reason,
  );
  return { availability, rates, restrictions };
}

export async function enqueueAfterBookingChange(
  admin: Admin,
  propertyId: string,
  checkIn: string,
  checkOut: string,
  reason: string,
): Promise<void> {
  try {
    await enqueueAvailabilityWindow(admin, propertyId, checkIn, checkOut, reason);
    await enqueueRatesRestrictionsWindow(
      admin,
      propertyId,
      checkIn,
      checkOut,
      reason,
    );
  } catch (err) {
    console.error("enqueueAfterBookingChange failed", err);
  }
}
