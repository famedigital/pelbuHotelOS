const fs = require("fs");
const path = require("path");
const { createClient } = require(path.join(
  __dirname,
  "..",
  "web",
  "node_modules",
  "@supabase/supabase-js",
));

function loadEnv(file) {
  const env = {};
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

function ov(a, b, c, d) {
  return a < d && c < b;
}

async function main() {
  const env = loadEnv(path.join(__dirname, "..", "web", ".env.local"));
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: p } = await admin
    .from("properties")
    .select("id")
    .eq("slug", "pelbu-suites-olakha")
    .single();
  const { data: open } = await admin
    .from("bookings")
    .select(
      "id, check_in, check_out, booking_rooms(room_type_id, qty, inventory_kind)",
    )
    .eq("property_id", p.id)
    .eq("status", "confirmed")
    .eq("channel_source", "ezee");
  let filled = 0;
  for (const b of open || []) {
    const { count } = await admin
      .from("room_assignments")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", b.id);
    if ((count || 0) > 0) continue;
    const typeId = (b.booking_rooms || []).find(
      (l) => l.inventory_kind === "sellable_guest",
    )?.room_type_id;
    if (!typeId) continue;
    const { data: units } = await admin
      .from("room_units")
      .select("id, label")
      .eq("property_id", p.id)
      .eq("room_type_id", typeId);
    const { data: busy } = await admin
      .from("room_assignments")
      .select("room_unit_id, from_date, to_date")
      .eq("property_id", p.id)
      .lt("from_date", b.check_out)
      .gt("to_date", b.check_in);
    const occ = new Set(
      (busy || [])
        .filter((r) => ov(b.check_in, b.check_out, r.from_date, r.to_date))
        .map((r) => r.room_unit_id),
    );
    const free = (units || []).find((u) => !occ.has(u.id));
    if (!free) {
      console.log("NO FREE", b.check_in, b.check_out, b.id);
      continue;
    }
    const { error } = await admin.from("room_assignments").insert({
      property_id: p.id,
      booking_id: b.id,
      room_unit_id: free.id,
      from_date: b.check_in,
      to_date: b.check_out,
    });
    if (error) console.log("ERR", error.message);
    else {
      filled++;
      console.log("OK", b.check_in, free.label);
    }
  }
  console.log("filled", filled);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
