/**
 * Import missing stays from Reservation 2026.xlsx into pelbu-olakha,
 * and flip false no_show statuses when the rack still shows the stay active.
 *
 * From web/:
 *   node --env-file=.env.local scripts/pelbu-olakha-import-missing-from-rack.mjs
 *   node --env-file=.env.local scripts/pelbu-olakha-import-missing-from-rack.mjs --apply
 */
import { resolve } from "node:path";
import { writeFileSync, readFileSync } from "node:fs";
import { parseRack } from "./lib/pelbu-olakha-rack.mjs";
import { PROPERTY_SLUG } from "./lib/pelbu-olakha-rooms.mjs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const RACK =
  process.argv.find((a) => a.startsWith("--in="))?.slice(5) ||
  "C:/Users/rajiv/Downloads/Reservation 2026 (2).xlsx";
const TODAY = new Date().toLocaleDateString("en-CA", {
  timeZone: "Asia/Thimphu",
});

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

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
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
    if (last && last.to === date) {
      last.to = addDays(date, 1);
    } else {
      out.push({ from: date, to: addDays(date, 1) });
    }
  }
  return out;
}

function roundBtn(n) {
  return Math.round(Number(n) * 100) / 100;
}

function nightsBetween(cin, cout) {
  if (!cin || !cout) return 0;
  const n = (Date.parse(cout) - Date.parse(cin)) / 86400000;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function noteText(stay) {
  const parts = [];
  if (stay.ai_package === "yes") {
    parts.push("All-inclusive package (AI) from the reservation rack.");
  }
  if (stay.payment_note) parts.push(stay.payment_note);
  if (stay.diet) parts.push(`Diet: ${stay.diet}`);
  if (stay.eta) parts.push(`ETA: ${stay.eta}`);
  if (stay.warnings?.length) {
    parts.push(`Import notes: ${stay.warnings.join("; ")}`);
  }
  if (stay.raw_comment) parts.push(stay.raw_comment);
  parts.push(
    `[olakha-missing-import] from ${RACK.split(/[/\\\\]/).pop()} on ${new Date().toISOString().slice(0, 10)}`,
  );
  return parts.join("\n\n").slice(0, 8000);
}

loadEnv("C:/GitHub/Hotel OS Bhutan/web/.env.local");
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
if (pErr || !property) throw pErr || new Error("property missing");

const { data: roomTypes } = await admin
  .from("room_types")
  .select("id, code, inventory_kind")
  .eq("property_id", property.id);
const typeById = new Map((roomTypes || []).map((r) => [r.id, r]));

const { data: units } = await admin
  .from("room_units")
  .select("id, label, room_type_id")
  .eq("property_id", property.id);
const unitByLabel = new Map((units || []).map((u) => [u.label, u]));

const { data: bookings } = await admin
  .from("bookings")
  .select(
    "id, confirmation_code, contact_name, status, check_in, check_out, external_ref, quoted_total_btn, agent_id, notes, agents(company_name)",
  )
  .eq("property_id", property.id);

const { data: allAssigns } = await admin
  .from("room_assignments")
  .select("booking_id, from_date, to_date, room_units(label)")
  .in(
    "booking_id",
    (bookings || []).map((b) => b.id),
  );

const doorsByBooking = new Map();
for (const a of allAssigns || []) {
  const label = Array.isArray(a.room_units)
    ? a.room_units[0]?.label
    : a.room_units?.label;
  if (!label) continue;
  const set = doorsByBooking.get(a.booking_id) ?? new Set();
  set.add(String(label));
  doorsByBooking.set(a.booking_id, set);
}

function refStem(ref) {
  // rack:2026:spj:2026-10-15:201:a0677422 → drop trailing hash
  const parts = String(ref || "").split(":");
  if (parts.length >= 2 && /^[0-9a-f]{6,}$/i.test(parts[parts.length - 1])) {
    return parts.slice(0, -1).join(":");
  }
  return String(ref || "");
}

const byRef = new Map();
const byStem = new Map();
for (const b of bookings || []) {
  if (b.external_ref) {
    byRef.set(b.external_ref, b);
    const stem = refStem(b.external_ref);
    if (!byStem.has(stem)) byStem.set(stem, b);
  }
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

function findFuzzy(stay) {
  // Prefer stable rack key without workbook hash (room may have been moved in Innora)
  const stemHit = byStem.get(refStem(stay.external_ref));
  if (stemHit && stemHit.status !== "cancelled") return stemHit;

  const sDoors = stayDoors(stay);
  const agent = norm(stay.agent_name || stay.agent_code);
  const guest = norm(stay.guest_name);
  for (const b of bookings || []) {
    if (b.status === "cancelled") continue;
    if (b.check_in !== stay.check_in || b.check_out !== stay.check_out) continue;
    const bAgent = norm(b.agents?.company_name || "");
    const bGuest = norm(b.contact_name);
    const agentHit =
      agent && bAgent && (agent.includes(bAgent) || bAgent.includes(agent));
    const guestHit =
      guest &&
      bGuest &&
      (guest === bGuest || guest.includes(bGuest) || bGuest.includes(guest));
    if (!agentHit && !guestHit) continue;
    const bDoors = doorsByBooking.get(b.id) ?? new Set();
    let overlap = false;
    for (const d of sDoors) {
      if (bDoors.has(d)) {
        overlap = true;
        break;
      }
    }
    // Require door overlap for name-only matches so multi-room groups
    // (e.g. Reinhold 404 + 502) are not collapsed onto one booking.
    if (overlap) return b;
    if ((sDoors.size === 0 || bDoors.size === 0) && (agentHit || guestHit)) {
      return b;
    }
  }
  return null;
}

const parsed = parseRack(resolve(RACK), TODAY);
const active = parsed.stays.filter((s) => !s.blocking);

const missing = [];
const revive = [];
const alreadyOk = [];
const linkRef = []; // existing booking, update external_ref to new workbook hash
for (const stay of active) {
  let hit = byRef.get(stay.external_ref) || null;
  if (!hit) {
    hit = findFuzzy(stay);
    if (hit) linkRef.push({ stay, booking: hit });
  }
  if (!hit) {
    missing.push(stay);
    continue;
  }
  alreadyOk.push(stay.external_ref);
  if (
    hit.status === "no_show" &&
    ["confirmed", "checked_in", "held"].includes(stay.status)
  ) {
    revive.push({ stay, booking: hit });
  }
}

console.log(
  `Property ${property.name} · apply=${APPLY}\n` +
    `Rack active ${active.length} · Innora ${(bookings || []).length} · already matched ${alreadyOk.length} · link-ref ${linkRef.length} · missing ${missing.length} · revive no_show ${revive.length}`,
);

const agentCache = new Map();
async function agentIdFor(name) {
  const company = String(name || "").trim();
  if (!company) return null;
  const key = company.toLowerCase();
  if (agentCache.has(key)) return agentCache.get(key);
  const { data: found } = await admin
    .from("agents")
    .select("id, company_name")
    .ilike("company_name", company.replace(/%/g, ""))
    .limit(10);
  let id =
    found?.find((r) => r.company_name.trim().toLowerCase() === key)?.id ??
    found?.[0]?.id ??
    null;
  if (!id && APPLY) {
    const { data: inserted, error } = await admin
      .from("agents")
      .insert({
        company_name: company,
        market: "bhutan",
        status: "approved",
        rate_tier: "agents",
        credit_limit: 0,
        credit_used: 0,
        contact_name: company,
      })
      .select("id")
      .single();
    if (error) throw error;
    id = inserted.id;
  }
  if (id && APPLY) {
    await admin.from("agent_property_links").upsert(
      {
        agent_id: id,
        property_id: property.id,
        status: "approved",
        rate_tier: "agents",
        credit_limit: 0,
        credit_used: 0,
      },
      { onConflict: "agent_id,property_id" },
    );
  }
  agentCache.set(key, id);
  return id;
}

const guideCache = new Map();
async function guideIdFor(name, phone) {
  const fullName = String(name || "").trim();
  const guideNumber =
    String(phone || "").trim() ||
    (fullName ? `name:${slug(fullName)}` : "");
  if (!guideNumber) return null;
  if (guideCache.has(guideNumber)) return guideCache.get(guideNumber);
  const { data: found } = await admin
    .from("guides")
    .select("id")
    .eq("property_id", property.id)
    .eq("guide_number", guideNumber)
    .limit(1);
  let id = found?.[0]?.id ?? null;
  if (!id && APPLY) {
    const { data: inserted, error } = await admin
      .from("guides")
      .insert({
        property_id: property.id,
        guide_number: guideNumber,
        full_name: fullName || null,
        phone: String(phone || "").trim() || null,
      })
      .select("id")
      .single();
    if (error) throw error;
    id = inserted.id;
  }
  guideCache.set(guideNumber, id);
  return id;
}

function mapStatus(stayStatus) {
  // Don't auto check-in/out from rack during import — desk will do that.
  if (stayStatus === "cancelled") return "cancelled";
  if (stayStatus === "held") return "held";
  if (stayStatus === "no_show") return "confirmed";
  if (stayStatus === "checked_out") return "confirmed";
  if (stayStatus === "checked_in") return "confirmed";
  return "confirmed";
}

const summary = {
  apply: APPLY,
  missing_planned: missing.length,
  revive_planned: revive.length,
  link_ref_planned: linkRef.length,
  inserted: 0,
  revived: 0,
  linked_refs: 0,
  assignment_ok: 0,
  assignment_skip: 0,
  failed: [],
  inserted_refs: [],
  revived_confs: [],
};

if (!APPLY) {
  console.log("\nDRY-RUN — would insert:");
  for (const s of missing) {
    console.log(
      `  + ${s.check_in}→${s.check_out} ${s.room_labels} | ${s.agent_name || s.agent_code} | ${s.guest_name} | ${s.external_ref}`,
    );
  }
  console.log("\nDRY-RUN — would link external_ref on existing:");
  for (const { stay, booking } of linkRef.slice(0, 20)) {
    console.log(
      `  = ${booking.confirmation_code} ← ${stay.external_ref} (${stay.guest_name})`,
    );
  }
  if (linkRef.length > 20) console.log(`  … +${linkRef.length - 20} more`);
  console.log("\nDRY-RUN — would revive no_show:");
  for (const { stay, booking } of revive) {
    console.log(
      `  ~ ${booking.confirmation_code} ${booking.contact_name} → confirmed (${stay.check_in}→${stay.check_out})`,
    );
  }
} else {
  for (const { stay, booking } of linkRef) {
    try {
      if (booking.external_ref === stay.external_ref) continue;
      // Only rewrite when same rack stem (hash drift). Skip name-only fuzzy
      // so we don't overwrite a multi-room group's ref with a sibling door.
      if (refStem(booking.external_ref) !== refStem(stay.external_ref)) continue;
      const { error } = await admin
        .from("bookings")
        .update({ external_ref: stay.external_ref })
        .eq("id", booking.id);
      if (error) throw error;
      summary.linked_refs += 1;
    } catch (err) {
      summary.failed.push({
        ref: stay.external_ref,
        error: `link-ref: ${err.message || err}`,
      });
    }
  }

  for (const stay of missing) {
    try {
      const agentId =
        stay.source === "agent" && stay.agent_name
          ? await agentIdFor(stay.agent_name)
          : stay.agent_name
            ? await agentIdFor(stay.agent_name)
            : null;
      const guideId = await guideIdFor(
        stay.guide_name || "",
        stay.guide_phone || "",
      );
      const meal = ["EP", "BB", "MAP", "AP"].includes(stay.meal_plan_code)
        ? stay.meal_plan_code
        : "EP";
      const doorLabels = (stay.doors?.length
        ? stay.doors
        : String(stay.room_labels || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
      ).filter((label) => unitByLabel.has(label));
      const quoted = Number(stay.quoted_total_btn);
      const hasQuote = Number.isFinite(quoted) && quoted > 0.5;
      const n = nightsBetween(stay.check_in, stay.check_out) || 1;
      const rooms = Math.max(doorLabels.length, 1);
      const nightly = hasQuote ? roundBtn(quoted / (n * rooms)) : null;

      const { data: inserted, error: iErr } = await admin
        .from("bookings")
        .insert({
          property_id: property.id,
          agent_id: agentId,
          source: stay.source || "agent",
          guest_origin: stay.guest_origin || "international",
          check_in: stay.check_in,
          check_out: stay.check_out,
          status: mapStatus(stay.status),
          contact_name: stay.guest_name || stay.agent_name || stay.agent_code,
          contact_phone: stay.guide_phone || null,
          adults: Math.max(1, Math.min(400, Number(stay.adults) || rooms)),
          children: 0,
          rooms,
          extra_beds: Math.max(0, Math.min(2, Number(stay.extra_beds) || 0)),
          notes: noteText(stay),
          meal_plan_code: meal,
          meal_plan_amount_btn: 0,
          quoted_total_btn: hasQuote ? quoted : null,
          agreed_nightly_rate_btn: nightly,
          agreed_rate_reason: hasQuote
            ? `Rack import: Nu ${quoted} all-in (${rooms} rm × ${n} n) incl 10% SC, no GST`
            : null,
          agreed_rate_set_at: hasQuote ? new Date().toISOString() : null,
          agreed_rate_set_by: hasQuote ? "ops:missing-rack-import" : null,
          rate_tax_mode: "inclusive",
          tax_exempt_gst: true,
          tax_exempt_service: false,
          external_ref: stay.external_ref,
          guide_id: guideId,
          guide_number: guideId
            ? stay.guide_phone || `name:${slug(stay.guide_name)}`
            : null,
          payment_mode: agentId ? "on_credit" : null,
        })
        .select("id, confirmation_code")
        .single();
      if (iErr) throw iErr;

      await admin.from("booking_guests").insert({
        booking_id: inserted.id,
        full_name: stay.guest_name || stay.agent_name || "Guest",
        nationality: stay.nationality || null,
        sort_order: 0,
      });

      const qtyByType = new Map();
      for (const label of doorLabels) {
        const unit = unitByLabel.get(label);
        qtyByType.set(
          unit.room_type_id,
          (qtyByType.get(unit.room_type_id) ?? 0) + 1,
        );
      }
      if (qtyByType.size) {
        await admin.from("booking_rooms").insert(
          [...qtyByType.entries()].map(([roomTypeId, qty]) => ({
            booking_id: inserted.id,
            room_type_id: roomTypeId,
            qty,
            inventory_kind:
              typeById.get(roomTypeId)?.inventory_kind ?? "sellable_guest",
            meal_plan_code: meal,
            adults: Math.max(1, Number(stay.adults) || 1),
          })),
        );
      }

      // Assignments from doorNights
      for (const door of doorLabels) {
        const unit = unitByLabel.get(door);
        const nightSet =
          stay.doorNights?.get?.(door) ??
          (stay.nights ? new Set(stay.nights) : new Set());
        const dates = [...nightSet];
        if (!dates.length && stay.check_in && stay.check_out) {
          // fallback full stay
          let d = stay.check_in;
          while (d < stay.check_out) {
            dates.push(d);
            d = addDays(d, 1);
          }
        }
        for (const range of runs(dates)) {
          const { error: aErr } = await admin.from("room_assignments").insert({
            property_id: property.id,
            booking_id: inserted.id,
            room_unit_id: unit.id,
            from_date: range.from,
            to_date: range.to,
            chargeable: true,
          });
          if (aErr) {
            summary.assignment_skip += 1;
            console.warn(
              `  assign skip ${inserted.confirmation_code} ${door} ${range.from}: ${aErr.message}`,
            );
          } else {
            summary.assignment_ok += 1;
          }
        }
      }

      summary.inserted += 1;
      summary.inserted_refs.push({
        conf: inserted.confirmation_code,
        ref: stay.external_ref,
        guest: stay.guest_name,
        cin: stay.check_in,
        cout: stay.check_out,
        rooms: stay.room_labels,
      });
      console.log(
        `+ ${inserted.confirmation_code} ${stay.check_in}→${stay.check_out} ${stay.room_labels} ${stay.guest_name}`,
      );
    } catch (err) {
      summary.failed.push({
        ref: stay.external_ref,
        error: err instanceof Error ? err.message : String(err),
      });
      console.error(`FAIL ${stay.external_ref}:`, err.message || err);
    }
  }

  for (const { stay, booking } of revive) {
    try {
      const quoted = Number(stay.quoted_total_btn);
      const hasQuote = Number.isFinite(quoted) && quoted > 0.5;
      const n = nightsBetween(stay.check_in, stay.check_out) || 1;
      const rooms = Math.max(stay.doors?.length || 1, 1);
      const patch = {
        status: "confirmed",
        cancelled_at: null,
        cancel_reason: null,
        meal_plan_amount_btn: 0,
        rate_tax_mode: "inclusive",
        tax_exempt_gst: true,
      };
      if (hasQuote) {
        patch.quoted_total_btn = quoted;
        patch.agreed_nightly_rate_btn = roundBtn(quoted / (n * rooms));
        patch.agreed_rate_reason = `Rack revive: Nu ${quoted} incl 10% SC, no GST`;
        patch.agreed_rate_set_at = new Date().toISOString();
        patch.agreed_rate_set_by = "ops:missing-rack-import";
      }
      const { error } = await admin
        .from("bookings")
        .update(patch)
        .eq("id", booking.id);
      if (error) throw error;
      summary.revived += 1;
      summary.revived_confs.push(booking.confirmation_code);
      console.log(`~ revived ${booking.confirmation_code} → confirmed`);
    } catch (err) {
      summary.failed.push({
        ref: stay.external_ref,
        error: `revive: ${err.message || err}`,
      });
    }
  }
}

// Re-count truly unmatched (ref + fuzzy)
const { data: afterBookings } = await admin
  .from("bookings")
  .select(
    "id, confirmation_code, contact_name, status, check_in, check_out, external_ref, agents(company_name)",
  )
  .eq("property_id", property.id);
const afterRefs = new Set(
  (afterBookings || []).map((b) => b.external_ref).filter(Boolean),
);
const afterStems = new Set(
  (afterBookings || [])
    .map((b) => (b.external_ref ? refStem(b.external_ref) : null))
    .filter(Boolean),
);
const { data: afterAssigns } = await admin
  .from("room_assignments")
  .select("booking_id, room_units(label)")
  .in(
    "booking_id",
    (afterBookings || []).map((b) => b.id),
  );
const afterDoors = new Map();
for (const a of afterAssigns || []) {
  const label = Array.isArray(a.room_units)
    ? a.room_units[0]?.label
    : a.room_units?.label;
  if (!label) continue;
  const set = afterDoors.get(a.booking_id) ?? new Set();
  set.add(String(label));
  afterDoors.set(a.booking_id, set);
}
function findFuzzyAfter(stay) {
  if (afterStems.has(refStem(stay.external_ref))) return true;
  const sDoors = stayDoors(stay);
  const agent = norm(stay.agent_name || stay.agent_code);
  const guest = norm(stay.guest_name);
  for (const b of afterBookings || []) {
    if (b.status === "cancelled") continue;
    if (b.check_in !== stay.check_in || b.check_out !== stay.check_out) continue;
    const bAgent = norm(b.agents?.company_name || "");
    const bGuest = norm(b.contact_name);
    const agentHit =
      agent && bAgent && (agent.includes(bAgent) || bAgent.includes(agent));
    const guestHit =
      guest &&
      bGuest &&
      (guest === bGuest || guest.includes(bGuest) || bGuest.includes(guest));
    if (!agentHit && !guestHit) continue;
    const bDoors = afterDoors.get(b.id) ?? new Set();
    for (const d of sDoors) {
      if (bDoors.has(d)) return b;
    }
    if ((sDoors.size === 0 || bDoors.size === 0) && (agentHit || guestHit)) {
      return b;
    }
  }
  return null;
}
const stillMissing = active.filter(
  (s) => !afterRefs.has(s.external_ref) && !findFuzzyAfter(s),
);

const report = {
  ...summary,
  still_missing_after: stillMissing.length,
  still_missing: stillMissing.map((s) => ({
    ref: s.external_ref,
    guest: s.guest_name,
    agent: s.agent_name || s.agent_code,
    cin: s.check_in,
    cout: s.check_out,
    rooms: s.room_labels,
  })),
};
const out = "C:/Users/rajiv/Downloads/pelbu-missing-import-report.json";
writeFileSync(out, JSON.stringify(report, null, 2));
console.log("\n=== DONE ===");
console.log(JSON.stringify({
  apply: APPLY,
  inserted: summary.inserted,
  revived: summary.revived,
  assignment_ok: summary.assignment_ok,
  assignment_skip: summary.assignment_skip,
  failed: summary.failed.length,
  still_missing: stillMissing.length,
}, null, 2));
console.log("Report", out);
if (!APPLY) {
  console.log("\nRe-run with --apply to write into Innora.");
}
