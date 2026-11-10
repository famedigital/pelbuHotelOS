/**
 * Pelbu Olakha, through today (Asia/Thimphu):
 * - Check out every rack stay whose departure is today or earlier.
 *   Guide number is not required. Agent stays are marked guide waived.
 * - In house: arrived before today, still here after today → checked_in.
 * - Arrivals: arriving today and leaving after today → confirmed.
 * - Each checkout gets an open folio and a PSFN number. The master bill
 *   number is the same serial with BN (PSBN). No tax invoice is issued.
 *
 *   node scripts/pelbu-olakha-fo-through-today.mjs
 *   node scripts/pelbu-olakha-fo-through-today.mjs --date=2026-10-26
 *   node scripts/pelbu-olakha-fo-through-today.mjs --date=2026-10-26 --apply
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseRack } from "./lib/pelbu-olakha-rack.mjs";
import { PROPERTY_SLUG } from "./lib/pelbu-olakha-rooms.mjs";

const APPLY = process.argv.includes("--apply");
const END_OF_DAY = process.argv.includes("--eod");
const RACK =
  process.argv.find((a) => a.startsWith("--in="))?.slice(5) ||
  "C:/Users/rajiv/Downloads/Reservation 2026 (5).xlsx";

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

function targetStatus(checkIn, checkOut, asOf) {
  if (!checkIn || !checkOut) return null;
  if (checkOut <= asOf) return "checked_out";
  // End of that day: arrivals on the date are already in house.
  if (END_OF_DAY && checkIn <= asOf && checkOut > asOf) return "checked_in";
  if (checkIn < asOf && checkOut > asOf) return "checked_in";
  return "confirmed";
}

function masterNo(folioNo) {
  const t = String(folioNo || "");
  if (!t) return "";
  return t.replace(/FN(?=-\d{4}-)/i, "BN");
}

loadEnv("C:/GitHub/Hotel OS Bhutan/web/.env.local");
const today =
  process.argv.find((a) => a.startsWith("--date="))?.slice(7) ||
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" });
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
  throw new Error(`Bad --date=${today}. Use YYYY-MM-DD.`);
}
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

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

const { data: property, error: pErr } = await admin
  .from("properties")
  .select("id, slug, name, current_business_date")
  .eq("slug", PROPERTY_SLUG)
  .maybeSingle();
if (pErr || !property) throw new Error(pErr?.message || `Missing ${PROPERTY_SLUG}`);

const parsed = parseRack(RACK, today);
const active = parsed.stays.filter(
  (s) => !s.blocking && s.status !== "cancelled" && s.check_in && s.check_out,
);

const bookings = await loadAll(() =>
  admin
    .from("bookings")
    .select(
      "id, confirmation_code, contact_name, status, check_in, check_out, external_ref, agent_id, guide_number, guide_sign_status, checked_in_at, checked_out_at, agents(company_name)",
    )
    .eq("property_id", property.id)
    .neq("status", "cancelled"),
);

const assigns = await loadAll(() =>
  admin
    .from("room_assignments")
    .select("booking_id, room_unit_id, from_date, to_date, room_units(label)")
    .eq("property_id", property.id),
);
const doorsByBooking = new Map();
for (const a of assigns) {
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
for (const b of bookings) {
  if (!b.external_ref) continue;
  byRef.set(b.external_ref, b);
  const stem = refStem(b.external_ref);
  if (!byStem.has(stem)) byStem.set(stem, []);
  byStem.get(stem).push(b);
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
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
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

const used = new Set();
const plans = [];
const unmatchedRack = [];
const watch = [];

for (const stay of active) {
  const hit = findHit(stay);
  if (!hit || used.has(hit.id)) {
    unmatchedRack.push(stay);
    continue;
  }
  used.add(hit.id);
  const status = targetStatus(stay.check_in, stay.check_out, today);
  if (stay.check_in <= today && stay.check_out >= today) {
    watch.push({
      bucket: status,
      code: hit.confirmation_code,
      db: hit.status,
      guest: stay.guest_name,
      rooms: stay.room_labels,
      cin: stay.check_in,
      cout: stay.check_out,
    });
  }
  if (!status) continue;
  const touchesToday =
    status === "checked_out" ||
    status === "checked_in" ||
    stay.check_in === today;
  if (!touchesToday) continue;
  const patch = {};
  if (hit.check_in !== stay.check_in) patch.check_in = stay.check_in;
  if (hit.check_out !== stay.check_out) patch.check_out = stay.check_out;
  if (hit.status !== status) patch.status = status;
  if (status === "checked_out") {
    if (!hit.checked_out_at) {
      patch.checked_out_at = `${stay.check_out}T11:00:00+06:00`;
    }
    if (!hit.checked_in_at) {
      patch.checked_in_at = `${stay.check_in}T08:00:00+06:00`;
    }
    if (
      hit.agent_id &&
      !["photo", "signed", "waived"].includes(
        String(hit.guide_sign_status || "").toLowerCase(),
      )
    ) {
      patch.guide_sign_status = "waived";
    }
  } else if (status === "checked_in") {
    if (!hit.checked_in_at) patch.checked_in_at = `${stay.check_in}T08:00:00+06:00`;
    if (hit.checked_out_at) patch.checked_out_at = null;
  } else if (status === "confirmed") {
    if (hit.checked_out_at) patch.checked_out_at = null;
  }
  const needDoors = [...stayDoors(stay)].filter(
    (d) => !(doorsByBooking.get(hit.id) ?? new Set()).has(d),
  );
  const needsFolio = status === "checked_out";
  if (!Object.keys(patch).length && !needDoors.length && !needsFolio) continue;
  plans.push({
    id: hit.id,
    code: hit.confirmation_code,
    guest: stay.guest_name || hit.contact_name,
    rooms: stay.room_labels,
    from: hit.status,
    to: status,
    checkIn: stay.check_in,
    checkOut: stay.check_out,
    patch,
    needDoors,
    needsFolio,
    source: "rack",
  });
}

const dbOnlyCheckout = [];
for (const b of bookings) {
  if (used.has(b.id)) continue;
  if (!["checked_in", "confirmed", "pending"].includes(b.status)) continue;
  if (!b.check_out || b.check_out > today) continue;
  const patch = { status: "checked_out" };
  if (!b.checked_out_at) patch.checked_out_at = `${b.check_out}T11:00:00+06:00`;
  if (!b.checked_in_at && b.check_in) {
    patch.checked_in_at = `${b.check_in}T08:00:00+06:00`;
  }
  if (
    b.agent_id &&
    !["photo", "signed", "waived"].includes(
      String(b.guide_sign_status || "").toLowerCase(),
    )
  ) {
    patch.guide_sign_status = "waived";
  }
  dbOnlyCheckout.push({
    id: b.id,
    code: b.confirmation_code,
    guest: b.contact_name,
    rooms: [...(doorsByBooking.get(b.id) || [])].join(", "),
    from: b.status,
    to: "checked_out",
    checkIn: b.check_in,
    checkOut: b.check_out,
    patch,
    needDoors: [],
    needsFolio: true,
    source: "db-ended",
  });
}

const tally = {};
for (const p of [...plans, ...dbOnlyCheckout]) {
  tally[p.to] = (tally[p.to] || 0) + 1;
}
const rackBuckets = { checkout: 0, in_house: 0, arrival: 0, future: 0 };
for (const s of active) {
  const st = targetStatus(s.check_in, s.check_out, today);
  if (st === "checked_out") rackBuckets.checkout += 1;
  else if (st === "checked_in") rackBuckets.in_house += 1;
  else if (s.check_in === today) rackBuckets.arrival += 1;
  else rackBuckets.future += 1;
}

console.log(
  JSON.stringify(
    {
      apply: APPLY,
      today,
      businessDate: property.current_business_date,
      rack: RACK.split(/[/\\]/).pop(),
      rackActive: active.length,
      dbBookings: bookings.length,
      rackBuckets,
      plans: plans.length,
      dbOnlyCheckout: dbOnlyCheckout.length,
      unmatchedRack: unmatchedRack.length,
      tally,
    },
    null,
    2,
  ),
);

function line(p) {
  const extra = p.needDoors.length ? ` doors+${p.needDoors.join(",")}` : "";
  return `  ${p.source} ${p.code || "—"} ${p.guest || ""} ${p.rooms || ""} | ${p.from} ${p.checkIn}→${p.checkOut} => ${p.to}${extra}`;
}

console.log("\nMatched stays still here today:");
for (const w of watch) console.log(`  ${w.bucket} db=${w.db} ${w.code} ${w.cin}→${w.cout} ${w.rooms} ${w.guest}`);
console.log("\nToday in-house and arrivals:");
for (const p of plans.filter((p) => p.to === "checked_in" || p.checkIn === today)) {
  console.log(line(p));
}
console.log("\nStatus changes (first 40):");
for (const p of [...plans, ...dbOnlyCheckout].filter((p) => p.patch.status).slice(0, 40)) {
  console.log(line(p));
}
if (unmatchedRack.length) {
  const focus = unmatchedRack.filter(
    (s) => s.check_out >= today && s.check_in <= today,
  );
  console.log(`\nUnmatched rack stays touching today: ${focus.length} of ${unmatchedRack.length}`);
  for (const s of focus.slice(0, 25)) {
    console.log(
      `  ${s.check_in}→${s.check_out} ${s.room_labels} | ${s.guest_name} | ${s.agent_name || s.agent_code}`,
    );
  }
}

if (!APPLY) {
  console.log("\nDRY-RUN — re-run with --apply to write. No invoices.");
  process.exit(0);
}

const sampleFolio = await admin
  .from("folios")
  .select("doc_no")
  .eq("property_id", property.id)
  .not("doc_no", "is", null)
  .limit(1)
  .maybeSingle();
const prefix =
  String(sampleFolio.data?.doc_no || "PSFN-2026-00001").match(/^[A-Za-z]+/)?.[0]?.replace(/FN$/i, "") ||
  "PS";

async function ensureFolio(plan) {
  const { data: existing, error } = await admin
    .from("folios")
    .select("id, doc_no, status, folio_type")
    .eq("booking_id", plan.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  let folio = (existing || []).find((f) => f.status === "open") || existing?.[0];
  if (!folio) {
    const { data: inserted, error: insErr } = await admin
      .from("folios")
      .insert({
        property_id: property.id,
        booking_id: plan.id,
        folio_type: "guest",
        label: plan.guest || plan.code || "Guest",
        status: "open",
      })
      .select("id, doc_no, status")
      .single();
    if (insErr) throw new Error(insErr.message);
    folio = inserted;
  } else if (folio.status !== "open") {
    const { data: inv } = await admin
      .from("fiscal_documents")
      .select("id")
      .eq("folio_id", folio.id)
      .eq("doc_kind", "invoice")
      .eq("status", "issued")
      .limit(1)
      .maybeSingle();
    if (!inv?.id) {
      const { error: openErr } = await admin
        .from("folios")
        .update({ status: "open", closed_at: null })
        .eq("id", folio.id);
      if (openErr) throw new Error(openErr.message);
    }
  }
  if (!folio.doc_no) {
    const year = String(plan.checkOut || today).slice(0, 4);
    const { data: seq, error: seqErr } = await admin.rpc("next_property_sequence", {
      p_property_id: property.id,
      p_kind: `folio_fn:${year}`,
    });
    if (seqErr) throw new Error(seqErr.message);
    const docNo = `${prefix}FN-${year}-${String(seq).padStart(5, "0")}`;
    const { error: docErr } = await admin
      .from("folios")
      .update({ doc_no: docNo })
      .eq("id", folio.id);
    if (docErr) throw new Error(docErr.message);
    folio.doc_no = docNo;
  }
  return { folioNo: folio.doc_no, masterNo: masterNo(folio.doc_no) };
}

let ok = 0;
let fail = 0;
let folios = 0;
let invoices = 0;
for (const plan of [...plans, ...dbOnlyCheckout]) {
  try {
    if (Object.keys(plan.patch).length) {
      const { error } = await admin.from("bookings").update(plan.patch).eq("id", plan.id);
      if (error) throw new Error(error.message);
    }
    if (plan.to === "checked_out" && plan.from === "checked_in") {
      const { error: relErr } = await admin.rpc("desk_release_check_out_rooms", {
        p_property_id: property.id,
        p_booking_id: plan.id,
      });
      if (relErr) throw new Error(relErr.message);
    }
    if (plan.needsFolio) {
      const bill = await ensureFolio(plan);
      folios += 1;
      if (ok < 8) {
        console.log(`  folio ${plan.code} ${bill.folioNo} master ${bill.masterNo}`);
      }
    }
    ok += 1;
  } catch (e) {
    fail += 1;
    console.error(`FAIL ${plan.code}:`, e instanceof Error ? e.message : e);
  }
}

const businessDate = property.current_business_date?.slice(0, 10) || "";
if (businessDate && businessDate < today) {
  const { error } = await admin
    .from("properties")
    .update({ current_business_date: today })
    .eq("id", property.id);
  if (error) console.error("business date:", error.message);
  else console.log(`Business date set to ${today}`);
} else if (businessDate && businessDate > today) {
  console.log(`Business date left at ${businessDate}`);
}

console.log(
  JSON.stringify(
    { applied: ok, failed: fail, foliosTouched: folios, invoicesIssued: invoices },
    null,
    2,
  ),
);
