/**
 * Align pelbu-olakha booking dates + status with the Drive reservation rack
 * so Reservation / In House / Departure lists match FO reality.
 *
 *   node --env-file=.env.local scripts/pelbu-olakha-sync-fo-from-rack.mjs
 *   node --env-file=.env.local scripts/pelbu-olakha-sync-fo-from-rack.mjs --apply
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseRack } from "./lib/pelbu-olakha-rack.mjs";
import { PROPERTY_SLUG } from "./lib/pelbu-olakha-rooms.mjs";

const APPLY = process.argv.includes("--apply");
const RACK =
  process.argv.find((a) => a.startsWith("--in="))?.slice(5) ||
  "C:/Users/rajiv/Downloads/Reservation 2026 (2).xlsx";

function loadEnv(path) {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

function refStem(ref) {
  return String(ref || "")
    .replace(/:[a-f0-9]{6,10}$/i, "")
    .toLowerCase();
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stayDoors(stay) {
  if (stay.doors?.length) return new Set(stay.doors.map(String));
  return new Set(
    String(stay.room_labels || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  );
}

loadEnv("C:/GitHub/Hotel OS Bhutan/web/.env.local");
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" });
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: property, error: pErr } = await admin
  .from("properties")
  .select("id, slug, name")
  .eq("slug", PROPERTY_SLUG)
  .maybeSingle();
if (pErr || !property) throw new Error(pErr?.message || `Missing ${PROPERTY_SLUG}`);

const parsed = parseRack(RACK, today);
const active = parsed.stays.filter(
  (s) => !s.blocking && s.status !== "cancelled" && s.check_in && s.check_out,
);

const { data: bookings, error: bErr } = await admin
  .from("bookings")
  .select(
    "id, confirmation_code, contact_name, status, check_in, check_out, external_ref, checked_in_at, checked_out_at, agents(company_name)",
  )
  .eq("property_id", property.id)
  .not("status", "eq", "cancelled")
  .limit(5000);
if (bErr) throw new Error(bErr.message);

const { data: assigns } = await admin
  .from("room_assignments")
  .select("booking_id, room_units(label)")
  .in(
    "booking_id",
    (bookings || []).map((b) => b.id),
  );
const doorsByBooking = new Map();
for (const a of assigns || []) {
  const label = Array.isArray(a.room_units)
    ? a.room_units[0]?.label
    : a.room_units?.label;
  if (!label || !a.booking_id) continue;
  const set = doorsByBooking.get(a.booking_id) ?? new Set();
  set.add(String(label));
  doorsByBooking.set(a.booking_id, set);
}

const byRef = new Map();
const byStem = new Map();
for (const b of bookings || []) {
  if (b.external_ref) {
    byRef.set(b.external_ref, b);
    const stem = refStem(b.external_ref);
    if (!byStem.has(stem)) byStem.set(stem, []);
    byStem.get(stem).push(b);
  }
}

function findHit(stay) {
  if (stay.external_ref && byRef.has(stay.external_ref)) {
    return byRef.get(stay.external_ref);
  }
  const stemHits = byStem.get(refStem(stay.external_ref)) || [];
  if (stemHits.length === 1) return stemHits[0];
  if (stemHits.length > 1) {
    const doorHit = stemHits.find((b) => {
      const bd = doorsByBooking.get(b.id) ?? new Set();
      for (const d of stayDoors(stay)) if (bd.has(d)) return true;
      return false;
    });
    if (doorHit) return doorHit;
  }

  const sDoors = stayDoors(stay);
  const guest = norm(stay.guest_name);
  const agent = norm(stay.agent_name || stay.agent_code);
  let best = null;
  let bestScore = 0;
  for (const b of bookings || []) {
    if (b.status === "cancelled") continue;
    // Same arrival; checkout may have drifted a day on the rack.
    if (b.check_in !== stay.check_in) continue;
    const coutClose =
      b.check_out === stay.check_out ||
      Math.abs(Date.parse(b.check_out) - Date.parse(stay.check_out)) <=
        86400000 * 2;
    if (!coutClose) continue;

    const bGuest = norm(b.contact_name);
    const bAgent = norm(b.agents?.company_name || "");
    const guestHit =
      guest &&
      bGuest &&
      (guest === bGuest ||
        guest.includes(bGuest.slice(0, 10)) ||
        bGuest.includes(guest.slice(0, 10)));
    const agentHit =
      agent && bAgent && (agent.includes(bAgent) || bAgent.includes(agent));
    const bDoors = doorsByBooking.get(b.id) ?? new Set();
    let doorOverlap = 0;
    for (const d of sDoors) if (bDoors.has(d)) doorOverlap += 1;

    let score = 0;
    if (doorOverlap) score += 3 + doorOverlap;
    if (guestHit) score += 2;
    if (agentHit) score += 1;
    if (b.check_out === stay.check_out) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return bestScore >= 3 ? best : null;
}

function timestampsFor(status, checkIn, checkOut) {
  if (status === "checked_out") {
    return {
      checked_in_at: `${checkIn}T08:00:00+06:00`,
      checked_out_at: `${checkOut}T06:00:00+06:00`,
    };
  }
  if (status === "checked_in") {
    return {
      checked_in_at: `${checkIn}T08:00:00+06:00`,
      checked_out_at: null,
    };
  }
  return { checked_in_at: null, checked_out_at: null };
}

const changes = [];
const unmatched = [];
const usedBookingIds = new Set();

for (const stay of active) {
  const hit = findHit(stay);
  if (!hit || usedBookingIds.has(hit.id)) {
    unmatched.push(stay);
    continue;
  }
  usedBookingIds.add(hit.id);

  const patch = {};
  if (hit.check_in !== stay.check_in) patch.check_in = stay.check_in;
  if (hit.check_out !== stay.check_out) patch.check_out = stay.check_out;
  if (hit.status !== stay.status) patch.status = stay.status;
  if (stay.external_ref && hit.external_ref !== stay.external_ref) {
    patch.external_ref = stay.external_ref;
  }

  if (Object.keys(patch).length === 0) continue;

  const nextStatus = patch.status || hit.status;
  const nextIn = patch.check_in || hit.check_in;
  const nextOut = patch.check_out || hit.check_out;
  Object.assign(patch, timestampsFor(nextStatus, nextIn, nextOut));

  changes.push({
    id: hit.id,
    code: hit.confirmation_code,
    guest: stay.guest_name,
    rooms: stay.room_labels,
    from: {
      status: hit.status,
      check_in: hit.check_in,
      check_out: hit.check_out,
    },
    to: {
      status: nextStatus,
      check_in: nextIn,
      check_out: nextOut,
    },
    patch,
  });
}

// Safety net: anyone with CO=today still marked checked_out cannot appear on
// Departures — flip them to checked_in even without a rack match.
for (const b of bookings || []) {
  if (usedBookingIds.has(b.id)) continue;
  if (b.check_out !== today || b.status !== "checked_out") continue;
  const patch = {
    status: "checked_in",
    ...timestampsFor("checked_in", b.check_in, b.check_out),
  };
  changes.push({
    id: b.id,
    code: b.confirmation_code,
    guest: b.contact_name,
    rooms: [...(doorsByBooking.get(b.id) || [])].join(", "),
    from: { status: b.status, check_in: b.check_in, check_out: b.check_out },
    to: {
      status: "checked_in",
      check_in: b.check_in,
      check_out: b.check_out,
    },
    patch,
    safetyNet: true,
  });
}

const summary = {
  apply: APPLY,
  today,
  rack: RACK.split(/[/\\]/).pop(),
  property: property.slug,
  rackActive: active.length,
  dbBookings: (bookings || []).length,
  changes: changes.length,
  unmatched: unmatched.length,
  byToStatus: {},
};

for (const c of changes) {
  const s = c.to.status;
  summary.byToStatus[s] = (summary.byToStatus[s] || 0) + 1;
}

console.log(JSON.stringify(summary, null, 2));
console.log("\nChanges:");
for (const c of changes) {
  const tag = c.safetyNet ? " [safety]" : "";
  console.log(
    `  ${c.code} ${c.guest} ${c.rooms}${tag} | ${c.from.status} ${c.from.check_in}→${c.from.check_out} => ${c.to.status} ${c.to.check_in}→${c.to.check_out}`,
  );
}

if (unmatched.length) {
  console.log(`\nUnmatched rack stays: ${unmatched.length}`);
  for (const s of unmatched.slice(0, 20)) {
    console.log(
      `  ${s.status} ${s.check_in}→${s.check_out} ${s.room_labels} | ${s.guest_name}`,
    );
  }
}

if (!APPLY) {
  console.log("\nDRY-RUN — re-run with --apply to write.");
  process.exit(0);
}

let ok = 0;
let fail = 0;
for (const c of changes) {
  const { error } = await admin.from("bookings").update(c.patch).eq("id", c.id);
  if (error) {
    fail += 1;
    console.error(`FAIL ${c.code}:`, error.message);
  } else {
    ok += 1;
  }
}
console.log(JSON.stringify({ applied: ok, failed: fail }, null, 2));
