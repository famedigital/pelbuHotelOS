/**
 * Pelbu Suites — bulk check-out (departed before as-of) and check-in (arrived by as-of)
 * via check_in_guest_atomic / settle_checkout_atomic + guest folio + day-1 room nights.
 *
 *   node --env-file=.env.local scripts/pelbu-atomic-through-today.mjs
 *   node --env-file=.env.local scripts/pelbu-atomic-through-today.mjs --apply
 *   node --env-file=.env.local scripts/pelbu-atomic-through-today.mjs --date=2026-11-07 --apply
 */
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { postRoomNightsForBooking } from "../../packages/core/src/folio/room-night.ts";

const APPLY = process.argv.includes("--apply");
const today =
  process.argv.find((a) => a.startsWith("--date="))?.slice(7) ||
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" });

if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
  throw new Error(`Bad --date=${today}`);
}

const propertyId =
  process.env.FLAGSHIP_PROPERTY_ID ||
  process.env.DEFAULT_PROPERTY_ID ||
  "";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !propertyId) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or FLAGSHIP_PROPERTY_ID");
}

const admin = createClient(url, key, { auth: { persistSession: false } });

function stableIdem(bookingId, op) {
  const h = createHash("sha256")
    .update(`${propertyId}|${bookingId}|${op}|bulk|${today}`)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function loadAll(build) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function ensureOpenFolio(bookingId, label) {
  const { data: existing } = await admin
    .from("folios")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("property_id", propertyId)
    .eq("status", "open")
    .order("created_at")
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
  if (error || !folio) throw new Error(error?.message || "Could not open folio");
  return folio.id;
}

async function countSnapshot() {
  const bookings = await loadAll(() =>
    admin
      .from("bookings")
      .select("id, status, check_in, check_out")
      .eq("property_id", propertyId)
      .neq("status", "cancelled"),
  );
  const overdueIn = bookings.filter(
    (b) => b.status === "checked_in" && b.check_out && b.check_out < today,
  ).length;
  const needIn = bookings.filter(
    (b) =>
      ["pending", "confirmed", "held"].includes(b.status) &&
      b.check_in &&
      b.check_out &&
      b.check_in <= today &&
      b.check_out > today,
  ).length;
  const inHouseOk = bookings.filter(
    (b) =>
      b.status === "checked_in" &&
      b.check_in &&
      b.check_out &&
      b.check_in <= today &&
      b.check_out >= today,
  ).length;
  return { total: bookings.length, overdueIn, needIn, inHouseOk };
}

const { data: property, error: pErr } = await admin
  .from("properties")
  .select("id, slug, name, current_business_date, post_day1_room_at_checkin")
  .eq("id", propertyId)
  .maybeSingle();
if (pErr || !property) throw new Error(pErr?.message || "Property not found");

const before = await countSnapshot();
console.log(
  JSON.stringify(
    {
      mode: APPLY ? "apply" : "dry-run",
      today,
      property: {
        id: property.id,
        slug: property.slug,
        name: property.name,
        businessDate: property.current_business_date,
      },
      before,
    },
    null,
    2,
  ),
);

const bookings = await loadAll(() =>
  admin
    .from("bookings")
    .select(
      "id, confirmation_code, contact_name, status, check_in, check_out, payment_mode, agent_id",
    )
    .eq("property_id", propertyId)
    .neq("status", "cancelled"),
);

const assigns = await loadAll(() =>
  admin
    .from("room_assignments")
    .select("booking_id, room_unit_id")
    .eq("property_id", propertyId),
);
const roomsByBooking = new Map();
for (const a of assigns) {
  if (!a.booking_id || !a.room_unit_id) continue;
  const list = roomsByBooking.get(a.booking_id) ?? [];
  list.push(a.room_unit_id);
  roomsByBooking.set(a.booking_id, list);
}

const checkoutPlans = bookings.filter(
  (b) => b.status === "checked_in" && b.check_out && b.check_out < today,
);
const checkinPlans = bookings.filter(
  (b) =>
    ["pending", "confirmed", "held"].includes(b.status) &&
    b.check_in &&
    b.check_out &&
    b.check_in <= today &&
    b.check_out > today,
);

const report = {
  checkedOut: [],
  checkedIn: [],
  skipped: [],
  errors: [],
};

if (!APPLY) {
  for (const b of checkoutPlans) {
    report.checkedOut.push({
      dryRun: true,
      code: b.confirmation_code,
      guest: b.contact_name,
      checkOut: b.check_out,
    });
  }
  for (const b of checkinPlans) {
    const rooms = roomsByBooking.get(b.id) ?? [];
    if (!rooms.length) {
      report.skipped.push({
        code: b.confirmation_code,
        guest: b.contact_name,
        reason: "No room assignment",
      });
    } else {
      report.checkedIn.push({
        dryRun: true,
        code: b.confirmation_code,
        guest: b.contact_name,
        checkIn: b.check_in,
        rooms: rooms.length,
      });
    }
  }
  console.log(JSON.stringify({ plans: { checkout: checkoutPlans.length, checkin: checkinPlans.length }, report }, null, 2));
  console.log("\nDRY-RUN — re-run with --apply to execute atomics.");
  process.exit(0);
}

for (const b of checkoutPlans) {
  const name = b.contact_name || b.confirmation_code || b.id;
  try {
    const keyId = stableIdem(b.id, "settle_checkout");
    const { data, error } = await admin.rpc("settle_checkout_atomic", {
      p_property_id: propertyId,
      p_booking_id: b.id,
      p_idempotency_key: keyId,
      p_allow_balance: true,
    });
    if (error) throw new Error(error.message);
    if (!(data && data.ok)) throw new Error("settle_checkout_atomic returned not ok");
    report.checkedOut.push({
      code: b.confirmation_code,
      guest: name,
      checkOut: b.check_out,
      alreadyExists: Boolean(data.already_exists),
    });
  } catch (e) {
    report.errors.push({
      phase: "checkout",
      code: b.confirmation_code,
      guest: name,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

const postDay1 = property.post_day1_room_at_checkin !== false;

for (const b of checkinPlans) {
  const name = b.contact_name || b.confirmation_code || "Guest";
  const unitIds = roomsByBooking.get(b.id) ?? [];
  if (!unitIds.length) {
    report.skipped.push({
      code: b.confirmation_code,
      guest: name,
      reason: "No room assignment",
    });
    continue;
  }
  try {
    const keyId = stableIdem(b.id, "check_in");
    const { data, error } = await admin.rpc("check_in_guest_atomic", {
      p_property_id: propertyId,
      p_booking_id: b.id,
      p_idempotency_key: keyId,
      p_room_unit_id: unitIds[0],
    });
    if (error) throw new Error(error.message);
    if (!(data && data.ok)) throw new Error("check_in_guest_atomic returned not ok");

    await admin
      .from("bookings")
      .update({
        checked_in_at: new Date().toISOString(),
        guide_number: null,
        docs_deferred: true,
      })
      .eq("id", b.id)
      .eq("property_id", propertyId);

    const folioId = await ensureOpenFolio(
      b.id,
      `${name} · ${b.check_in}`,
    );

    let roomNote = "skipped-day1-off";
    if (postDay1) {
      const roomResult = await postRoomNightsForBooking(
        admin,
        propertyId,
        b.id,
        b.check_in,
      );
      roomNote =
        roomResult.posted > 0
          ? `posted-${roomResult.posted}`
          : roomResult.skipped > 0
            ? "room-night-already"
            : roomResult.errors[0] || "room-night-none";
    }

    report.checkedIn.push({
      code: b.confirmation_code,
      guest: name,
      checkIn: b.check_in,
      folioId,
      roomNight: roomNote,
      alreadyExists: Boolean(data.already_exists),
    });
  } catch (e) {
    report.errors.push({
      phase: "check_in",
      code: b.confirmation_code,
      guest: name,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

const after = await countSnapshot();
console.log(
  JSON.stringify(
    {
      property: { id: property.id, slug: property.slug },
      today,
      before,
      after,
      counts: {
        checkedOut: report.checkedOut.length,
        checkedIn: report.checkedIn.length,
        skipped: report.skipped.length,
        errors: report.errors.length,
      },
      report,
    },
    null,
    2,
  ),
);
