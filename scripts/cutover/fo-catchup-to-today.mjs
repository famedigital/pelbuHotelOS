/**
 * FO catch-up for live Pelbu Olakha (public schema):
 * day-close from open business date through yesterday, then CI/CO for TODAY.
 *
 * Run inside Innora Coolify container with:
 *   node --import tsx /tmp/fo-catchup-to-today.mjs
 * Requires @hotel-os/core at node_modules/@hotel-os/core and SUPABASE_* env.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { executeNightAudit } from "@hotel-os/core/night-audit/run";
import { postRoomNightsForBooking } from "@hotel-os/core/folio/room-night";

const TODAY = process.env.TODAY || "2026-11-13";
const SLUG = process.env.PROPERTY_SLUG || "pelbu-olakha";
const MAX_AUTO_ROOMS = Number(process.env.MAX_AUTO_ROOMS || 4);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE URL or SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function addDays(ymd, n) {
  const [Y, M, D] = ymd.split("-").map(Number);
  return new Date(Date.UTC(Y, M - 1, D + n)).toISOString().slice(0, 10);
}

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

async function getProperty() {
  const { data, error } = await admin
    .from("properties")
    .select("id, slug, current_business_date, name")
    .eq("slug", SLUG)
    .single();
  if (error || !data) throw new Error(error?.message || "property missing");
  return data;
}

async function roomQty(bookingId) {
  const { data } = await admin
    .from("booking_rooms")
    .select("qty")
    .eq("booking_id", bookingId);
  return (data ?? []).reduce((s, r) => s + Number(r.qty || 0), 0);
}

async function pickUnitIds(propertyId, bookingId) {
  const { data: lines, error } = await admin
    .from("booking_rooms")
    .select("room_type_id, inventory_kind, qty")
    .eq("booking_id", bookingId);
  if (error) throw new Error(error.message);
  if (!lines?.length) throw new Error(`No booking_rooms for ${bookingId}`);

  const { data: booking } = await admin
    .from("bookings")
    .select("check_in, check_out")
    .eq("id", bookingId)
    .single();
  const from = String(booking?.check_in || TODAY).slice(0, 10);
  const to = String(booking?.check_out || TODAY).slice(0, 10);

  // Only active stays block inventory (stale checked_out assignments linger).
  const { data: busy } = await admin
    .from("room_assignments")
    .select("room_unit_id, from_date, to_date, bookings!inner(status)")
    .eq("property_id", propertyId)
    .lt("from_date", to)
    .gt("to_date", from)
    .in("bookings.status", ["checked_in", "confirmed"]);

  const busyIds = new Set((busy ?? []).map((r) => r.room_unit_id));

  const picked = [];
  for (const line of lines) {
    const need = Number(line.qty || 0);
    const { data: units, error: uErr } = await admin
      .from("room_units")
      .select("id, label, hk_status, room_type_id")
      .eq("property_id", propertyId)
      .eq("room_type_id", line.room_type_id)
      .neq("hk_status", "ooo")
      .order("sort_order", { ascending: true });
    if (uErr) throw new Error(uErr.message);
    let got = 0;
    for (const u of units ?? []) {
      if (got >= need) break;
      if (busyIds.has(u.id) || picked.includes(u.id)) continue;
      if (u.hk_status !== "clean" && u.hk_status !== "inspected") continue;
      picked.push(u.id);
      busyIds.add(u.id);
      got += 1;
    }
    if (got < need) {
      // fallback: any non-ooo of that type (incl. dirty/occupied leftover)
      for (const u of units ?? []) {
        if (got >= need) break;
        if (busyIds.has(u.id) || picked.includes(u.id)) continue;
        picked.push(u.id);
        busyIds.add(u.id);
        got += 1;
      }
    }
    if (got < need) {
      throw new Error(
        `Not enough rooms for booking ${bookingId} type ${line.room_type_id} need ${need} got ${got}`,
      );
    }
  }
  return picked;
}

async function ensureOpenFolio(propertyId, bookingId, label) {
  const { data: existing } = await admin
    .from("folios")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("property_id", propertyId)
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: folio, error } = await admin
    .from("folios")
    .insert({
      property_id: propertyId,
      booking_id: bookingId,
      folio_type: "guest",
      label,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !folio) throw new Error(error?.message || "folio open failed");
  return folio.id;
}

async function checkInOne(propertyId, booking) {
  const qty = await roomQty(booking.id);
  if (qty > MAX_AUTO_ROOMS) {
    log("SKIP large booking", booking.confirmation_code, "rooms", qty);
    return { skipped: true, reason: "large" };
  }

  if (booking.status === "held") {
    const { error } = await admin
      .from("bookings")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", booking.id)
      .eq("status", "held");
    if (error) throw new Error(error.message);
    booking.status = "confirmed";
  }

  const unitIds = await pickUnitIds(propertyId, booking.id);
  const { data: assignRpc, error: assignErr } = await admin.rpc(
    "desk_apply_check_in_rooms",
    {
      p_property_id: propertyId,
      p_booking_id: booking.id,
      p_unit_ids: unitIds,
      p_require_clean: false,
    },
  );
  if (assignErr) throw new Error(`assign ${booking.confirmation_code}: ${assignErr.message}`);

  const { data: ciRpc, error: ciErr } = await admin.rpc("check_in_guest_atomic", {
    p_property_id: propertyId,
    p_booking_id: booking.id,
    p_idempotency_key: randomUUID(),
    p_room_unit_id: unitIds[0] ?? null,
  });
  if (ciErr) throw new Error(`check_in ${booking.confirmation_code}: ${ciErr.message}`);
  if (!ciRpc?.ok) throw new Error(`check_in not ok ${booking.confirmation_code}`);

  await admin
    .from("bookings")
    .update({ checked_in_at: new Date().toISOString() })
    .eq("id", booking.id);

  const folioId = await ensureOpenFolio(
    propertyId,
    booking.id,
    `${booking.contact_name || booking.confirmation_code} · ${booking.check_in}`,
  );

  const night = await postRoomNightsForBooking(
    admin,
    propertyId,
    booking.id,
    String(booking.check_in).slice(0, 10),
  );

  log(
    "CHECKED_IN",
    booking.confirmation_code,
    "rooms",
    unitIds.length,
    "folio",
    folioId.slice(0, 8),
    "day1",
    night,
    "assign",
    assignRpc ?? null,
  );
  return { skipped: false, folioId, night };
}

async function checkOutOne(propertyId, booking) {
  const { data, error } = await admin.rpc("settle_checkout_atomic", {
    p_property_id: propertyId,
    p_booking_id: booking.id,
    p_idempotency_key: randomUUID(),
    p_allow_balance: true,
  });
  if (error) throw new Error(`checkout ${booking.confirmation_code}: ${error.message}`);
  log("CHECKED_OUT", booking.confirmation_code, data);
  return data;
}

async function arrivalsForDay(propertyId, day) {
  // Only CI guests who should still be in-house as of TODAY.
  // Past-complete stays stay confirmed → night audit marks no_show.
  const { data, error } = await admin
    .from("bookings")
    .select(
      "id, confirmation_code, status, check_in, check_out, contact_name, rooms",
    )
    .eq("property_id", propertyId)
    .in("status", ["confirmed", "held"])
    .eq("check_in", day)
    .gt("check_out", TODAY)
    .order("confirmation_code");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function departuresForDay(propertyId, day) {
  const { data, error } = await admin
    .from("bookings")
    .select("id, confirmation_code, status, check_in, check_out, contact_name")
    .eq("property_id", propertyId)
    .eq("status", "checked_in")
    .eq("check_out", day)
    .order("confirmation_code");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function stayThroughToday(propertyId) {
  const { data, error } = await admin
    .from("bookings")
    .select(
      "id, confirmation_code, status, check_in, check_out, contact_name, rooms",
    )
    .eq("property_id", propertyId)
    .in("status", ["confirmed", "held"])
    .lte("check_in", TODAY)
    .gt("check_out", TODAY)
    .order("check_in")
    .order("confirmation_code");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function overdueInHouse(propertyId) {
  const { data, error } = await admin
    .from("bookings")
    .select("id, confirmation_code, status, check_in, check_out, contact_name")
    .eq("property_id", propertyId)
    .eq("status", "checked_in")
    .lte("check_out", TODAY)
    .order("check_out")
    .order("confirmation_code");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function closeDay(propertyId, businessDate) {
  log("NIGHT_AUDIT start", businessDate);
  const result = await executeNightAudit(admin, propertyId, businessDate, {
    runBy: "desk",
    notes: `force close FO catch-up to ${TODAY}`,
    forceClose: true,
  });
  log("NIGHT_AUDIT done", {
    businessDate: result.businessDate,
    posted: result.posted,
    skipped: result.skipped,
    noShows: result.pipeline?.find?.(() => false),
    blockers: result.blockers,
    roomsOccupied: result.roomsOccupied,
  });
  return result;
}

async function main() {
  const prop = await getProperty();
  let biz = String(prop.current_business_date).slice(0, 10);
  log("START", prop.slug, "biz", biz, "TODAY", TODAY);

  if (biz > TODAY) {
    throw new Error(`Business date ${biz} is already past TODAY ${TODAY}`);
  }

  while (biz < TODAY) {
    log("--- day", biz, "---");
    for (const b of await arrivalsForDay(prop.id, biz)) {
      try {
        await checkInOne(prop.id, b);
      } catch (e) {
        log("CI_FAIL", b.confirmation_code, e instanceof Error ? e.message : e);
        throw e;
      }
    }
    for (const b of await departuresForDay(prop.id, biz)) {
      try {
        await checkOutOne(prop.id, b);
      } catch (e) {
        log("CO_FAIL", b.confirmation_code, e instanceof Error ? e.message : e);
        throw e;
      }
    }
    await closeDay(prop.id, biz);
    const refreshed = await getProperty();
    const next = String(refreshed.current_business_date).slice(0, 10);
    if (next !== addDays(biz, 1)) {
      log("WARN expected biz", addDays(biz, 1), "got", next, "— forcing");
      await admin
        .from("properties")
        .update({ current_business_date: addDays(biz, 1) })
        .eq("id", prop.id);
      biz = addDays(biz, 1);
    } else {
      biz = next;
    }
  }

  log("--- open day", TODAY, "CI/CO ---");
  const ciErrors = [];
  for (const b of await stayThroughToday(prop.id)) {
    try {
      await checkInOne(prop.id, b);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("CI_FAIL", b.confirmation_code, msg);
      ciErrors.push(`${b.confirmation_code}: ${msg}`);
    }
  }
  const coErrors = [];
  for (const b of await overdueInHouse(prop.id)) {
    try {
      await checkOutOne(prop.id, b);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("CO_FAIL", b.confirmation_code, msg);
      coErrors.push(`${b.confirmation_code}: ${msg}`);
    }
  }
  if (ciErrors.length || coErrors.length) {
    log("PARTIAL_ERRORS", { ciErrors, coErrors });
  }

  const final = await getProperty();
  const { data: statusCounts } = await admin
    .from("bookings")
    .select("status")
    .eq("property_id", prop.id);

  const counts = {};
  for (const row of statusCounts ?? []) {
    counts[row.status] = (counts[row.status] || 0) + 1;
  }

  const { count: inHouse } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("property_id", prop.id)
    .eq("status", "checked_in");

  log("DONE", {
    biz: final.current_business_date,
    inHouse,
    counts,
  });
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
