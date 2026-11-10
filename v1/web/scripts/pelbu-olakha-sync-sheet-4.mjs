/**
 * Fill Pelbu from Reservation 2026 (4).xlsx, from today forward.
 * Painted rooms and a written quote only. No folio charge, no void, no past-night move.
 *
 *   node --env-file=.env.local scripts/pelbu-olakha-sync-sheet-4.mjs
 *   node --env-file=.env.local scripts/pelbu-olakha-sync-sheet-4.mjs --apply
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseRack } from "./lib/pelbu-olakha-rack.mjs";
import { PROPERTY_SLUG } from "./lib/pelbu-olakha-rooms.mjs";

const APPLY = process.argv.includes("--apply");
const RACK =
  process.argv.find((a) => a.startsWith("--in="))?.slice(5) ||
  "C:/Users/rajiv/Downloads/Reservation 2026 (4).xlsx";
const STOP = new Set(["guest", "pax", "room", "plan", "and", "the", "mr", "mrs", "ms"]);

function loadEnv(path) {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s) {
  return norm(s)
    .split(" ")
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function guestScore(a, b) {
  const left = tokens(a);
  const right = new Set(tokens(b));
  if (!left.length || !right.size) return 0;
  let hit = 0;
  for (const t of left) if (right.has(t)) hit += 1;
  return hit / left.length;
}

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function runs(dates) {
  const sorted = [...dates].sort();
  const out = [];
  for (const date of sorted) {
    const last = out[out.length - 1];
    if (last && last.to === date) last.to = addDays(date, 1);
    else out.push({ from: date, to: addDays(date, 1) });
  }
  return out;
}

function nightsBetween(cin, cout) {
  const n = (Date.parse(cout) - Date.parse(cin)) / 86400000;
  return Number.isFinite(n) && n > 0 ? n : 0;
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
  .select("id, slug")
  .eq("slug", PROPERTY_SLUG)
  .maybeSingle();
if (pErr || !property) throw new Error(pErr?.message || `Missing ${PROPERTY_SLUG}`);

const parsed = parseRack(RACK, today);
const stays = parsed.stays.filter((s) => {
  if (s.blocking || !s.check_in || !s.check_out) return false;
  if (s.status === "cancelled" || s.status === "held") return false;
  return s.check_out > today;
});

const { data: units, error: uErr } = await admin
  .from("room_units")
  .select("id, label, room_type_id")
  .eq("property_id", property.id);
if (uErr) throw new Error(uErr.message);
const unitByLabel = new Map((units || []).map((u) => [String(u.label), u]));

const { data: bookings, error: bErr } = await admin
  .from("bookings")
  .select(
    "id, confirmation_code, contact_name, status, check_in, check_out, quoted_total_btn, rooms, external_ref",
  )
  .eq("property_id", property.id)
  .not("status", "eq", "cancelled")
  .limit(5000);
if (bErr) throw new Error(bErr.message);

const { data: assigns, error: aErr } = await admin
  .from("room_assignments")
  .select("id, booking_id, room_unit_id, from_date, to_date")
  .eq("property_id", property.id);
if (aErr) throw new Error(aErr.message);

const spans = assigns || [];
function covers(span, unitId, night) {
  return (
    span.room_unit_id === unitId &&
    span.from_date <= night &&
    night < span.to_date
  );
}

const sheetClaim = new Map();
for (const stay of stays) {
  const map = stay.doorNights;
  if (!map) continue;
  for (const [door, set] of map) {
    for (const night of set) {
      if (night < today) continue;
      const key = `${door}|${night}`;
      const list = sheetClaim.get(key) ?? [];
      list.push(stay.guest_name || stay.agent_code);
      sheetClaim.set(key, list);
    }
  }
}
const clashes = [];
for (const [key, names] of sheetClaim) {
  if (names.length > 1) clashes.push({ key, names });
}

function findBooking(stay) {
  let best = null;
  let bestScore = 0;
  let second = 0;
  for (const b of bookings || []) {
    if (b.check_in >= stay.check_out || stay.check_in >= b.check_out) continue;
    const score = guestScore(stay.guest_name, b.contact_name);
    if (score > bestScore) {
      second = bestScore;
      bestScore = score;
      best = b;
    } else if (score > second) second = score;
  }
  if (!best || bestScore < 0.5) return null;
  if (second >= 0.5 && bestScore - second < 0.15) return { ambiguous: true, best, bestScore };
  return { ambiguous: false, best, bestScore };
}

const quotes = [];
const checkoutExt = [];
const assignAdds = [];
const skippedClash = [];
const ambiguous = [];
const unmatched = [];
const used = new Set();

for (const stay of stays) {
  const hit = findBooking(stay);
  if (!hit) {
    if (stay.check_in >= today) unmatched.push(stay);
    continue;
  }
  if (hit.ambiguous) {
    ambiguous.push({
      guest: stay.guest_name,
      cin: stay.check_in,
      cout: stay.check_out,
      against: hit.best.confirmation_code,
    });
    continue;
  }
  const booking = hit.best;
  if (used.has(booking.id)) continue;
  used.add(booking.id);

  const quoted = Number(stay.quoted_total_btn);
  const src = stay.amount_source;
  const written =
    Number.isFinite(quoted) &&
    quoted >= 500 &&
    (src === "comment_total" || src === "meal_nightly_x_rooms_nights");
  const currentQuote = Number(booking.quoted_total_btn);
  if (written && !(currentQuote > 0.5)) {
    const n = nightsBetween(stay.check_in, stay.check_out) || 1;
    const rooms = Math.max(stay.doors?.length || booking.rooms || 1, 1);
    quotes.push({
      id: booking.id,
      code: booking.confirmation_code,
      guest: stay.guest_name,
      quoted,
      nightly: Math.round((quoted / (n * rooms)) * 100) / 100,
    });
  }

  if (
    stay.check_out > booking.check_out &&
    booking.check_out >= today &&
    booking.status !== "checked_out"
  ) {
    checkoutExt.push({
      id: booking.id,
      code: booking.confirmation_code,
      guest: stay.guest_name,
      from: booking.check_out,
      to: stay.check_out,
    });
  }

  const map = stay.doorNights;
  if (!map) continue;
  for (const [door, set] of map) {
    const unit = unitByLabel.get(String(door));
    if (!unit) continue;
    const missing = [];
    for (const night of set) {
      if (night < today) continue;
      const key = `${door}|${night}`;
      if ((sheetClaim.get(key) || []).length > 1) {
        skippedClash.push({ code: booking.confirmation_code, key });
        continue;
      }
      const mine = spans.some(
        (span) => span.booking_id === booking.id && covers(span, unit.id, night),
      );
      if (mine) continue;
      const taken = spans.some(
        (span) => span.booking_id !== booking.id && covers(span, unit.id, night),
      );
      if (taken) {
        skippedClash.push({ code: booking.confirmation_code, key, taken: true });
        continue;
      }
      missing.push(night);
    }
    for (const range of runs(missing)) {
      assignAdds.push({
        bookingId: booking.id,
        code: booking.confirmation_code,
        guest: stay.guest_name,
        door,
        roomUnitId: unit.id,
        from: range.from,
        to: range.to,
      });
    }
  }
}

const summary = {
  apply: APPLY,
  today,
  rack: RACK.split(/[/\\]/).pop(),
  stays: stays.length,
  quotes: quotes.length,
  checkoutExt: checkoutExt.length,
  assignAdds: assignAdds.length,
  sheetClashes: clashes.length,
  skippedClash: skippedClash.length,
  ambiguous: ambiguous.length,
  unmatchedFuture: unmatched.length,
};
console.log(JSON.stringify(summary, null, 2));
console.log("\nQuotes:");
for (const q of quotes) console.log(`  ${q.code} ${q.guest} Nu ${q.quoted}`);
console.log("\nCheckout longer:");
for (const c of checkoutExt) console.log(`  ${c.code} ${c.guest} ${c.from} → ${c.to}`);
console.log("\nRooms to add:");
for (const a of assignAdds) console.log(`  ${a.code} ${a.guest} ${a.door} ${a.from}→${a.to}`);
console.log("\nSheet clashes (not overwritten):");
for (const c of clashes) console.log(`  ${c.key} ${c.names.join(" / ")}`);
console.log("\nAmbiguous:");
for (const a of ambiguous) console.log(`  ${a.guest} ${a.cin} vs ${a.against}`);
console.log("\nUnmatched from today (listed, not inserted):");
for (const s of unmatched) {
  console.log(`  ${s.check_in}→${s.check_out} ${s.room_labels} ${s.guest_name}`);
}

if (!APPLY) {
  console.log("\nDRY-RUN — re-run with --apply to write quotes, checkout, and rooms.");
  process.exit(0);
}

let ok = 0;
let fail = 0;
for (const q of quotes) {
  const { error } = await admin
    .from("bookings")
    .update({
      quoted_total_btn: q.quoted,
      agreed_nightly_rate_btn: q.nightly,
      agreed_rate_reason: `Reservation sheet: Nu ${q.quoted} incl 10% SC, no GST`,
      agreed_rate_set_at: new Date().toISOString(),
      agreed_rate_set_by: "ops:sheet-4",
      rate_tax_mode: "inclusive",
      tax_exempt_gst: true,
    })
    .eq("id", q.id)
    .eq("property_id", property.id);
  if (error) {
    fail += 1;
    console.error("quote", q.code, error.message);
  } else ok += 1;
}
for (const c of checkoutExt) {
  const { error } = await admin
    .from("bookings")
    .update({ check_out: c.to })
    .eq("id", c.id)
    .eq("property_id", property.id);
  if (error) {
    fail += 1;
    console.error("checkout", c.code, error.message);
  } else ok += 1;
}
for (const a of assignAdds) {
  const { error } = await admin.from("room_assignments").insert({
    property_id: property.id,
    booking_id: a.bookingId,
    room_unit_id: a.roomUnitId,
    from_date: a.from,
    to_date: a.to,
    chargeable: true,
  });
  if (error) {
    fail += 1;
    console.error("assign", a.code, a.door, error.message);
  } else ok += 1;
}
console.log(JSON.stringify({ applied: ok, failed: fail }, null, 2));
