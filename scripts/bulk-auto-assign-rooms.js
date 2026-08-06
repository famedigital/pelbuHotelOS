/**
 * One-shot: realign Olakha units to eZee room numbers (if migration not applied yet via SQL)
 * then bulk auto-assign all under-assigned bookings.
 *
 *   node scripts/bulk-auto-assign-rooms.js
 *   node scripts/bulk-auto-assign-rooms.js --skip-realign
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require(path.join(
  __dirname,
  "..",
  "web",
  "node_modules",
  "@supabase/supabase-js",
));

const SKIP_REALIGN = process.argv.includes("--skip-realign");
const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, "web", ".env.local");

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    env[k] = v;
  }
  return env;
}

const TWINS = [
  "201", "202", "203", "204", "205", "206",
  "301", "302", "303", "304", "305", "306",
  "401", "402", "403", "404", "405", "406",
  "501", "503", "504", "505",
];
const KINGS = ["207", "307", "407", "506"];
const SUITE = "502";

async function realign(admin, propertyId) {
  const { data: types } = await admin
    .from("room_types")
    .select("id, code, inventory_kind")
    .eq("property_id", propertyId)
    .eq("inventory_kind", "sellable_guest");
  const dt = types?.find((t) => t.code === "dt");
  const dq = types?.find((t) => t.code === "dq");
  const sr = types?.find((t) => t.code === "sr");
  if (!dt || !dq || !sr) throw new Error("Need dt/dq/sr room types");

  const { data: units } = await admin
    .from("room_units")
    .select("id, label, room_type_id, sort_order")
    .eq("property_id", propertyId)
    .in(
      "room_type_id",
      types.map((t) => t.id),
    )
    .order("sort_order")
    .order("label");

  if (!units?.length) throw new Error("No sellable units");

  // tmp labels
  for (const u of units) {
    await admin
      .from("room_units")
      .update({ label: `tmp-${u.id.slice(0, 8)}` })
      .eq("id", u.id);
  }

  const chart = [
    ...TWINS.map((label, i) => ({
      label,
      typeId: dt.id,
      floor: label[0],
      sort: i + 1,
    })),
    ...KINGS.map((label, i) => ({
      label,
      typeId: dq.id,
      floor: label[0],
      sort: TWINS.length + i + 1,
    })),
    {
      label: SUITE,
      typeId: sr.id,
      floor: SUITE[0],
      sort: TWINS.length + KINGS.length + 1,
    },
  ];

  while (units.length < chart.length) {
    const { data: nu, error } = await admin
      .from("room_units")
      .insert({
        property_id: propertyId,
        room_type_id: dt.id,
        label: `tmp-extra-${units.length}`,
        hk_status: "clean",
        sort_order: 900 + units.length,
      })
      .select("id, label, room_type_id, sort_order")
      .single();
    if (error) throw error;
    units.push(nu);
  }

  for (let i = 0; i < chart.length; i++) {
    const u = units[i];
    const c = chart[i];
    const { error } = await admin
      .from("room_units")
      .update({
        room_type_id: c.typeId,
        label: c.label,
        floor_label: c.floor,
        sort_order: c.sort,
      })
      .eq("id", u.id);
    if (error) throw error;
  }

  await admin.from("room_types").update({ unit_count: 22 }).eq("id", dt.id);
  await admin.from("room_types").update({ unit_count: 4, name: "King Room" }).eq("id", dq.id);
  await admin.from("room_types").update({ unit_count: 1 }).eq("id", sr.id);

  console.log("Realigned units to eZee room chart (22 twin / 4 king / 1 suite).");
}

function extractPreferred(notes) {
  if (!notes) return [];
  const found = [];
  for (const m of String(notes).matchAll(/ezee\s*room\s*:\s*([A-Za-z0-9\-]+)/gi)) {
    if (!found.includes(m[1])) found.push(m[1]);
  }
  return found;
}

function rangesOverlap(aFrom, aTo, bFrom, bTo) {
  return aFrom < bTo && bFrom < aTo;
}

async function bulkAssign(admin, propertyId) {
  const { data: bookings } = await admin
    .from("bookings")
    .select(
      "id, contact_name, check_in, check_out, notes, external_ref, booking_rooms(room_type_id, qty, inventory_kind)",
    )
    .eq("property_id", propertyId)
    .in("status", ["held", "pending", "confirmed", "checked_in"])
    .order("check_in", { ascending: true })
    .order("check_out", { ascending: true })
    .limit(2500);

  const stats = {
    processed: 0,
    inserted: 0,
    preferred: 0,
    shortfall: 0,
    complete: 0,
  };

  for (const b of bookings ?? []) {
    stats.processed++;
    const checkIn = b.check_in;
    const checkOut = b.check_out;
    if (!checkIn || !checkOut || checkOut <= checkIn) continue;
    const lines = (b.booking_rooms || []).filter(
      (l) => l.inventory_kind === "sellable_guest" && l.qty > 0,
    );
    if (!lines.length) continue;

    const demand = new Map();
    for (const l of lines) {
      demand.set(l.room_type_id, (demand.get(l.room_type_id) || 0) + l.qty);
    }
    const typeIds = [...demand.keys()];
    const preferred = extractPreferred(b.notes);

    const [{ data: units }, { data: busy }, { data: current }] =
      await Promise.all([
        admin
          .from("room_units")
          .select("id, room_type_id, label, sort_order")
          .eq("property_id", propertyId)
          .in("room_type_id", typeIds)
          .order("sort_order")
          .order("label"),
        admin
          .from("room_assignments")
          .select("room_unit_id, from_date, to_date")
          .eq("property_id", propertyId)
          .lt("from_date", checkOut)
          .gt("to_date", checkIn),
        admin
          .from("room_assignments")
          .select("room_unit_id, room_units(room_type_id)")
          .eq("booking_id", b.id),
      ]);

    const occupied = new Set();
    for (const row of busy || []) {
      if (rangesOverlap(checkIn, checkOut, row.from_date, row.to_date)) {
        occupied.add(row.room_unit_id);
      }
    }
    const assignedByType = new Map();
    for (const row of current || []) {
      const t = row.room_units?.room_type_id;
      if (!t) continue;
      assignedByType.set(t, (assignedByType.get(t) || 0) + 1);
    }

    const byType = new Map();
    for (const u of units || []) {
      const list = byType.get(u.room_type_id) || [];
      list.push(u);
      byType.set(u.room_type_id, list);
    }

    const inserts = [];
    let short = 0;
    for (const [typeId, need] of demand) {
      const already = assignedByType.get(typeId) || 0;
      const needed = Math.max(0, need - already);
      if (!needed) continue;
      let pool = (byType.get(typeId) || []).filter((u) => !occupied.has(u.id));
      if (preferred.length) {
        const prefer = pool.filter((u) => preferred.includes(String(u.label)));
        const rest = pool.filter((u) => !preferred.includes(String(u.label)));
        pool = [...prefer, ...rest];
      }
      const take = Math.min(needed, pool.length);
      short += Math.max(0, needed - take);
      for (let i = 0; i < take; i++) {
        if (preferred.includes(String(pool[i].label))) stats.preferred++;
        occupied.add(pool[i].id);
        inserts.push({
          property_id: propertyId,
          booking_id: b.id,
          room_unit_id: pool[i].id,
          from_date: checkIn,
          to_date: checkOut,
        });
      }
    }

    if (inserts.length) {
      const { error } = await admin.from("room_assignments").insert(inserts);
      if (error) {
        console.error("assign fail", b.external_ref || b.id, error.message);
        stats.shortfall += inserts.length;
        continue;
      }
      stats.inserted += inserts.length;
    }
    if (short === 0) stats.complete++;
    else stats.shortfall += short;

    if (stats.processed % 50 === 0) {
      console.log(`… ${stats.processed} bookings, ${stats.inserted} assignments`);
    }
  }
  return stats;
}

async function main() {
  const env = loadEnv(ENV_PATH);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env in web/.env.local");
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: property, error } = await admin
    .from("properties")
    .select("id, slug")
    .eq("slug", "pelbu-suites-olakha")
    .single();
  if (error || !property) throw error || new Error("property missing");

  if (!SKIP_REALIGN) {
    await realign(admin, property.id);
  }

  const stats = await bulkAssign(admin, property.id);
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
