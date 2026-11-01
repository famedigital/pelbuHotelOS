/**
 * Push Reservation 2026.xlsx comment prices onto Pelbu Olakha bookings.
 * All rack prices are treated as inclusive of 10% S.C., with no GST.
 *
 * From web/:
 *   node --env-file=.env.local scripts/pelbu-olakha-apply-rack-pricing.mjs
 *   node --env-file=.env.local scripts/pelbu-olakha-apply-rack-pricing.mjs --apply
 */
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { parseRack } from "./lib/pelbu-olakha-rack.mjs";
import { PROPERTY_SLUG } from "./lib/pelbu-olakha-rooms.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const RACK_PATH =
  process.argv.find((a) => a.startsWith("--in="))?.slice(5) ||
  "C:/Users/rajiv/Downloads/Reservation 2026.xlsx";
const TODAY = "2026-10-17";
const NOTE_TAG = "[olakha-rack-pricing]";
const SC_RATE = 0.1;

function loadEnv(path) {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

function roundBtn(n) {
  return Math.round(Number(n) * 100) / 100;
}

function nightsBetween(cin, cout) {
  if (!cin || !cout) return 0;
  const n = (Date.parse(cout) - Date.parse(cin)) / 86400000;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

loadEnv("C:/GitHub/Hotel OS Bhutan/web/.env.local");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: property, error: pErr } = await admin
  .from("properties")
  .select(
    "id, name, slug, gst_enabled, gst_rate, service_charge_rate, service_charge_default_on",
  )
  .eq("slug", PROPERTY_SLUG)
  .maybeSingle();
if (pErr || !property) throw pErr || new Error("property not found");

console.log(
  `Property ${property.name} · apply=${APPLY} · rack=${RACK_PATH}`,
);

const parsed = parseRack(resolve(RACK_PATH), TODAY);
const priced = parsed.stays.filter(
  (s) => !s.blocking && Number(s.quoted_total_btn) > 0.5,
);
console.log(
  `Rack stays ${parsed.stays.length} · priced ${priced.length} · warnings ${parsed.warnings?.length ?? 0}`,
);

// Ensure property tax posture: no GST, SC 10% on by default, rates inclusive.
const { data: policy } = await admin
  .from("property_policies")
  .select("property_id, rates_inclusive_of_gst_sc")
  .eq("property_id", property.id)
  .maybeSingle();

if (APPLY) {
  const propPatch = {};
  if (property.gst_enabled !== false) propPatch.gst_enabled = false;
  if (Number(property.gst_rate) !== 0) propPatch.gst_rate = 0;
  if (Number(property.service_charge_rate) !== SC_RATE)
    propPatch.service_charge_rate = SC_RATE;
  if (property.service_charge_default_on !== true)
    propPatch.service_charge_default_on = true;
  if (Object.keys(propPatch).length) {
    const { error } = await admin
      .from("properties")
      .update(propPatch)
      .eq("id", property.id);
    if (error) throw error;
    console.log("Updated property tax defaults", propPatch);
  }
  if (policy && policy.rates_inclusive_of_gst_sc !== true) {
    const { error } = await admin
      .from("property_policies")
      .update({ rates_inclusive_of_gst_sc: true })
      .eq("property_id", property.id);
    if (error) throw error;
    console.log("Set rates_inclusive_of_gst_sc=true");
  } else if (!policy) {
    console.warn("No property_policies row — skip inclusive flag");
  } else {
    console.log("Property already inclusive / GST off");
  }
} else {
  console.log("Dry-run: would ensure GST off, SC 10%, rates inclusive");
}

const { data: bookings, error: bErr } = await admin
  .from("bookings")
  .select(
    "id, confirmation_code, contact_name, check_in, check_out, status, rooms, quoted_total_btn, agreed_nightly_rate_btn, rate_tax_mode, tax_exempt_gst, tax_exempt_service, meal_plan_code, external_ref, notes",
  )
  .eq("property_id", property.id)
  .neq("status", "cancelled");
if (bErr) throw bErr;

const byRef = new Map();
for (const b of bookings || []) {
  if (b.external_ref) byRef.set(b.external_ref, b);
}

const updates = [];
const unmatched = [];
for (const stay of priced) {
  const booking = byRef.get(stay.external_ref);
  if (!booking) {
    unmatched.push({
      ref: stay.external_ref,
      guest: stay.guest_name,
      quoted: stay.quoted_total_btn,
    });
    continue;
  }

  const doorCount = Math.max(
    1,
    (stay.doors?.length || 0) ||
      String(stay.room_labels || "")
        .split(",")
        .filter(Boolean).length ||
      Number(booking.rooms) ||
      1,
  );
  const n = nightsBetween(stay.check_in, stay.check_out) || stay.nights?.length || 1;
  const quoted = roundBtn(stay.quoted_total_btn);
  const nightly = roundBtn(quoted / (n * doorCount));
  const meal = ["EP", "BB", "MAP", "AP"].includes(stay.meal_plan_code)
    ? stay.meal_plan_code
    : booking.meal_plan_code;

  const patch = {
    quoted_total_btn: quoted,
    agreed_nightly_rate_btn: nightly,
    agreed_rate_reason: `Reservation rack ${TODAY}: Nu ${quoted} all-in (${doorCount} rm × ${n} n @ ${nightly}/night) incl. 10% S.C., no GST · ${stay.amount_source || "comment"}`,
    agreed_rate_set_at: new Date().toISOString(),
    agreed_rate_set_by: "ops:rack-pricing",
    rate_tax_mode: "inclusive",
    tax_exempt_gst: true,
    tax_exempt_service: false,
    meal_plan_code: meal,
  };

  const needs =
    Number(booking.quoted_total_btn) !== quoted ||
    Number(booking.agreed_nightly_rate_btn) !== nightly ||
    booking.rate_tax_mode !== "inclusive" ||
    booking.tax_exempt_gst !== true ||
    booking.tax_exempt_service !== false;

  if (!needs) continue;

  updates.push({
    id: booking.id,
    conf: booking.confirmation_code,
    guest: booking.contact_name,
    cin: booking.check_in,
    cout: booking.check_out,
    before: {
      quoted: booking.quoted_total_btn,
      nightly: booking.agreed_nightly_rate_btn,
      mode: booking.rate_tax_mode,
    },
    after: { quoted, nightly, doors: doorCount, nights: n, src: stay.amount_source },
    patch,
    notes: booking.notes,
  });
}

console.log(`Matched updates: ${updates.length}`);
console.log(`Priced rack stays with no booking: ${unmatched.length}`);
console.log("Sample updates:");
for (const u of updates.slice(0, 12)) {
  console.log(
    `  ${u.conf} ${u.guest} ${u.cin}→${u.cout} quoted ${u.before.quoted}→${u.after.quoted} nightly ${u.after.nightly} (${u.after.doors}rm×${u.after.nights}n)`,
  );
}

if (APPLY) {
  let applied = 0;
  for (const u of updates) {
    const noteLine = `${NOTE_TAG} Nu ${u.after.quoted} incl 10% SC / no GST (${TODAY})`;
    let notes = String(u.notes || "");
    if (!notes.includes(NOTE_TAG)) {
      notes = notes ? `${notes}\n\n${noteLine}` : noteLine;
    } else {
      notes = notes.replace(
        new RegExp(`${NOTE_TAG.replace(/[[\]]/g, "\\$&")}[^\\n]*`),
        noteLine,
      );
    }
    const { error } = await admin
      .from("bookings")
      .update({ ...u.patch, notes: notes.slice(0, 8000) })
      .eq("id", u.id)
      .eq("property_id", property.id);
    if (error) {
      console.error("FAIL", u.conf, error.message);
      continue;
    }
    applied += 1;
  }
  console.log(`Applied ${applied}/${updates.length}`);
} else {
  console.log("Dry-run only. Re-run with --apply to write.");
}

const report = {
  apply: APPLY,
  property_id: property.id,
  priced_stays: priced.length,
  updates: updates.length,
  unmatched: unmatched.length,
  samples: updates.slice(0, 20).map((u) => ({
    conf: u.conf,
    guest: u.guest,
    quoted: u.after.quoted,
    nightly: u.after.nightly,
  })),
  unmatched_sample: unmatched.slice(0, 15),
};
const out = resolve(
  "C:/Users/rajiv/Downloads/pelbu-olakha-rack-pricing-report.json",
);
writeFileSync(out, JSON.stringify(report, null, 2));
console.log("Report", out);
