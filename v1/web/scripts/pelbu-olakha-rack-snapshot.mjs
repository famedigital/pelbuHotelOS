/**
 * Restorable snapshot of pelbu-olakha bookings before a rack load.
 *
 *   node --env-file=.env.local scripts/pelbu-olakha-rack-snapshot.mjs
 *   node --env-file=.env.local scripts/pelbu-olakha-rack-snapshot.mjs --restore=../backups/pelbu-rack-before-2026-3.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PROPERTY_SLUG } from "./lib/pelbu-olakha-rooms.mjs";

const restoreArg = process.argv.find((a) => a.startsWith("--restore="));
const out =
  process.argv.find((a) => a.startsWith("--out="))?.slice(6) ||
  resolve("../backups/pelbu-rack-before-2026-3.json");

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
if (pErr || !property) throw new Error(pErr?.message || "missing property");

if (restoreArg) {
  const file = restoreArg.slice("--restore=".length);
  const snap = JSON.parse(readFileSync(file, "utf8"));
  let ok = 0;
  let fail = 0;
  for (const row of snap.bookings ?? []) {
    const { error } = await admin
      .from("bookings")
      .update({
        status: row.status,
        check_in: row.check_in,
        check_out: row.check_out,
        external_ref: row.external_ref,
      })
      .eq("id", row.id)
      .eq("property_id", property.id);
    if (error) {
      fail += 1;
      console.error("FAIL", row.confirmation_code, error.message);
    } else ok += 1;
  }
  console.log(JSON.stringify({ restored: ok, failed: fail, file }, null, 2));
  process.exit(fail ? 1 : 0);
}

const { data: bookings, error } = await admin
  .from("bookings")
  .select(
    "id, confirmation_code, contact_name, status, check_in, check_out, external_ref, checked_in_at, checked_out_at",
  )
  .eq("property_id", property.id)
  .limit(5000);
if (error) throw new Error(error.message);

const ids = (bookings ?? []).map((b) => b.id);
const { data: assignments, error: aErr } = await admin
  .from("room_assignments")
    .select("id, booking_id, room_unit_id")
  .in("booking_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
if (aErr) throw new Error(aErr.message);

const payload = {
  taken_at: new Date().toISOString(),
  property_id: property.id,
  slug: property.slug,
  bookings: bookings ?? [],
  assignments: assignments ?? [],
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(payload));
console.log(
  JSON.stringify(
    {
      out,
      bookings: payload.bookings.length,
      assignments: payload.assignments.length,
    },
    null,
    2,
  ),
);
